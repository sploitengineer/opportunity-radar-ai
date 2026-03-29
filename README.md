# 📡 Opportunity Radar

**AI Market Intelligence System for Indian Retail Investors**

> Autonomous multi-agent system that detects insider trading clusters from public regulatory filings (SEBI, NSE, BSE) and surfaces actionable signals — with historical back-test validation and source-cited explanations.

🏆 **Built for ET Markets AI Hackathon 2026** | PS 6 — AI for the Indian Investor

---

## 🌐 Live Demo

| Component | URL |
|-----------|-----|
| Frontend Dashboard | `http://localhost:3000` |
| Backend API | `http://localhost:8000` |
| API Docs | `http://localhost:8000/docs` |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm

### 1. Clone & Setup Backend
```bash
git clone https://github.com/<your-repo>/opportunity-radar.git
cd opportunity-radar

# Install Python dependencies
python -m pip install -r requirements.txt

# Create .env file with API keys
cp .env.example .env
# Edit .env and add your Groq API keys + Tavily API key
```

### 2. Start Backend
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open Dashboard
Navigate to **http://localhost:3000** and click **▶ Run Live Scan**.

---

## 🧠 How It Works

Opportunity Radar uses a **7-agent pipeline** orchestrated via LangGraph:

```
📡 Sentinel → 🗺️ Cartographer → 🔍 Bloodhound → [📚 Archaeologist ∥ 📊 Historian] → 🧠 Oracle → 📢 Herald
```

1. **Sentinel** — Ingests market data (insider trades, block deals, quarterly results)
2. **Cartographer** — Normalizes events into a standard schema, deduplicates via SHA256
3. **Bloodhound** — Detects insider trading clusters using 10-day rolling windows + z-score anomaly scoring
4. **Archaeologist** — Retrieves relevant company filing context via FAISS RAG
5. **Historian** — Back-tests each signal against 3 years of historical price data (yfinance)
6. **Oracle** — Generates plain-English signal briefs using Groq LLM (llama-3.3-70b) with anti-hallucination policy
7. **Herald** — Delivers alerts to the real-time dashboard via WebSocket

Every step is logged to an immutable audit trail. Every claim is source-cited.

---

## 📊 Key Features

| Feature | Description |
|---------|-------------|
| **🔍 Insider Cluster Detection** | Detects when 2+ insiders trade the same stock in the same direction within 10 days |
| **📊 Historical Back-Testing** | Every signal includes historical success rate (e.g., "75% of similar signals led to >5% gain in 30 days") |
| **🧠 AI Signal Briefs** | Plain-English explanations with 5 structured sections — no jargon |
| **📄 Source Citations** | Every claim links back to the specific BSE/SEBI filing it came from |
| **⚡ Real-Time Dashboard** | WebSocket-powered 3-panel war room that updates as agents process |
| **📉 Sector Heatmap** | 5x2 grid showing insider activity intensity per sector with radar sweep animation |
| **⏳ Signal Timeline** | Clickable horizontal SVG timeline showing insider events on a date axis |
| **🎛️ Demo Narrator Overlay** | Tooltip system timed to agent completion events explaining the pipeline live |
| **⚠️ HITL Review Gate** | High-anomaly signals (z≥3.5) paused for human review before delivery |
| **📈 Dynamic Sparklines** | Real-time SVG 30-day price trend graphs with cluster date markers |
| **🛡️ Data Provenance & Export** | Clickable source links (SEBI, NSE) and PDF export capabilities with print CSS |
| **💬 Radar Assistant** | In-page AI chatbot that explains signals and financial terms to new investors |
| **📋 Audit Trail** | Complete, immutable log of every agent decision — exportable as CSV |
| **♿ Accessibility** | WCAG AA compliant — keyboard navigation, screen reader support, focus indicators |
---

## 🏗️ Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture document.

---

## 💰 Impact Model

See [IMPACT_MODEL.md](./IMPACT_MODEL.md) for the quantified business impact analysis.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python 3.13 |
| Agent Orchestration | LangGraph |
| LLM | Groq (llama-3.3-70b + llama-3.1-8b) with 3-key rotation |
| RAG | FAISS + sentence-transformers |
| Stock Data | yfinance |
| Search | Tavily |
| Frontend | Next.js 16 + React |
| Styling | Vanilla CSS (DM Sans + Space Mono) |
| Real-Time | WebSocket |
| Storage | JSON (prototype) |

---

## 📁 Project Structure

```
opportunity-radar/
├── agents/                    # 7 AI agents
│   ├── sentinel.py           # Data ingestion
│   ├── cartographer.py       # Normalize & dedup
│   ├── bloodhound.py         # Cluster detection + z-score
│   ├── archaeologist.py      # FAISS RAG
│   ├── historian.py          # Back-test scorer
│   ├── oracle.py             # LLM signal briefs
│   ├── herald.py             # Alert delivery
│   ├── master_agent.py       # LangGraph orchestrator
│   ├── state.py              # Shared state schema
│   ├── models.py             # Pydantic schemas
│   ├── prompts.py            # LLM prompt templates
│   ├── storage.py            # JSON operations
│   └── utils.py              # Groq key rotation, helpers
├── backend/
│   ├── main.py               # FastAPI + WebSocket
│   └── chat_handler.py       # Radar Assistant chatbot
├── frontend/                  # Next.js dashboard
│   └── src/
│       ├── app/page.js       # Main dashboard
│       └── components/       # 8 React components
├── data/                      # JSON data store
│   ├── incoming_feed.json    # Simulated market data
│   ├── historical_context.json
│   ├── signals.json
│   ├── candidate_signals.json
│   ├── alerts.json
│   └── audit_log.json
├── config.py                  # All thresholds & constants
├── requirements.txt
├── ARCHITECTURE.md
├── IMPACT_MODEL.md
└── README.md
```

---

## 👥 Team

| Name | Role |
|------|------|
| Member 1 | Backend + Agent Pipeline |
| Member 2 | Frontend + UI/UX |

---

## ⚠️ Note on Data

This prototype uses **pre-seeded realistic market data** fetched from public sources (NSE, BSE, SEBI archives) and stored in `data/incoming_feed.json`. The pipeline logic is production-ready — only the fetch mechanism is pre-run for demo stability. The grayed-out **LIVE MODE** toggle indicates this feature is planned for post-hackathon.

> Backend may take ~30 seconds to spin up on first load if deployed on Render free tier.

---

## 📜 License

MIT License — built for ET Markets AI Hackathon 2026.
