"""
Agent 7: Herald — Alert Delivery + Audit Logging
Pushes approved alerts to WebSocket clients.
Manages final delivery state and audit trail.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Callable, Optional

from agents.state import OpportunityRadarState
from agents.storage import read_json, write_json, log_agent_decision
from agents.utils import Timer, build_ws_message
from config import ALERTS_PATH, DEMO_MODE, DEMO_AGENT_DELAYS

logger = logging.getLogger("opportunity_radar.herald")


async def herald_node(state: OpportunityRadarState, ws_callback=None) -> dict:
    """
    Herald Agent — delivers approved alerts to the dashboard.
    """
    logger.info("📢 Herald Agent — Delivering alerts")

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "herald", "RUNNING",
            "Preparing alerts for delivery to dashboard..."
        ))

    with Timer() as timer:
        if DEMO_MODE:
            await asyncio.sleep(DEMO_AGENT_DELAYS.get("herald", 3))

        generated_briefs = state.get("generated_briefs", [])
        delivered_ids = []
        hitl_pending = False

        for alert in generated_briefs:
            if alert.get("status") == "REVIEW_REQUIRED":
                hitl_pending = True
                logger.info(f"Alert {alert['alert_id']} requires HITL review — z_score high")
                continue

            # Mark as delivered
            alert["status"] = "DELIVERED"
            alert["delivered_at"] = datetime.utcnow().isoformat() + "Z"
            delivered_ids.append(alert["alert_id"])

            # Push to WebSocket
            if ws_callback:
                await ws_callback(build_ws_message(
                    "new_alert", "herald", "DELIVERED",
                    f"🚨 New signal: {alert['ticker']} — {alert.get('direction', '')} cluster detected",
                    {"alert": alert}
                ))

        # Update alerts file with delivery status
        all_alerts = read_json(ALERTS_PATH)
        if isinstance(all_alerts, list):
            for stored_alert in all_alerts:
                if stored_alert.get("alert_id") in delivered_ids:
                    stored_alert["status"] = "DELIVERED"
                    stored_alert["delivered_at"] = datetime.utcnow().isoformat() + "Z"
            write_json(ALERTS_PATH, all_alerts)

        summary = f"Delivered {len(delivered_ids)} alerts, {len(generated_briefs) - len(delivered_ids)} pending review"
        logger.info(summary)

    log_agent_decision(
        agent="Herald",
        input_data={"total_briefs": len(generated_briefs)},
        output_data={"delivered": len(delivered_ids)},
        decision="ALERTS_DELIVERED",
        reasoning=summary,
        latency_ms=timer.elapsed_ms,
    )

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "herald", "COMPLETE",
            summary,
            {"delivered_count": len(delivered_ids), "hitl_pending": hitl_pending}
        ))

        # Send pipeline complete event
        await ws_callback(build_ws_message(
            "pipeline_complete", "system", "COMPLETE",
            f"Pipeline scan complete. {len(delivered_ids)} new opportunity signals detected.",
            {
                "total_alerts": len(generated_briefs),
                "delivered": len(delivered_ids),
                "pending_review": len(generated_briefs) - len(delivered_ids),
                "telemetry": state.get("agent_telemetry", []),
            }
        ))

    return {
        "delivered_alert_ids": delivered_ids,
        "hitl_pending": hitl_pending,
        "current_phase": "DELIVERY",
        "pipeline_end_time": datetime.utcnow().isoformat() + "Z",
        "agent_telemetry": state.get("agent_telemetry", []) + [{
            "agent": "Herald",
            "status": "COMPLETE",
            "latency_ms": timer.elapsed_ms,
            "message": summary,
        }],
    }
