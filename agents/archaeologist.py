"""
Agent 4: Archaeologist — RAG over Company Filings
Uses FAISS + sentence-transformers to index and retrieve context from filings.
"""
import asyncio
import logging
import os
import json
from typing import List, Optional

from agents.state import OpportunityRadarState
from agents.storage import read_json, log_agent_decision
from agents.utils import Timer, build_ws_message
from config import (
    HISTORICAL_CONTEXT_PATH, RAG_DIR, RAG_EMBEDDING_MODEL,
    RAG_TOP_K, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP,
    DEMO_MODE, DEMO_AGENT_DELAYS
)

logger = logging.getLogger("opportunity_radar.archaeologist")

# Global index holder
_faiss_index = None
_chunks_store = []
_embedder = None


def get_embedder():
    """Get or create the sentence-transformers embedder."""
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer(RAG_EMBEDDING_MODEL)
            logger.info(f"Loaded embedding model: {RAG_EMBEDDING_MODEL}")
        except Exception as e:
            logger.error(f"Failed to load embedder: {e}")
            _embedder = None
    return _embedder


def chunk_text(text: str, chunk_size: int = RAG_CHUNK_SIZE, overlap: int = RAG_CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def build_index(force_rebuild: bool = False) -> bool:
    """
    Build the FAISS index from historical context data.
    Returns True if index was built successfully.
    """
    global _faiss_index, _chunks_store

    index_path = os.path.join(RAG_DIR, "faiss.index")
    chunks_path = os.path.join(RAG_DIR, "chunks.json")

    # Check if index already exists
    if not force_rebuild and os.path.exists(index_path) and os.path.exists(chunks_path):
        try:
            import faiss
            import numpy as np
            _faiss_index = faiss.read_index(index_path)
            with open(chunks_path, "r", encoding="utf-8") as f:
                _chunks_store = json.load(f)
            logger.info(f"Loaded existing FAISS index with {len(_chunks_store)} chunks")
            return True
        except Exception as e:
            logger.warning(f"Failed to load existing index: {e}")

    # Build fresh index
    context_data = read_json(HISTORICAL_CONTEXT_PATH)
    if not context_data:
        logger.warning("No historical context data found")
        return False

    embedder = get_embedder()
    if embedder is None:
        logger.error("No embedder available, using fallback keyword search")
        # Fallback: store chunks without embeddings for keyword matching
        _chunks_store = []
        for ticker, company in context_data.items():
            for filing in company.get("filings", []):
                text = filing.get("text", "")
                source = filing.get("source", "")
                date = filing.get("date", "")
                for chunk in chunk_text(text):
                    _chunks_store.append({
                        "text": chunk,
                        "ticker": ticker,
                        "source": source,
                        "date": date,
                        "company": company.get("company_name", ""),
                    })
        return True

    # Create chunks with metadata
    all_chunks = []
    all_texts = []

    for ticker, company in context_data.items():
        for filing in company.get("filings", []):
            text = filing.get("text", "")
            source = filing.get("source", "")
            date = filing.get("date", "")

            for chunk in chunk_text(text):
                all_chunks.append({
                    "text": chunk,
                    "ticker": ticker,
                    "source": source,
                    "date": date,
                    "company": company.get("company_name", ""),
                })
                all_texts.append(chunk)

    if not all_texts:
        logger.warning("No text chunks to index")
        return False

    # Create embeddings
    logger.info(f"Creating embeddings for {len(all_texts)} chunks...")
    embeddings = embedder.encode(all_texts, show_progress_bar=False)

    # Build FAISS index
    try:
        import faiss
        import numpy as np

        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(np.array(embeddings).astype("float32"))

        # Save
        os.makedirs(RAG_DIR, exist_ok=True)
        faiss.write_index(index, index_path)
        with open(chunks_path, "w", encoding="utf-8") as f:
            json.dump(all_chunks, f, indent=2, ensure_ascii=False)

        _faiss_index = index
        _chunks_store = all_chunks
        logger.info(f"Built FAISS index: {len(all_chunks)} chunks, {dimension}d embeddings")
        return True

    except ImportError:
        logger.warning("FAISS not available, using keyword-based retrieval fallback")
        _chunks_store = all_chunks
        return True


def retrieve_context(ticker: str, query: str = "", top_k: int = RAG_TOP_K) -> List[dict]:
    """
    Retrieve relevant context chunks for a ticker.
    Uses FAISS if available, falls back to keyword matching.
    """
    global _faiss_index, _chunks_store

    if not _chunks_store:
        build_index()

    if not _chunks_store:
        return []

    # Filter chunks for this ticker
    ticker_chunks = [c for c in _chunks_store if c.get("ticker") == ticker]

    if _faiss_index is not None and query:
        # FAISS semantic search
        embedder = get_embedder()
        if embedder:
            try:
                import numpy as np
                query_embedding = embedder.encode([query])
                distances, indices = _faiss_index.search(
                    np.array(query_embedding).astype("float32"), top_k * 2
                )

                results = []
                for idx, dist in zip(indices[0], distances[0]):
                    if 0 <= idx < len(_chunks_store):
                        chunk = _chunks_store[idx]
                        if chunk.get("ticker") == ticker:
                            results.append({
                                **chunk,
                                "similarity_score": round(1.0 / (1.0 + float(dist)), 3),
                            })
                            if len(results) >= top_k:
                                break

                return results
            except Exception as e:
                logger.warning(f"FAISS search failed: {e}, falling back to keyword")

    # Keyword fallback
    return ticker_chunks[:top_k]


async def archaeologist_node(state: OpportunityRadarState, ws_callback=None) -> dict:
    """
    Archaeologist Agent — retrieves filing context for each candidate cluster.
    """
    logger.info("📚 Archaeologist Agent — Retrieving filing context via RAG")

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "archaeologist", "RUNNING",
            "Searching company filings for relevant context..."
        ))

    with Timer() as timer:
        if DEMO_MODE:
            await asyncio.sleep(DEMO_AGENT_DELAYS.get("archaeologist", 5))

        # Build index if needed
        build_index()

        candidate_clusters = state.get("candidate_clusters", [])
        rag_context = {}

        for cluster in candidate_clusters:
            ticker = cluster.get("ticker", "")
            query = (
                f"insider trading {cluster.get('direction', '')} "
                f"management commentary outlook {ticker}"
            )

            chunks = retrieve_context(ticker, query)
            rag_context[ticker] = chunks

            logger.info(f"Retrieved {len(chunks)} chunks for {ticker}")

        total_chunks = sum(len(v) for v in rag_context.values())
        summary = f"Retrieved {total_chunks} context chunks for {len(rag_context)} tickers"
        logger.info(summary)

    log_agent_decision(
        agent="Archaeologist",
        input_data={"tickers": list(rag_context.keys())},
        output_data={"total_chunks": total_chunks},
        decision="CONTEXT_RETRIEVED",
        reasoning=summary,
        latency_ms=timer.elapsed_ms,
    )

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "archaeologist", "COMPLETE",
            summary,
            {
                "tickers_indexed": list(rag_context.keys()),
                "total_chunks": total_chunks,
            }
        ))

    return {
        "rag_context": rag_context,
        "current_phase": "RAG",
        "agent_telemetry": state.get("agent_telemetry", []) + [{
            "agent": "Archaeologist",
            "status": "COMPLETE",
            "latency_ms": timer.elapsed_ms,
            "message": summary,
        }],
    }
