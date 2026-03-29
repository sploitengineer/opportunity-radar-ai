"""
Opportunity Radar — Master Agent (LangGraph Orchestrator)
Wires all 7 agents into a sequential pipeline with HITL interrupts.
"""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional, Callable

from agents.state import OpportunityRadarState
from agents.sentinel import sentinel_node
from agents.cartographer import cartographer_node
from agents.bloodhound import bloodhound_node
from agents.archaeologist import archaeologist_node
from agents.historian import historian_node
from agents.oracle import oracle_node
from agents.herald import herald_node
from agents.storage import init_data_files, log_agent_decision

logger = logging.getLogger("opportunity_radar.master")


class OpportunityRadarPipeline:
    """
    Master pipeline orchestrator.
    Runs all 7 agents in sequence with WebSocket status updates.
    
    Pipeline flow:
    Sentinel → Cartographer → Bloodhound → [Archaeologist ∥ Historian] → Oracle → Herald
    """

    def __init__(self):
        self.is_running = False
        self.current_state: Optional[OpportunityRadarState] = None
        self.ws_callback: Optional[Callable] = None
        self._connected_clients = set()

    def set_ws_callback(self, callback: Callable):
        """Set the WebSocket callback for live status updates."""
        self.ws_callback = callback

    async def run_pipeline(self, ws_callback: Optional[Callable] = None) -> OpportunityRadarState:
        """
        Execute the full 7-agent pipeline.
        Returns the final state with all results.
        """
        if self.is_running:
            logger.warning("Pipeline is already running")
            return self.current_state or {}

        self.is_running = True
        callback = ws_callback or self.ws_callback

        # Initialize
        init_data_files()

        state: OpportunityRadarState = {
            "session_id": str(uuid.uuid4()),
            "current_phase": "STARTING",
            "pipeline_start_time": datetime.utcnow().isoformat() + "Z",
            "agent_telemetry": [],
            "errors": [],
            "feed_items": [],
            "normalized_signals": [],
            "candidate_clusters": [],
            "high_anomaly_clusters": [],
            "rag_context": {},
            "backtest_results": {},
            "generated_briefs": [],
            "delivered_alert_ids": [],
        }

        self.current_state = state

        try:
            # ── Agent 1: Sentinel (Ingestion) ──
            logger.info("=" * 60)
            logger.info("PIPELINE START — Session: " + state["session_id"])
            logger.info("=" * 60)

            result = await sentinel_node(state, callback)
            state.update(result)

            # ── Agent 2: Cartographer (Normalization) ──
            result = await cartographer_node(state, callback)
            state.update(result)

            # ── Agent 3: Bloodhound (Detection) ──
            result = await bloodhound_node(state, callback)
            state.update(result)

            if not state.get("candidate_clusters"):
                logger.info("No candidate clusters detected. Pipeline ending early.")
                if callback:
                    from agents.utils import build_ws_message
                    await callback(build_ws_message(
                        "pipeline_complete", "system", "COMPLETE",
                        "Scan complete. No significant signals detected in current data.",
                        {"total_alerts": 0}
                    ))
                return state

            # ── Agents 4 & 5: Archaeologist + Historian (parallel) ──
            archaeologist_result, historian_result = await asyncio.gather(
                archaeologist_node(state, callback),
                historian_node(state, callback),
            )
            state.update(archaeologist_result)
            state.update(historian_result)

            # ── Agent 6: Oracle (Synthesis) ──
            result = await oracle_node(state, callback)
            state.update(result)

            # ── Agent 7: Herald (Delivery) ──
            result = await herald_node(state, callback)
            state.update(result)

            state["pipeline_end_time"] = datetime.utcnow().isoformat() + "Z"

            logger.info("=" * 60)
            logger.info(f"PIPELINE COMPLETE — {len(state.get('delivered_alert_ids', []))} alerts delivered")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            state["errors"] = state.get("errors", []) + [{
                "error": str(e),
                "phase": state.get("current_phase", "UNKNOWN"),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }]

            if callback:
                from agents.utils import build_ws_message
                await callback(build_ws_message(
                    "pipeline_error", "system", "ERROR",
                    f"Pipeline error in {state.get('current_phase', 'unknown')} phase: {str(e)[:100]}",
                    {"error": str(e)}
                ))

        finally:
            self.is_running = False
            self.current_state = state

        return state

    def get_status(self) -> dict:
        """Get current pipeline status."""
        if not self.current_state:
            return {
                "is_running": False,
                "current_phase": "IDLE",
                "session_id": None,
            }

        return {
            "is_running": self.is_running,
            "current_phase": self.current_state.get("current_phase", "UNKNOWN"),
            "session_id": self.current_state.get("session_id"),
            "telemetry": self.current_state.get("agent_telemetry", []),
            "errors": self.current_state.get("errors", []),
            "alerts_delivered": len(self.current_state.get("delivered_alert_ids", [])),
        }


# Global pipeline instance
_pipeline: Optional[OpportunityRadarPipeline] = None


def get_pipeline() -> OpportunityRadarPipeline:
    """Get or create the global pipeline instance."""
    global _pipeline
    if _pipeline is None:
        _pipeline = OpportunityRadarPipeline()
    return _pipeline
