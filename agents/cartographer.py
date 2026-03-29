"""
Agent 2: Cartographer — Data Normalization & Deduplication
Transforms raw feed items into standardized SignalEvent objects.
Deduplicates using SHA256 hashing.
"""
import asyncio
import logging
from typing import Any

from agents.state import OpportunityRadarState
from agents.models import SignalEvent
from agents.storage import read_json, append_to_json_list, log_agent_decision
from agents.utils import Timer, build_ws_message, sha256, generate_id, dedup_by_hash
from config import SIGNALS_PATH, DEMO_MODE, DEMO_AGENT_DELAYS

logger = logging.getLogger("opportunity_radar.cartographer")


def normalize_feed_item(item: dict) -> dict:
    """Convert a raw feed item into a standardized signal event dict."""
    signal_id = generate_id("sig")

    return {
        "id": signal_id,
        "ticker": item.get("ticker", "UNKNOWN"),
        "event_type": item.get("event_type", "UNKNOWN"),
        "actor": item.get("actor", "Unknown"),
        "trade_direction": item.get("trade_direction"),
        "quantity": item.get("quantity"),
        "value_inr": item.get("value_inr"),
        "date": item.get("date", ""),
        "source_url": item.get("source_url", ""),
        "raw_hash": sha256(item),
        "raw_text": item.get("raw_text", ""),
    }


async def cartographer_node(state: OpportunityRadarState, ws_callback=None) -> dict:
    """
    Cartographer Agent — normalizes and deduplicates incoming feed items.
    """
    logger.info("🗺️ Cartographer Agent — Normalizing data")

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "cartographer", "RUNNING",
            "Normalizing and deduplicating market events..."
        ))

    with Timer() as timer:
        if DEMO_MODE:
            await asyncio.sleep(DEMO_AGENT_DELAYS.get("cartographer", 4))

        feed_items = state.get("feed_items", [])

        # Normalize each item
        normalized = [normalize_feed_item(item) for item in feed_items]

        # Deduplicate
        existing_signals = read_json(SIGNALS_PATH)
        existing_hashes = {s.get("raw_hash") for s in existing_signals if isinstance(s, dict)}

        new_signals = [s for s in normalized if s["raw_hash"] not in existing_hashes]
        dedup_count = len(normalized) - len(new_signals)

        # Persist
        if new_signals:
            append_to_json_list(SIGNALS_PATH, new_signals)

        summary = (
            f"Normalized {len(normalized)} events, "
            f"{len(new_signals)} new, {dedup_count} duplicates removed"
        )
        logger.info(summary)

    log_agent_decision(
        agent="Cartographer",
        input_data={"raw_count": len(feed_items)},
        output_data={"normalized_count": len(new_signals), "dedup_count": dedup_count},
        decision="DATA_NORMALIZED",
        reasoning=summary,
        latency_ms=timer.elapsed_ms,
    )

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "cartographer", "COMPLETE",
            summary,
            {"new_signals": len(new_signals), "dedup_count": dedup_count}
        ))

    return {
        "normalized_signals": new_signals,
        "processed_signal_count": len(new_signals),
        "dedup_count": dedup_count,
        "current_phase": "NORMALIZATION",
        "agent_telemetry": state.get("agent_telemetry", []) + [{
            "agent": "Cartographer",
            "status": "COMPLETE",
            "latency_ms": timer.elapsed_ms,
            "message": summary,
        }],
    }
