"""
Agent 3: Bloodhound — Insider Cluster Detection + Z-Score Anomaly Scoring
The core detection engine. Finds statistically significant insider trading clusters.
"""
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, List

from agents.state import OpportunityRadarState
from agents.storage import read_json, write_json, log_agent_decision
from agents.utils import Timer, build_ws_message, generate_id
from config import (
    SIGNALS_PATH, CANDIDATE_SIGNALS_PATH, DEMO_MODE, DEMO_AGENT_DELAYS,
    CLUSTER_WINDOW_DAYS, MIN_INSIDERS_FOR_CLUSTER,
    MIN_COMBINED_VALUE_INR, Z_SCORE_CANDIDATE, Z_SCORE_HITL_REVIEW
)

logger = logging.getLogger("opportunity_radar.bloodhound")


def parse_date(date_str: str) -> datetime:
    """Parse a date string into datetime."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return datetime.now()


def detect_clusters(signals: List[dict], window_days: int = 10) -> List[dict]:
    """
    Detect insider trading clusters.
    A cluster = 2+ insiders trading the same stock in the same direction
    within a rolling window.
    """
    # Filter only insider trades
    insider_trades = [
        s for s in signals
        if s.get("event_type") == "INSIDER_TRADE" and s.get("trade_direction")
    ]

    # Group by ticker + direction
    groups = defaultdict(list)
    for trade in insider_trades:
        key = (trade["ticker"], trade["trade_direction"])
        groups[key].append(trade)

    clusters = []

    for (ticker, direction), trades in groups.items():
        # Sort by date
        trades.sort(key=lambda t: t.get("date", ""))

        # Sliding window
        for i, anchor in enumerate(trades):
            anchor_date = parse_date(anchor.get("date", ""))
            window_end = anchor_date + timedelta(days=window_days)

            # Find all trades within window
            cluster_trades = [anchor]
            for j in range(i + 1, len(trades)):
                trade_date = parse_date(trades[j].get("date", ""))
                if trade_date <= window_end:
                    cluster_trades.append(trades[j])

            # Check cluster criteria
            if len(cluster_trades) >= MIN_INSIDERS_FOR_CLUSTER:
                # Get unique actors
                unique_actors = set(t.get("actor", "") for t in cluster_trades)
                if len(unique_actors) >= MIN_INSIDERS_FOR_CLUSTER:
                    combined_value = sum(
                        t.get("value_inr", 0) or 0 for t in cluster_trades
                    )

                    if combined_value >= MIN_COMBINED_VALUE_INR:
                        cluster = {
                            "cluster_id": generate_id("cls"),
                            "ticker": ticker,
                            "signal_type": "INSIDER_CLUSTER",
                            "insider_count": len(unique_actors),
                            "direction": direction,
                            "combined_value_inr": combined_value,
                            "window_start": cluster_trades[0].get("date", ""),
                            "window_end": cluster_trades[-1].get("date", ""),
                            "constituent_signal_ids": [t.get("id", "") for t in cluster_trades],
                            "actors": list(unique_actors),
                            "status": "CANDIDATE",
                        }
                        clusters.append(cluster)

    # Deduplicate clusters (same ticker+direction should only have one cluster)
    seen = set()
    unique_clusters = []
    for c in clusters:
        key = (c["ticker"], c["direction"], c["window_start"])
        if key not in seen:
            seen.add(key)
            unique_clusters.append(c)

    return unique_clusters


def compute_z_score(cluster: dict, all_signals: List[dict], baseline_days: int = 90) -> float:
    """
    Compute z-score for a cluster against baseline insider activity.
    Higher z-score = more anomalous = stronger signal.
    """
    ticker = cluster["ticker"]
    cluster_end = parse_date(cluster.get("window_end", ""))
    baseline_start = cluster_end - timedelta(days=baseline_days)

    # Count insider trades in baseline period
    baseline_trades = [
        s for s in all_signals
        if s.get("ticker") == ticker
        and s.get("event_type") == "INSIDER_TRADE"
        and baseline_start <= parse_date(s.get("date", "")) <= cluster_end
    ]

    # Simple z-score: (cluster_count - mean) / std
    # For prototype, use a simplified calculation
    baseline_count = len(baseline_trades)
    cluster_count = cluster["insider_count"]

    # Expected rate per 10-day window in a 90-day period = baseline_count / 9
    expected_per_window = max(baseline_count / (baseline_days / CLUSTER_WINDOW_DAYS), 0.5)

    # Standard deviation estimate (Poisson approximation)
    std = max(expected_per_window ** 0.5, 0.5)

    z_score = (cluster_count - expected_per_window) / std

    # Boost z-score based on combined value (higher value = stronger signal)
    value_cr = cluster["combined_value_inr"] / 10000000  # Convert to Cr
    if value_cr > 5:
        z_score *= 1.2
    if value_cr > 10:
        z_score *= 1.1

    return round(max(z_score, 0.5), 2)


async def bloodhound_node(state: OpportunityRadarState, ws_callback=None) -> dict:
    """
    Bloodhound Agent — detects insider trading clusters and scores anomalies.
    """
    logger.info("🔍 Bloodhound Agent — Scanning for insider clusters")

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "bloodhound", "RUNNING",
            "Analyzing insider trading patterns... detecting cluster signals..."
        ))

    with Timer() as timer:
        if DEMO_MODE:
            await asyncio.sleep(DEMO_AGENT_DELAYS.get("bloodhound", 6))

        all_signals = read_json(SIGNALS_PATH)

        # Detect clusters
        clusters = detect_clusters(all_signals)

        # Score each cluster
        for cluster in clusters:
            cluster["z_score"] = compute_z_score(cluster, all_signals)

            # Classify
            if cluster["z_score"] >= Z_SCORE_HITL_REVIEW:
                cluster["requires_hitl"] = True
            elif cluster["z_score"] >= Z_SCORE_CANDIDATE:
                cluster["requires_hitl"] = False

        # Filter to candidates only (z_score >= threshold)
        candidate_clusters = [
            c for c in clusters if c["z_score"] >= Z_SCORE_CANDIDATE
        ]
        high_anomaly = [
            c for c in candidate_clusters if c.get("requires_hitl", False)
        ]

        # Persist
        if candidate_clusters:
            write_json(CANDIDATE_SIGNALS_PATH, candidate_clusters)

        summary = (
            f"Detected {len(clusters)} total clusters, "
            f"{len(candidate_clusters)} candidates (z≥{Z_SCORE_CANDIDATE}), "
            f"{len(high_anomaly)} require HITL review (z≥{Z_SCORE_HITL_REVIEW})"
        )
        logger.info(summary)

    log_agent_decision(
        agent="Bloodhound",
        input_data={"signal_count": len(all_signals)},
        output_data={"cluster_count": len(candidate_clusters)},
        decision="CLUSTERS_DETECTED",
        reasoning=summary,
        latency_ms=timer.elapsed_ms,
    )

    if ws_callback:
        await ws_callback(build_ws_message(
            "agent_status", "bloodhound", "COMPLETE",
            summary,
            {
                "total_clusters": len(clusters),
                "candidates": len(candidate_clusters),
                "hitl_required": len(high_anomaly),
                "clusters": [
                    {
                        "ticker": c["ticker"],
                        "direction": c["direction"],
                        "insider_count": c["insider_count"],
                        "z_score": c["z_score"],
                        "combined_value_cr": round(c["combined_value_inr"] / 10000000, 2),
                    }
                    for c in candidate_clusters
                ]
            }
        ))

    return {
        "candidate_clusters": candidate_clusters,
        "high_anomaly_clusters": high_anomaly,
        "current_phase": "DETECTION",
        "agent_telemetry": state.get("agent_telemetry", []) + [{
            "agent": "Bloodhound",
            "status": "COMPLETE",
            "latency_ms": timer.elapsed_ms,
            "message": summary,
        }],
    }
