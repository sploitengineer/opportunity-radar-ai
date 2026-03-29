"""
Opportunity Radar — LangGraph Agent State
Defines the shared state passed through all 7 agents in the pipeline.
"""
from typing import TypedDict, List, Optional
from typing_extensions import Annotated


class AgentTelemetry(TypedDict, total=False):
    """Telemetry for a single agent execution."""
    agent: str
    status: str            # IDLE | RUNNING | COMPLETE | ERROR
    latency_ms: int
    message: str
    timestamp: str


class OpportunityRadarState(TypedDict, total=False):
    """
    Master state object for the LangGraph pipeline.
    Passed through all 7 agents sequentially.
    """
    # ── Session ──
    session_id: str
    current_phase: str       # INGESTION | NORMALIZATION | DETECTION | RAG | BACKTEST | SYNTHESIS | DELIVERY

    # ── Phase 1: Ingestion (Sentinel) ──
    raw_fetch_paths: List[str]
    feed_items: List[dict]
    current_feed_index: int

    # ── Phase 2: Normalization (Cartographer) ──
    normalized_signals: List[dict]
    processed_signal_count: int
    dedup_count: int

    # ── Phase 3: Detection (Bloodhound) ──
    candidate_clusters: List[dict]
    high_anomaly_clusters: List[dict]   # z_score >= 3.5 → HITL

    # ── Phase 4: Intelligence ──
    # Archaeologist (RAG)
    rag_context: dict                    # ticker -> List[chunks]

    # Historian (Backtest)
    backtest_results: dict               # cluster_id -> backtest stats

    # ── Phase 5: Synthesis (Oracle) ──
    generated_briefs: List[dict]
    oracle_retry_count: int

    # ── Phase 6: Delivery (Herald) ──
    delivered_alert_ids: List[str]
    delivery_errors: List[dict]

    # ── Control Flow ──
    hitl_pending: bool
    hitl_action: Optional[str]           # APPROVE | REJECT | EDIT
    hitl_edit_text: Optional[str]

    # ── Telemetry ──
    agent_telemetry: List[AgentTelemetry]
    errors: List[dict]
    pipeline_start_time: str
    pipeline_end_time: Optional[str]
