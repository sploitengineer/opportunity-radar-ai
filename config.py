"""
Opportunity Radar — Configuration & Constants
All thresholds, API settings, and tunable parameters in one place.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# Groq API Key Rotation (3 keys)
# ──────────────────────────────────────────────
GROQ_API_KEYS = [
    os.getenv("GROQ_API_KEY", ""),
    os.getenv("GROQ_API_KEY_2", ""),
    os.getenv("GROQ_API_KEY_PREVIOUS", ""),
]
GROQ_API_KEYS = [k for k in GROQ_API_KEYS if k]  # Filter empty

# Models
GROQ_MODEL_HEAVY = "llama-3.3-70b-versatile"   # Oracle — signal briefs
GROQ_MODEL_LIGHT = "llama-3.1-8b-instant"      # Chatbot, Risk reviewer

# ──────────────────────────────────────────────
# Tavily Search
# ──────────────────────────────────────────────
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# ──────────────────────────────────────────────
# Signal Detection Thresholds
# ──────────────────────────────────────────────
CLUSTER_WINDOW_DAYS = 10          # Rolling window for insider cluster
MIN_INSIDERS_FOR_CLUSTER = 2     # Minimum insiders to trigger cluster
MIN_COMBINED_VALUE_INR = 5000000  # ₹50 lakh minimum combined value
Z_SCORE_CANDIDATE = 2.0          # Threshold for candidate signal
Z_SCORE_HITL_REVIEW = 3.5        # Threshold requiring human review

# ──────────────────────────────────────────────
# Backtesting
# ──────────────────────────────────────────────
BACKTEST_LOOKBACK_YEARS = 3
BACKTEST_GAIN_THRESHOLD = 0.05   # 5% gain threshold
BACKTEST_HORIZON_DAYS = 30       # Days after signal to measure return
BACKTEST_CACHE_TTL_DAYS = 7      # Cache TTL

# ──────────────────────────────────────────────
# RAG (FAISS)
# ──────────────────────────────────────────────
RAG_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
RAG_TOP_K = 5
RAG_CHUNK_SIZE = 500
RAG_CHUNK_OVERLAP = 50
RAG_MIN_CHUNKS_THRESHOLD = 2

# ──────────────────────────────────────────────
# File Paths
# ──────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAG_DIR = os.path.join(os.path.dirname(__file__), "data_rag", "rag_index")
LOGS_DIR = os.path.join(os.path.dirname(__file__), "logs")

# JSON data files
INCOMING_FEED_PATH = os.path.join(DATA_DIR, "incoming_feed.json")
SIGNALS_PATH = os.path.join(DATA_DIR, "signals.json")
CANDIDATE_SIGNALS_PATH = os.path.join(DATA_DIR, "candidate_signals.json")
ALERTS_PATH = os.path.join(DATA_DIR, "alerts.json")
AUDIT_LOG_PATH = os.path.join(DATA_DIR, "audit_log.json")
WATCHLIST_PATH = os.path.join(DATA_DIR, "watchlist.json")
BACKTEST_CACHE_PATH = os.path.join(DATA_DIR, "backtest_cache.json")
PROCESSED_MANIFEST_PATH = os.path.join(DATA_DIR, "processed_manifest.json")
HISTORICAL_CONTEXT_PATH = os.path.join(DATA_DIR, "historical_context.json")

# ──────────────────────────────────────────────
# WebSocket & Server
# ──────────────────────────────────────────────
BACKEND_HOST = "0.0.0.0"
BACKEND_PORT = 8000
FRONTEND_URL = "http://localhost:3000"
WS_RECONNECT_DELAY_SEC = 5

# ──────────────────────────────────────────────
# Demo Mode
# ──────────────────────────────────────────────
DEMO_MODE = True
DEMO_AGENT_DELAYS = {
    "sentinel": 3,
    "cartographer": 4,
    "bloodhound": 6,
    "archaeologist": 5,
    "historian": 3,
    "oracle": 8,
    "herald": 3,
}
# Total ~38 seconds pipeline animation for theatrical demo

# ──────────────────────────────────────────────
# Target Stocks (Prototype)
# ──────────────────────────────────────────────
TARGET_TICKERS = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ITC.NS"]
TICKER_DISPLAY_NAMES = {
    "RELIANCE.NS": "RELIANCE",
    "TCS.NS": "TCS",
    "HDFCBANK.NS": "HDFCBANK",
    "INFY.NS": "INFY",
    "ITC.NS": "ITC",
}
