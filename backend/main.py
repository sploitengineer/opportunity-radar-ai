"""
Opportunity Radar — FastAPI Backend
WebSocket for real-time agent updates + REST endpoints for data access.
"""
import asyncio
import json
import logging
import sys
import os
from datetime import datetime
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.master_agent import get_pipeline
from agents.storage import read_json, write_json, init_data_files
from agents.utils import setup_logging, build_ws_message
from backend.chat_handler import handle_chat_message
from config import (
    ALERTS_PATH, AUDIT_LOG_PATH, WATCHLIST_PATH,
    SIGNALS_PATH, CANDIDATE_SIGNALS_PATH,
    FRONTEND_URL, BACKEND_PORT
)

# Setup logging
setup_logging()
logger = logging.getLogger("opportunity_radar.api")

# ──────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────
app = FastAPI(
    title="Opportunity Radar",
    description="Multi-agent financial intelligence system for Indian retail investors",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# WebSocket Connection Manager
# ──────────────────────────────────────────────
class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients."""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        for conn in disconnected:
            self.active_connections.discard(conn)


manager = ConnectionManager()


# ──────────────────────────────────────────────
# WebSocket Endpoints
# ──────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    WebSocket endpoint for real-time agent status and alert updates.
    The frontend connects here to watch the pipeline animate.
    """
    await manager.connect(websocket)
    try:
        # Send initial state
        pipeline = get_pipeline()
        await websocket.send_json({
            "type": "connection_established",
            "status": pipeline.get_status(),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        })

        # Keep connection alive and listen for messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(data)

                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg.get("type") == "get_status":
                    await websocket.send_json({
                        "type": "status_update",
                        "status": pipeline.get_status(),
                    })

            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for the Radar Assistant chatbot."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            user_message = msg.get("message", "")
            if not user_message:
                continue

            # Get response from chat handler
            response = await handle_chat_message(user_message)

            await websocket.send_json({
                "type": "chat_response",
                "message": response,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })

    except WebSocketDisconnect:
        pass


# ──────────────────────────────────────────────
# REST Endpoints
# ──────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": "Opportunity Radar",
        "version": "1.0.0",
        "status": "running",
        "description": "Multi-agent financial intelligence system",
    }


@app.post("/api/trigger-scan")
async def trigger_scan():
    """
    ▶ Run Live Scan — triggers the full 7-agent pipeline.
    This is the demo button endpoint.
    """
    pipeline = get_pipeline()

    if pipeline.is_running:
        raise HTTPException(status_code=409, detail="A scan is already running")

    # Run pipeline in background, broadcast updates via WebSocket
    async def run_with_broadcast():
        await pipeline.run_pipeline(ws_callback=manager.broadcast)

    asyncio.create_task(run_with_broadcast())

    return {
        "status": "started",
        "message": "Pipeline scan initiated. Watch the dashboard for real-time updates.",
        "session_id": pipeline.current_state.get("session_id") if pipeline.current_state else None,
    }


@app.get("/api/pipeline-status")
async def get_pipeline_status():
    """Get current pipeline execution status."""
    pipeline = get_pipeline()
    return pipeline.get_status()


@app.get("/api/alerts")
async def get_alerts(status: Optional[str] = None):
    """Get all alerts, optionally filtered by status."""
    alerts = read_json(ALERTS_PATH)
    if not isinstance(alerts, list):
        alerts = []

    if status:
        alerts = [a for a in alerts if a.get("status") == status]

    # Sort by generated_at desc
    alerts.sort(key=lambda a: a.get("generated_at", ""), reverse=True)
    return {"alerts": alerts, "count": len(alerts)}


@app.get("/api/alerts/{alert_id}")
async def get_alert(alert_id: str):
    """Get a specific alert by ID."""
    alerts = read_json(ALERTS_PATH)
    if isinstance(alerts, list):
        for alert in alerts:
            if alert.get("alert_id") == alert_id:
                return alert
    raise HTTPException(status_code=404, detail="Alert not found")


