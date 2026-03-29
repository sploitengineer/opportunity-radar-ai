"""
Agent 6: Oracle — LLM Signal Brief Generation
Uses Groq (llama-3.3-70b) to generate plain-English signal briefs.
Includes anti-hallucination policy and output validation.
"""
import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import List

from agents.state import OpportunityRadarState
from agents.models import Alert, AlertBrief, Citation
from agents.storage import read_json, append_to_json_list, log_agent_decision
from agents.utils import Timer, build_ws_message, get_groq_client, get_key_rotator, generate_id
from agents.prompts import (
    ORACLE_SYSTEM_PROMPT, ORACLE_USER_PROMPT,
    RISK_REVIEWER_SYSTEM_PROMPT, RISK_REVIEWER_USER_PROMPT,
    validate_oracle_output
)
from config import (
    ALERTS_PATH, WATCHLIST_PATH, DEMO_MODE, DEMO_AGENT_DELAYS,
    GROQ_MODEL_HEAVY, GROQ_MODEL_LIGHT
)

logger = logging.getLogger("opportunity_radar.oracle")


def format_cluster_for_prompt(cluster: dict) -> str:
    """Format a cluster object for the LLM prompt."""
    return json.dumps({
        "ticker": cluster.get("ticker"),
        "signal_type": cluster.get("signal_type"),
        "insider_count": cluster.get("insider_count"),
        "direction": cluster.get("direction"),
        "combined_value_inr": cluster.get("combined_value_inr"),
        "combined_value_cr": round(cluster.get("combined_value_inr", 0) / 10000000, 2),
        "window_start": cluster.get("window_start"),
        "window_end": cluster.get("window_end"),
        "z_score": cluster.get("z_score"),
        "actors": cluster.get("actors", []),
    }, indent=2)


def format_backtest_for_prompt(backtest: dict) -> str:
    """Format backtest results for the LLM prompt."""
    if not backtest:
        return "No backtest data available."
    return json.dumps(backtest, indent=2)


def format_rag_chunks_for_prompt(chunks: List[dict]) -> str:
    """Format RAG chunks for the LLM prompt with citations."""
    if not chunks:
        return "No filing context available."

    formatted = []
    for i, chunk in enumerate(chunks, 1):
        citation = f"[Source: {chunk.get('source', 'Unknown')}, {chunk.get('date', '')}]"
        formatted.append(f"Chunk {i} {citation}:\n{chunk.get('text', '')}")

    return "\n\n".join(formatted)


def parse_brief_sections(text: str) -> dict:
    """Parse Oracle's markdown output into structured sections."""
    sections = {
        "what_happened": "",
        "why_it_matters": "",
        "the_numbers": "",
        "historical_odds": "",
        "what_to_watch": "",
    }

    current_section = None
    section_map = {
        "what happened": "what_happened",
        "why it might matter": "why_it_matters",
        "the numbers": "the_numbers",
        "historical odds": "historical_odds",
        "what to watch": "what_to_watch",
    }

    for line in text.split("\n"):
        line_lower = line.strip().lower()

        # Check if this line is a section header
        for header, key in section_map.items():
            if header in line_lower and line.strip().startswith("#"):
                current_section = key
                break
        else:
            if current_section:
                sections[current_section] += line + "\n"

    # Clean up
    for key in sections:
        sections[key] = clean_brief_text(sections[key].strip())

    return sections


def clean_brief_text(text: str) -> str:
    """Post-process Oracle output to remove LLM verbosity."""
    if not text:
        return text

    # Strip parenthetical INR conversions: (or ₹57,750,000 in INR), (₹X in INR), etc.
    text = re.sub(r'\s*\(or\s*₹[\d,\.]+\s*(?:in\s*INR|INR)\)', '', text)
    text = re.sub(r'\s*\(₹[\d,\.]+\s*(?:in\s*INR|INR)\)', '', text)
    text = re.sub(r'\s*\(approximately\s*₹[\d,\.]+[^)]*\)', '', text)
    text = re.sub(r'\s*\(i\.e\.,?\s*₹[\d,\.]+[^)]*\)', '', text)

    # Replace verbose direction phrases
    text = re.sub(r"in the direction of ['\"]?BUY['\"]?", "↑ BUY", text, flags=re.IGNORECASE)
    text = re.sub(r"in the direction of ['\"]?SELL['\"]?", "↓ SELL", text, flags=re.IGNORECASE)
    text = re.sub(r"traded in the direction of ['\"]?BUY['\"]?", "bought shares", text, flags=re.IGNORECASE)
    text = re.sub(r"traded in the direction of ['\"]?SELL['\"]?", "sold shares", text, flags=re.IGNORECASE)

    # Remove LLM boilerplate
    boilerplate = [
        "It is important to note that",
        "It's worth noting that",
        "It should be noted that",
        "Please note that",
        "Disclaimer:",
        "Note:",
    ]
    for phrase in boilerplate:
        text = text.replace(phrase, "")

    # Clean up double spaces and trailing whitespace
    text = re.sub(r'  +', ' ', text)
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    return text.strip()


