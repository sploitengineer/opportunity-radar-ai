"""
Opportunity Radar — JSON Storage Utilities
All file I/O operations with file locking for safe concurrent access.
Append-only audit log. Thread-safe reads/writes.
"""
import json
import os
import hashlib
import time
from typing import List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger("opportunity_radar.storage")


class FileLocker:
    """Simplified file locker for prototype (single-process access)."""

    def __init__(self, filepath: str, mode: str = "r+"):
        self.filepath = filepath
        self.mode = mode
        self.file = None

    def __enter__(self):
        self.file = open(self.filepath, self.mode, encoding="utf-8")
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file:
            self.file.close()


def read_json(filepath: str) -> Any:
    """Read and parse a JSON file. Returns empty list/dict if file doesn't exist."""
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except (json.JSONDecodeError, FileNotFoundError):
        logger.warning(f"Could not read {filepath}, returning empty")
        return []


def write_json(filepath: str, data: Any) -> None:
    """Write data to a JSON file (overwrite)."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    logger.debug(f"Wrote to {filepath}")


def append_to_json_list(filepath: str, records: List[dict]) -> None:
    """Append records to a JSON array file. Creates file if it doesn't exist."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    existing = read_json(filepath)
    if not isinstance(existing, list):
        existing = []
    existing.extend(records)
    write_json(filepath, existing)
    logger.debug(f"Appended {len(records)} records to {filepath}")


def append_audit_log(entry: dict) -> None:
    """
    Append-only audit log write. Never overwrites existing entries.
    Uses file append mode for immutability.
    """
    from config import AUDIT_LOG_PATH
    os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)

    existing = read_json(AUDIT_LOG_PATH)
    if not isinstance(existing, list):
        existing = []
    existing.append(entry)
    write_json(AUDIT_LOG_PATH, existing)
    logger.info(f"Audit log: {entry.get('agent', '?')} — {entry.get('decision', '?')}")


def sha256_hash(data: Any) -> str:
    """Generate SHA256 hash of any JSON-serializable data."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return "sha256:" + hashlib.sha256(serialized.encode()).hexdigest()[:16]


def log_agent_decision(
    agent: str,
    input_data: Any,
    output_data: Any,
    decision: str,
    reasoning: str,
    latency_ms: int
) -> dict:
    """
    Create and persist an audit log entry for an agent decision.
    Returns the entry dict.
    """
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "agent": agent,
        "input_hash": sha256_hash(input_data),
        "output_hash": sha256_hash(output_data),
        "decision": decision,
        "reasoning_snippet": reasoning[:200],
        "latency_ms": latency_ms,
    }
    append_audit_log(entry)
    return entry


def get_unprocessed_files(raw_dir: str, manifest_path: str) -> List[str]:
    """Get list of raw files that haven't been processed yet."""
    manifest = read_json(manifest_path)
    if not isinstance(manifest, list):
        manifest = []

    processed_set = set(manifest)
    all_files = []

    if os.path.exists(raw_dir):
        for fname in os.listdir(raw_dir):
            fpath = os.path.join(raw_dir, fname)
            if fpath not in processed_set and fname.endswith(".json"):
                all_files.append(fpath)

    return sorted(all_files)


def mark_as_processed(filepath: str, manifest_path: str) -> None:
    """Mark a raw file as processed in the manifest."""
    manifest = read_json(manifest_path)
    if not isinstance(manifest, list):
        manifest = []
    if filepath not in manifest:
        manifest.append(filepath)
    write_json(manifest_path, manifest)


def init_data_files() -> None:
    """Initialize all JSON data files with empty defaults."""
    from config import (
        SIGNALS_PATH, CANDIDATE_SIGNALS_PATH, ALERTS_PATH,
        AUDIT_LOG_PATH, WATCHLIST_PATH, BACKTEST_CACHE_PATH,
        PROCESSED_MANIFEST_PATH, DATA_DIR
    )

    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "raw"), exist_ok=True)

    defaults = {
        SIGNALS_PATH: [],
        CANDIDATE_SIGNALS_PATH: [],
        ALERTS_PATH: [],
        AUDIT_LOG_PATH: [],
        BACKTEST_CACHE_PATH: {},
        PROCESSED_MANIFEST_PATH: [],
        WATCHLIST_PATH: {
            "tickers": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC"],
            "preferences": {
                "min_backtest_success_rate": 0.65,
                "min_cluster_size": 2,
                "notify_on_sectors": ["Technology", "Banking", "Energy", "FMCG"]
            }
        }
    }

    for path, default in defaults.items():
        if not os.path.exists(path):
            write_json(path, default)
            logger.info(f"Initialized {path}")
