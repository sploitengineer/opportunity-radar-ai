"""
Opportunity Radar — Pydantic Data Models
Strict schemas for all data objects flowing through the system.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SignalEvent(BaseModel):
    """A single normalised market event (insider trade, block deal, etc.)."""
    id: str = Field(..., description="Unique signal ID, e.g. sig_20250329_001")
    ticker: str = Field(..., description="Stock ticker, e.g. RELIANCE")
    event_type: str = Field(..., description="INSIDER_TRADE | BLOCK_DEAL | BULK_DEAL | QUARTERLY_RESULT")
    actor: str = Field(..., description="Who acted — director name, institution, etc.")
    trade_direction: Optional[str] = Field(None, description="BUY | SELL | null")
    quantity: Optional[int] = Field(None, description="Number of shares")
    value_inr: Optional[float] = Field(None, description="Transaction value in INR")
    date: str = Field(..., description="Event date YYYY-MM-DD")
    source_url: str = Field("", description="URL of original filing/source")
    raw_hash: str = Field("", description="SHA256 of raw payload for dedup")
    processed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class BacktestResult(BaseModel):
    """Historical back-test result for a signal pattern."""
    success_rate: float = Field(..., description="Fraction of signals followed by >5% gain")
    sample_count: int = Field(..., description="Number of historical instances found")
    avg_return_pct: float = Field(..., description="Average return percentage")
    median_days_to_peak: int = Field(..., description="Median days to reach peak after signal")
    cached_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class Cluster(BaseModel):
    """A detected insider trading cluster."""
    cluster_id: str = Field(..., description="Unique cluster ID")
    ticker: str
    signal_type: str = Field(default="INSIDER_CLUSTER")
    insider_count: int
    direction: str = Field(..., description="BUY | SELL")
    combined_value_inr: float
    window_start: str
    window_end: str
    z_score: float
    status: str = Field(default="CANDIDATE", description="CANDIDATE | APPROVED | REJECTED | DELIVERED")
    constituent_signal_ids: List[str] = Field(default_factory=list)
    backtest: Optional[BacktestResult] = None


class AlertBrief(BaseModel):
    """Oracle-generated plain-English signal brief."""
    what_happened: str
    why_it_matters: str
    the_numbers: str
    historical_odds: str
    what_to_watch: str


class Citation(BaseModel):
    """Source citation for an alert."""
    label: str
    url: str = ""
    date: str = ""


class Alert(BaseModel):
    """A complete alert ready for delivery."""
    alert_id: str
    cluster_id: str
    ticker: str
    brief: AlertBrief
    citations: List[Citation] = Field(default_factory=list)
    confidence_score: float = Field(0.0, description="0.0-1.0 confidence")
    status: str = Field(default="PENDING_REVIEW", description="PENDING_REVIEW | REVIEW_REQUIRED | DELIVERED | REJECTED")
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    delivered_at: Optional[str] = None


class AuditEntry(BaseModel):
    """Immutable audit log entry for agent decisions."""
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    agent: str
    input_hash: str
    output_hash: str
    decision: str
    reasoning_snippet: str
    latency_ms: int


class WatchlistPrefs(BaseModel):
    """User watchlist and preferences."""
    tickers: List[str] = Field(default_factory=list)
    preferences: dict = Field(default_factory=lambda: {
        "min_backtest_success_rate": 0.65,
        "min_cluster_size": 2,
        "notify_on_sectors": []
    })


class ChatMessage(BaseModel):
    """Chat message for the Radar Assistant."""
    role: str = Field(..., description="user | assistant | system")
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