def generate_card_preview(brief: dict) -> str:
    """Generate a clean 120-char preview for the alert card."""
    what = brief.get("what_happened", "")
    if not what:
        return "Signal detected — click to view full brief"
    # Strip markdown, truncate
    preview = re.sub(r'[#*_`]', '', what)
    preview = preview.replace('\n', ' ').strip()
    if len(preview) > 120:
        preview = preview[:117] + "..."
    return preview


def extract_citations(chunks: List[dict]) -> List[dict]:
    """Extract citation objects from RAG chunks."""
    citations = []
    seen = set()
    for chunk in chunks:
        label = chunk.get("source", "")
        if label and label not in seen:
            seen.add(label)
            citations.append({
                "label": label,
                "url": "",
                "date": chunk.get("date", ""),
            })
    return citations


async def generate_brief(cluster: dict, backtest: dict, rag_chunks: List[dict], watchlist_prefs: dict) -> dict:
    """Generate a signal brief using Groq LLM."""
    cluster_json = format_cluster_for_prompt(cluster)
    backtest_json = format_backtest_for_prompt(backtest)
    rag_text = format_rag_chunks_for_prompt(rag_chunks)
    prefs_json = json.dumps(watchlist_prefs, indent=2) if watchlist_prefs else "{}"

    user_prompt = ORACLE_USER_PROMPT.format(
        cluster_json=cluster_json,
        backtest_json=backtest_json,
        rag_chunks=rag_text,
        watchlist_prefs=prefs_json,
    )

    max_retries = 2
    for attempt in range(max_retries):
        try:
            llm = get_groq_client(GROQ_MODEL_HEAVY)
            messages = [
                {"role": "system", "content": ORACLE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ]

            response = await asyncio.to_thread(
                lambda: llm.invoke(messages).content
            )

            # Validate output
            is_valid, missing = validate_oracle_output(response)
            if is_valid:
                return {
                    "raw_text": response,
                    "sections": parse_brief_sections(response),
                    "is_valid": True,
                }

            logger.warning(f"Oracle output missing sections: {missing}. Attempt {attempt + 1}/{max_retries}")

            if attempt < max_retries - 1:
                user_prompt += f"\n\nCORRECTION: Your previous response was missing these sections: {missing}. Please include ALL 5 sections."

        except Exception as e:
            error_msg = str(e).lower()
            if "rate_limit" in error_msg or "429" in error_msg:
                logger.warning("Rate limited, rotating Groq key...")
                rotator = get_key_rotator()
                rotator.report_error()
            else:
                logger.error(f"Oracle LLM call failed: {e}")

            if attempt >= max_retries - 1:
                return _generate_fallback_brief(cluster, backtest)

    return _generate_fallback_brief(cluster, backtest)


def _generate_fallback_brief(cluster: dict, backtest: dict) -> dict:
    """Generate a structured brief without LLM when API is unavailable."""
    ticker = cluster.get("ticker", "UNKNOWN")
    direction = cluster.get("direction", "BUY")
    count = cluster.get("insider_count", 0)
    value_cr = round(cluster.get("combined_value_inr", 0) / 10000000, 2)
    z_score = cluster.get("z_score", 0)
    actors = cluster.get("actors", [])
    success_rate = backtest.get("success_rate", 0) if backtest else 0
    sample_count = backtest.get("sample_count", 0) if backtest else 0
    avg_return = backtest.get("avg_return_pct", 0) if backtest else 0

    brief = {
        "what_happened": f"{count} company insiders of {ticker} made {direction.lower()} transactions within a {cluster.get('window_start', '')} to {cluster.get('window_end', '')} window. The insiders involved are: {', '.join(actors[:3])}. Combined transaction value: ₹{value_cr} Cr.",
        "why_it_matters": f"Multiple insiders trading in the same direction within a short window is a statistically significant signal. This cluster in {ticker} has an anomaly score of {z_score}σ above the 90-day baseline activity level.",
        "the_numbers": f"- Insider count: {count}\n- Combined value: ₹{value_cr} Cr\n- Window: {cluster.get('window_start', '')} to {cluster.get('window_end', '')}\n- Anomaly score: {z_score} ({z_score}σ above 90-day baseline)",
        "historical_odds": f"In {sample_count} similar events on {ticker} over 3 years, {int(success_rate * sample_count)} were followed by a gain of more than 5% within 30 days ({success_rate*100:.0f}% success rate). Average return: {avg_return}%.",
        "what_to_watch": f"- Monitor upcoming quarterly results announcement for {ticker}\n- Watch for additional insider activity in the next 5-10 trading sessions",
    }

    return {
        "raw_text": "\n\n".join(f"## {k.replace('_', ' ').title()}\n{v}" for k, v in brief.items()),
        "sections": brief,
        "is_valid": True,
    }


async def oracle_node(state: OpportunityRadarState, ws_callback=None) -> dict:
    """
    Oracle Agent — generates plain-English signal briefs for each cluster.
    """
    logger.info("🧠 Oracle Agent — Generating signal briefs")

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "oracle", "RUNNING",
            "Synthesizing intelligence briefs with AI analysis..."
        ))

    with Timer() as timer:
        if DEMO_MODE:
            await asyncio.sleep(DEMO_AGENT_DELAYS.get("oracle", 10))

        candidate_clusters = state.get("candidate_clusters", [])
        rag_context = state.get("rag_context", {})
        backtest_results = state.get("backtest_results", {})
        watchlist = read_json(WATCHLIST_PATH)

        generated_briefs = []

        for cluster in candidate_clusters:
            ticker = cluster.get("ticker", "")
            cluster_id = cluster.get("cluster_id", "")

            # Get context for this cluster
            chunks = rag_context.get(ticker, [])
            backtest = backtest_results.get(cluster_id, cluster.get("backtest", {}))

            # Generate brief
            brief_result = await generate_brief(cluster, backtest, chunks, watchlist.get("preferences", {}))

            if brief_result.get("is_valid"):
                sections = brief_result["sections"]
                citations = extract_citations(chunks)
                now = datetime.utcnow()

                # Confidence level from z-score
                z = cluster.get("z_score", 0)
                confidence_level = "HIGH_CONVICTION" if z > 3.5 else "STRONG" if z >= 2.5 else "MODERATE"

                alert = {
                    "alert_id": generate_id("alt"),
                    "cluster_id": cluster_id,
                    "ticker": ticker,
                    "brief": sections,
                    "card_preview": generate_card_preview(sections),
                    "citations": citations,
                    "confidence_score": round(
                        (backtest.get("success_rate", 0.5) + min(z / 5, 1)) / 2,
                        2
                    ),
                    "confidence_level": confidence_level,
                    "status": "REVIEW_REQUIRED" if cluster.get("requires_hitl", False) else "PENDING_REVIEW",
                    "generated_at": now.isoformat() + "Z",
                    "valid_until": (now + timedelta(days=30)).isoformat() + "Z",
                    "z_score": z,
                    "direction": cluster.get("direction", ""),
                    "insider_count": cluster.get("insider_count", 0),
                    "combined_value_cr": round(cluster.get("combined_value_inr", 0) / 10000000, 2),
                    "window_start": cluster.get("window_start", ""),
                    "window_end": cluster.get("window_end", ""),
                    "actors": cluster.get("actors", []),
                    "backtest_summary": {
                        "success_rate": backtest.get("success_rate", 0),
                        "sample_count": backtest.get("sample_count", 0),
                        "avg_return_pct": backtest.get("avg_return_pct", 0),
                    },
                    "sources": [
                        {"label": "SEBI PIT Disclosure", "url": "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=6&ssid=19"},
                        {"label": "NSE Bulk Deals", "url": "https://www.nseindia.com/market-data/bulk-deals"},
                        {"label": "BSE Corporate Filing", "url": "https://www.bseindia.com/corporates/ann.html"},
                    ],
                }

                generated_briefs.append(alert)

        # Persist alerts
        if generated_briefs:
            append_to_json_list(ALERTS_PATH, generated_briefs)

        summary = f"Generated {len(generated_briefs)} signal briefs for {len(candidate_clusters)} clusters"
        logger.info(summary)

    log_agent_decision(
        agent="Oracle",
        input_data={"cluster_count": len(candidate_clusters)},
        output_data={"brief_count": len(generated_briefs)},
        decision="BRIEFS_GENERATED",
        reasoning=summary,
        latency_ms=timer.elapsed_ms,
    )

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "oracle", "COMPLETE",
            summary,
            {
                "briefs_generated": len(generated_briefs),
                "tickers": [b["ticker"] for b in generated_briefs],
            }
        ))

    return {
        "generated_briefs": generated_briefs,
        "current_phase": "SYNTHESIS",
        "agent_telemetry": state.get("agent_telemetry", []) + [{
            "agent": "Oracle",
            "status": "COMPLETE",
            "latency_ms": timer.elapsed_ms,
            "message": summary,
        }],
    }