@app.get("/api/signals")
async def get_signals():
    """Get all normalized signals."""
    signals = read_json(SIGNALS_PATH)
    return {"signals": signals if isinstance(signals, list) else [], "count": len(signals) if isinstance(signals, list) else 0}


@app.get("/api/clusters")
async def get_clusters():
    """Get all candidate clusters."""
    clusters = read_json(CANDIDATE_SIGNALS_PATH)
    return {"clusters": clusters if isinstance(clusters, list) else [], "count": len(clusters) if isinstance(clusters, list) else 0}


@app.get("/api/audit-log")
async def get_audit_log():
    """Get the full audit trail."""
    log = read_json(AUDIT_LOG_PATH)
    if isinstance(log, list):
        log.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return {"entries": log if isinstance(log, list) else [], "count": len(log) if isinstance(log, list) else 0}


@app.get("/api/watchlist")
async def get_watchlist():
    """Get the user's watchlist and preferences."""
    watchlist = read_json(WATCHLIST_PATH)
    return watchlist if isinstance(watchlist, dict) else {"tickers": [], "preferences": {}}


class WatchlistUpdate(BaseModel):
    tickers: Optional[List[str]] = None
    preferences: Optional[dict] = None


@app.post("/api/watchlist")
async def update_watchlist(update: WatchlistUpdate):
    """Update the user's watchlist."""
    current = read_json(WATCHLIST_PATH)
    if not isinstance(current, dict):
        current = {"tickers": [], "preferences": {}}

    if update.tickers is not None:
        current["tickers"] = update.tickers
    if update.preferences is not None:
        current["preferences"] = update.preferences

    write_json(WATCHLIST_PATH, current)
    return {"status": "updated", "watchlist": current}


class HITLAction(BaseModel):
    alert_id: str
    action: str  # APPROVE | REJECT
    reason: Optional[str] = None


@app.post("/api/hitl-action")
async def hitl_action(action: HITLAction):
    """Process a human-in-the-loop review action."""
    alerts = read_json(ALERTS_PATH)
    if not isinstance(alerts, list):
        raise HTTPException(status_code=404, detail="No alerts found")

    for alert in alerts:
        if alert.get("alert_id") == action.alert_id:
            if action.action == "APPROVE":
                alert["status"] = "DELIVERED"
                alert["delivered_at"] = datetime.utcnow().isoformat() + "Z"
            elif action.action == "REJECT":
                alert["status"] = "REJECTED"
                alert["rejection_reason"] = action.reason or ""

            write_json(ALERTS_PATH, alerts)

            # Broadcast update
            await manager.broadcast(build_ws_message(
                "hitl_action", "system", action.action,
                f"Alert {action.alert_id} was {action.action.lower()}ed",
                {"alert_id": action.alert_id, "action": action.action}
            ))

            return {"status": "processed", "alert_id": action.alert_id, "action": action.action}

    raise HTTPException(status_code=404, detail="Alert not found")


class ChatRequest(BaseModel):
    message: str


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """REST endpoint for Radar Assistant chatbot."""
    response = await handle_chat_message(request.message)
    return {"response": response}


@app.post("/api/reset-data")
async def reset_data():
    """Reset all data files to initial state. Useful for demo reset."""
    init_data_files()
    # Clear alerts and signals
    write_json(ALERTS_PATH, [])
    write_json(SIGNALS_PATH, [])
    write_json(CANDIDATE_SIGNALS_PATH, [])
    write_json(AUDIT_LOG_PATH, [])
    return {"status": "reset", "message": "All data files reset to initial state"}


# ──────────────────────────────────────────────
# Startup
# ──────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    """Initialize data files on server startup."""
    init_data_files()
    logger.info("🚀 Opportunity Radar API started")
    logger.info(f"📡 WebSocket: ws://localhost:{BACKEND_PORT}/ws/alerts")
    logger.info(f"💬 Chat: ws://localhost:{BACKEND_PORT}/ws/chat")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
