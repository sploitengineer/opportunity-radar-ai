"""
Opportunity Radar — Radar Assistant Chatbot Handler
Lightweight chatbot using Groq llama-3.1-8b to help users understand the dashboard.
"""
import asyncio
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.utils import get_groq_client, get_key_rotator
from agents.storage import read_json
from agents.prompts import CHATBOT_SYSTEM_PROMPT, CHATBOT_USER_PROMPT
from config import ALERTS_PATH, GROQ_MODEL_LIGHT

logger = logging.getLogger("opportunity_radar.chatbot")


def get_dashboard_context() -> str:
    """Get current dashboard context for the chatbot."""
    alerts = read_json(ALERTS_PATH)
    if not isinstance(alerts, list):
        alerts = []

    delivered = [a for a in alerts if a.get("status") == "DELIVERED"]
    pending = [a for a in alerts if a.get("status") in ("PENDING_REVIEW", "REVIEW_REQUIRED")]

    return (
        f"Currently showing {len(delivered)} delivered alerts and {len(pending)} pending alerts. "
        f"Tickers with active alerts: {', '.join(set(a.get('ticker', '') for a in delivered))}"
    )


def get_recent_alerts_summary() -> str:
    """Get a summary of recent alerts for chatbot context."""
    alerts = read_json(ALERTS_PATH)
    if not isinstance(alerts, list) or not alerts:
        return "No active alerts on the dashboard."

    summaries = []
    for alert in alerts[:5]:  # Last 5
        ticker = alert.get("ticker", "?")
        direction = alert.get("direction", "?")
        z_score = alert.get("z_score", 0)
        brief = alert.get("brief", {})
        what = brief.get("what_happened", "Signal detected") if isinstance(brief, dict) else "Signal detected"
        summaries.append(f"- {ticker}: {direction} cluster, z-score {z_score}. {what[:100]}")

    return "\n".join(summaries)


async def handle_chat_message(user_message: str) -> str:
    """
    Process a user chat message and return the assistant's response.
    Uses Groq llama-3.1-8b for fast, lightweight responses.
    """
    try:
        dashboard_context = get_dashboard_context()
        recent_alerts = get_recent_alerts_summary()

        system_prompt = CHATBOT_SYSTEM_PROMPT.format(
            dashboard_context=dashboard_context
        )
        user_prompt = CHATBOT_USER_PROMPT.format(
            user_message=user_message,
            recent_alerts=recent_alerts,
        )

        llm = get_groq_client(GROQ_MODEL_LIGHT)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = await asyncio.to_thread(
            lambda: llm.invoke(messages).content
        )

        return response.strip()

    except Exception as e:
        error_msg = str(e).lower()
        if "rate_limit" in error_msg or "429" in error_msg:
            rotator = get_key_rotator()
            rotator.report_error()
            return "I'm experiencing high traffic right now. Please try again in a few seconds."

        logger.error(f"Chat handler error: {e}")
        return (
            "I'm having trouble connecting right now. "
            "In the meantime, here's what I can help with:\n"
            "- Explaining what signal alerts mean\n"
            "- Defining financial terms (z-score, insider trading, bulk deals)\n"
            "- How the agent pipeline works\n"
            "Please try your question again shortly."
        )
