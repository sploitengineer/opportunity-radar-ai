"""
Opportunity Radar — Utility Functions
Groq API key rotation, hashing, dedup, logging setup.
"""
import hashlib
import json
import time
import logging
import os
from typing import Any, Optional
from datetime import datetime

logger = logging.getLogger("opportunity_radar")

# ──────────────────────────────────────────────
# Groq API Key Rotation
# ──────────────────────────────────────────────
class GroqKeyRotator:
    """
    Rotates through multiple Groq API keys when rate limits are hit.
    Thread-safe. Tracks which key is currently active.
    """

    def __init__(self, keys: list[str]):
        self.keys = [k for k in keys if k]
        self.current_index = 0
        self.error_counts = {i: 0 for i in range(len(self.keys))}
        self.last_rotation_time = time.time()

    @property
    def current_key(self) -> str:
        if not self.keys:
            raise ValueError("No Groq API keys configured!")
        return self.keys[self.current_index]

    def rotate(self) -> str:
        """Rotate to the next available key. Returns the new key."""
        if len(self.keys) <= 1:
            logger.warning("Only one Groq key available, cannot rotate")
            return self.current_key

        old_index = self.current_index
        self.current_index = (self.current_index + 1) % len(self.keys)
        self.last_rotation_time = time.time()
        logger.info(f"Groq key rotated: key_{old_index} → key_{self.current_index}")
        return self.current_key

    def report_error(self) -> str:
        """Report a rate limit error on current key and rotate."""
        self.error_counts[self.current_index] = self.error_counts.get(self.current_index, 0) + 1
        logger.warning(
            f"Rate limit on key_{self.current_index} "
            f"(errors: {self.error_counts[self.current_index]}). Rotating..."
        )
        return self.rotate()

    def get_status(self) -> dict:
        """Get status of all keys."""
        return {
            "active_key_index": self.current_index,
            "total_keys": len(self.keys),
            "error_counts": self.error_counts,
            "last_rotation": datetime.fromtimestamp(self.last_rotation_time).isoformat(),
        }


# Global key rotator instance
_key_rotator: Optional[GroqKeyRotator] = None


def get_key_rotator() -> GroqKeyRotator:
    """Get or create the global Groq key rotator."""
    global _key_rotator
    if _key_rotator is None:
        from config import GROQ_API_KEYS
        _key_rotator = GroqKeyRotator(GROQ_API_KEYS)
    return _key_rotator


def get_groq_client(model: Optional[str] = None):
    """
    Get a Groq LangChain client with the current active key.
    Auto-rotates on rate limit errors.
    """
    from langchain_groq import ChatGroq
    from config import GROQ_MODEL_HEAVY

    rotator = get_key_rotator()
    return ChatGroq(
        api_key=rotator.current_key,
        model_name=model or GROQ_MODEL_HEAVY,
        temperature=0.1,
        max_tokens=2048,
    )


# ──────────────────────────────────────────────
# Hashing & Dedup
# ──────────────────────────────────────────────
def sha256(data: Any) -> str:
    """Generate a short SHA256 hash string."""
    if isinstance(data, str):
        payload = data
    else:
        payload = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def dedup_by_hash(records: list[dict], hash_field: str = "raw_hash") -> list[dict]:
    """Remove duplicate records based on their hash field."""
    seen = set()
    unique = []
    for record in records:
        h = record.get(hash_field, sha256(record))
        if h not in seen:
            seen.add(h)
            unique.append(record)
    return unique


# ──────────────────────────────────────────────
# ID Generation
# ──────────────────────────────────────────────
def generate_id(prefix: str) -> str:
    """Generate a unique ID with prefix and timestamp."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    short_hash = sha256(f"{prefix}{time.time()}")[:6]
    return f"{prefix}_{timestamp}_{short_hash}"


# ──────────────────────────────────────────────
# Logging Setup
# ──────────────────────────────────────────────
def setup_logging(log_level: str = "INFO") -> None:
    """Configure logging for the application."""
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)

    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(
                os.path.join(log_dir, "opportunity_radar.log"),
                encoding="utf-8"
            ),
        ],
    )


# ──────────────────────────────────────────────
# Timing Helper
# ──────────────────────────────────────────────
class Timer:
    """Simple context manager for timing operations."""

    def __init__(self):
        self.start_time = None
        self.elapsed_ms = 0

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, *args):
        self.elapsed_ms = int((time.time() - self.start_time) * 1000)


# ──────────────────────────────────────────────
# WebSocket Message Builder
# ──────────────────────────────────────────────
def build_ws_message(
    event_type: str,
    agent: str,
    status: str,
    message: str = "",
    data: Optional[dict] = None
) -> dict:
    """Build a standardized WebSocket message."""
    return {
        "type": event_type,
        "agent": agent,
        "status": status,
        "message": message,
        "data": data or {},
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
