"""
Agent 1: Sentinel — Data Ingestion
Reads the incoming_feed.json and emits raw events for processing.
In production: would use APScheduler + HTTP fetch from NSE/SEBI/BSE.
In prototype: reads pre-seeded mock data.
"""
import asyncio
import logging
import time
from typing import Any

from agents.state import OpportunityRadarState
from agents.storage import read_json, write_json, log_agent_decision
from agents.utils import Timer, build_ws_message, generate_id
from config import INCOMING_FEED_PATH, DEMO_MODE, DEMO_AGENT_DELAYS

logger = logging.getLogger("opportunity_radar.sentinel")


async def sentinel_node(state: OpportunityRadarState, ws_callback=None) -> dict:
    """
    Sentinel Agent — reads the incoming feed and loads raw events.
    
    In demo mode: adds theatrical delay for pipeline animation.
    """
    logger.info("🛰️ Sentinel Agent — Starting data ingestion")

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "sentinel", "RUNNING",
            "Scanning market data feeds for new filings and trades..."
        ))

    with Timer() as timer:
        # Simulate processing time for theatrical demo
        if DEMO_MODE:
            await asyncio.sleep(DEMO_AGENT_DELAYS.get("sentinel", 3))

        # Read the incoming feed
        feed_items = read_json(INCOMING_FEED_PATH)

        if not isinstance(feed_items, list):
            feed_items = []

        logger.info(f"Sentinel found {len(feed_items)} items in incoming feed")

        # Categorize by event type
        insider_trades = [f for f in feed_items if f.get("event_type") == "INSIDER_TRADE"]
        block_deals = [f for f in feed_items if f.get("event_type") == "BLOCK_DEAL"]
        bulk_deals = [f for f in feed_items if f.get("event_type") == "BULK_DEAL"]
        results = [f for f in feed_items if f.get("event_type") == "QUARTERLY_RESULT"]

        summary = (
            f"Ingested {len(feed_items)} events: "
            f"{len(insider_trades)} insider trades, "
            f"{len(block_deals)} block deals, "
            f"{len(bulk_deals)} bulk deals, "
            f"{len(results)} quarterly results"
        )
        logger.info(summary)

    # Log decision
    log_agent_decision(
        agent="Sentinel",
        input_data={"feed_path": INCOMING_FEED_PATH},
        output_data={"item_count": len(feed_items)},
        decision="DATA_INGESTED",
        reasoning=summary,
        latency_ms=timer.elapsed_ms,
    )

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "sentinel", "COMPLETE",
            summary,
            {"item_count": len(feed_items), "categories": {
                "insider_trades": len(insider_trades),
                "block_deals": len(block_deals),
                "bulk_deals": len(bulk_deals),
                "quarterly_results": len(results),
            }}
        ))

    return {
        "feed_items": feed_items,
        "current_phase": "INGESTION",
        "agent_telemetry": state.get("agent_telemetry", []) + [{
            "agent": "Sentinel",
            "status": "COMPLETE",
            "latency_ms": timer.elapsed_ms,
            "message": summary,
        }],
    }
