# 📡 Opportunity Radar — Architecture Document

## System Overview

Opportunity Radar is a **multi-agent financial intelligence system** that detects insider trading clusters from public Indian regulatory filings and surfaces actionable signals for retail investors. The system uses 7 specialized AI agents orchestrated via a LangGraph state machine.

---

## Agent Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        LANGGRAPH STATE MACHINE                          │
│                                                                          │
│   ┌──────────┐    ┌──────────────┐    ┌────────────┐                    │
│   │ Sentinel  │───▶│ Cartographer │───▶│ Bloodhound │                    │
│   │ (Ingest)  │    │ (Normalize)  │    │ (Detect)   │                    │
│   └──────────┘    └──────────────┘    └─────┬──────┘                    │
│                                              │                           │
│                                    ┌─────────┴─────────┐                │
│                                    │                     │                │
│                              ┌─────▼──────┐    ┌────────▼───┐           │
│                              │Archaeologist│    │  Historian  │           │
│                              │   (RAG)     │    │ (Backtest)  │           │
│                              └─────┬───────┘   └────────┬───┘           │
│                                    │                     │                │
│                                    └─────────┬───────────┘                │
│                                              │                           │
│                                        ┌─────▼──────┐                    │
│                                        │   Oracle    │                    │
│                                        │ (LLM Brief) │                    │
│                                        └─────┬──────┘                    │
│                                              │                           │
│                                    ┌─────────▼─────────┐                │
│                                    │   z_score ≥ 3.5?  │                │
│                                    └─────┬─────────┬───┘                │
│                                    Yes   │         │  No                 │
│                              ┌───────────▼──┐  ┌───▼──────┐            │
│                              │  HITL Review  │  │  Herald  │            │
│                              │  (Human Gate) │  │(Deliver) │            │
│                              └───────────┬──┘  └───┬──────┘            │
│                                          │         │                     │
│                                          └────┬────┘                     │
│                                               │                          │
│                                         ┌─────▼──────┐                   │
│                                         │  WebSocket  │                   │
│                                         │  Dashboard  │                   │
│                                         └────────────┘                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Roles

| Agent | Responsibility | Model/Tool | Input | Output |
|-------|---------------|------------|-------|--------|
| **Sentinel** | Ingests market data from feed | N/A (file I/O) | `incoming_feed.json` | Raw events list |
| **Cartographer** | Normalizes events to standard schema, deduplicates via SHA256 | N/A (Pydantic) | Raw events | `signals.json` |
| **Bloodhound** | Detects 10-day insider clusters, computes z-score anomaly | N/A (pandas math) | Signals | `candidate_signals.json` |
| **Archaeologist** | Semantic search over company filings | FAISS + sentence-transformers | Ticker | Context chunks with citations |
| **Historian** | Back-tests signal pattern against 3yr price history | yfinance | Ticker + pattern | Success rate, avg return |
| **Oracle** | Generates 5-section plain-English brief | Groq llama-3.3-70b | Cluster + context + backtest | Signal brief with citations |
| **Herald** | Delivers alerts via WebSocket, writes audit log | N/A (I/O) | Approved brief | Dashboard push |

---

## Communication Flow

### State Object
All agents share an `OpportunityRadarState` TypedDict:

```python
class OpportunityRadarState(TypedDict):
    session_id: str
    current_phase: str
    feed_items: List[dict]           # Sentinel output
    normalized_signals: List[dict]    # Cartographer output
    candidate_clusters: List[dict]    # Bloodhound output
    rag_context: dict                 # Archaeologist output
    backtest_results: dict            # Historian output
    generated_briefs: List[dict]      # Oracle output
    delivered_alert_ids: List[str]    # Herald output
    agent_telemetry: List[dict]       # Performance tracking
    errors: List[dict]                # Error accumulator
```

### Data Flow
1. Each agent reads from state, performs its task, and writes results back to state
2. State is passed sequentially: Sentinel → Cartographer → Bloodhound → [Archaeologist ∥ Historian] → Oracle → Herald
3. Archaeologist and Historian run **in parallel** (asyncio.gather) for efficiency
4. Every agent writes a decision to `audit_log.json` with input/output hashes

---

## Tool Integrations

| Tool | Purpose | Integration Point |
|------|---------|-------------------|
| **Groq API** | LLM inference (signal briefs, chatbot) | Oracle agent, Chat handler |
| **FAISS** | Vector similarity search over filing text | Archaeologist agent |
| **sentence-transformers** | Text embedding for FAISS index | Archaeologist agent |
| **yfinance** | Historical stock price data | Historian agent |
| **Tavily** | Web search for additional context | Available to Oracle (optional) |

### Groq Key Rotation
The system manages 3 Groq API keys:
```
Key 1 (primary) → Rate limited → Auto-rotate to Key 2 → Rate limited → Key 3
```
Rotation is handled by `GroqKeyRotator` class in `agents/utils.py`.

---

## Error Handling

| Scenario | Handler | Recovery |
|----------|---------|----------|
| Groq rate limit (429) | `GroqKeyRotator.report_error()` | Rotates to next API key, retries |
| Oracle output missing sections | `validate_oracle_output()` | Retries with correction prompt (max 2) |
| Oracle complete failure | `_generate_fallback_brief()` | Generates structured brief from data without LLM |
| FAISS not available | Keyword fallback in Archaeologist | Returns ticker-filtered chunks without semantic ranking |
| yfinance data unavailable | `_generate_mock_backtest()` | Returns realistic mock backtest data |
| WebSocket disconnection | Frontend reconnect | Auto-reconnects after 5 seconds |
| Pipeline crash | Master agent try/except | Logs error, broadcasts error via WebSocket |

---

## Data Storage

All data stored as JSON files in `data/` directory:

| File | Purpose | Access Pattern |
|------|---------|----------------|
| `incoming_feed.json` | Mock market events | Read-only (seed data) |
| `signals.json` | Normalized events | Append by Cartographer |
| `candidate_signals.json` | Detected clusters | Write by Bloodhound |
| `alerts.json` | Oracle briefs + delivery status | Append by Oracle, update by Herald |
| `audit_log.json` | Immutable agent decisions | Append-only |
| `backtest_cache.json` | Cached backtest results (7-day TTL) | Read/write by Historian |
| `watchlist.json` | User preferences | Read/write via API |

**Upgrade path:** Replace `agents/storage.py` functions with PostgreSQL calls — single file change.

---

## Frontend Architecture

```
┌─────────────────────────────────────────────────────┐
│                    TopBar                             │
│  [Logo] [Market Status] [Live] [NARRATOR] [▶ Scan]  │
├──────────┬────────────────────────┬──────────────────┤
│  Agent   │     Center Panel       │   Watchlist      │
│ Pipeline │                        │    Panel         │
│          │  ┌──────────────────┐  │                  │
│ Sentinel │  │ Signals | Sector │  │  RELIANCE  ×     │
│    │     │  │ Radar   | Audit  │  │  TCS       ×     │
│ Cartog.  │  ├──────────────────┤  │  HDFCBANK  ×     │
│    │     │  │  [Alert Card]    │  │  INFY      ×     │
│ Blood.   │  │  [Alert Card]    │  │  ITC       ×     │
│    │     │  │  [Alert Card]    │  │                  │
│ Archeo.  │  └──────────────────┘  │  [+ Add Ticker]  │
│    │     │                        │                  │
│ Histor.  │                        │                  │
│    │     │                        │                  │
│ Oracle   │   [Demo Narrator]      │                  │
│    │     │    [Tooltip]           │                  │
│ Herald   │                        │                  │
├──────────┴────────────────────────┴──────────────────┤
│                                          [💬 Chat]   │
└─────────────────────────────────────────────────────┘
```

### Real-Time Updates
- Frontend connects to `ws://localhost:8000/ws/alerts`
- Each agent broadcasts status updates: `{type: "agent_status", agent: "bloodhound", status: "RUNNING"}`
- New alerts pushed as `{type: "new_alert", data: {alert: {...}}}`
- Pipeline completion: `{type: "pipeline_complete", data: {total_alerts: 5}}`
