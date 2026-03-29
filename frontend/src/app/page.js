"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TopBar from "@/components/TopBar";
import AgentPipeline from "@/components/AgentPipeline";
import AlertFeed from "@/components/AlertFeed";
import AlertDetail from "@/components/AlertDetail";
import WatchlistPanel from "@/components/WatchlistPanel";
import AuditLog from "@/components/AuditLog";
import ChatWidget from "@/components/ChatWidget";
import ReviewGate from "@/components/ReviewGate";
import SectorHeatmap from "@/components/SectorHeatmap";
import SignalTimeline from "@/components/SignalTimeline";
import DemoOverlay from "@/components/DemoOverlay";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/alerts";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  // ── State ──
  const [agentStatuses, setAgentStatuses] = useState({
    sentinel: "IDLE",
    cartographer: "IDLE",
    bloodhound: "IDLE",
    archaeologist: "IDLE",
    historian: "IDLE",
    oracle: "IDLE",
    herald: "IDLE",
  });
  const [agentMessages, setAgentMessages] = useState({});
  const [agentData, setAgentData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [signalCount, setSignalCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [activeTab, setActiveTab] = useState("alerts"); // alerts | audit | heatmap
  const [reviewAlert, setReviewAlert] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [groqKeyIndex, setGroqKeyIndex] = useState(0);
  const [demoMode, setDemoMode] = useState(true); // Demo narration ON by default

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // ── WebSocket Connection ──
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      reconnectRef.current = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => {};

    wsRef.current = ws;
  }, []);

  const handleWSMessage = useCallback((msg) => {
    const { type, agent, status, message, data } = msg;

    switch (type) {
      case "agent_status":
        setAgentStatuses((prev) => ({ ...prev, [agent]: status }));
        setAgentMessages((prev) => ({ ...prev, [agent]: message }));
        if (data) setAgentData((prev) => ({ ...prev, [agent]: data }));
        // Track groq key rotation
        if (data?.groq_key_index != null) {
          setGroqKeyIndex(data.groq_key_index);
        }
        break;

      case "new_alert":
        if (data?.alert) {
          setAlerts((prev) => [data.alert, ...prev]);
          setSignalCount((prev) => prev + 1);

          if (data.alert.status === "REVIEW_REQUIRED") {
            setReviewAlert(data.alert);
          }
        }
        break;

      case "pipeline_complete":
        setIsScanning(false);
        setPipelineComplete(true);
        setLastScanTime(new Date().toLocaleTimeString());
        if (data?.total_alerts) {
          setSignalCount(data.total_alerts);
        }
        setTimeout(() => setPipelineComplete(false), 3000);
        break;

      case "pipeline_error":
        setIsScanning(false);
        break;

      case "hitl_action":
        if (data?.alert_id) {
          setAlerts((prev) =>
            prev.map((a) =>
              a.alert_id === data.alert_id
                ? { ...a, status: data.action === "APPROVE" ? "DELIVERED" : "REJECTED" }
                : a
            )
          );
        }
        break;

      case "heartbeat":
      case "pong":
        break;
    }
  }, []);

  // ── Connect on mount ──
  useEffect(() => {
    connectWebSocket();
    fetchAlerts();
    fetchAuditLog();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // ── Ping interval ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts`);
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
      setSignalCount(data.count || 0);
    } catch (e) {}
  };

  const fetchAuditLog = async () => {
    try {
      const res = await fetch(`${API_URL}/api/audit-log`);
      const data = await res.json();
      if (data.entries) setAuditLog(data.entries);
    } catch (e) {}
  };

  // ── Trigger Scan ──
  const handleTriggerScan = async () => {
    if (isScanning) return;

    setIsScanning(true);
    setPipelineComplete(false);
    setAlerts([]);
    setSignalCount(0);

    setAgentStatuses({
      sentinel: "IDLE",
      cartographer: "IDLE",
      bloodhound: "IDLE",
      archaeologist: "IDLE",
      historian: "IDLE",
      oracle: "IDLE",
      herald: "IDLE",
    });
    setAgentMessages({});
    setAgentData({});

    try {
      await fetch(`${API_URL}/api/reset-data`, { method: "POST" });
    } catch (e) {}

    try {
      const res = await fetch(`${API_URL}/api/trigger-scan`, { method: "POST" });
      await res.json();
    } catch (e) {
      setIsScanning(false);
    }
  };

  // ── HITL Action ──
  const handleHITLAction = async (alertId, action, reason) => {
    try {
      await fetch(`${API_URL}/api/hitl-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alertId, action, reason }),
      });
      setReviewAlert(null);
    } catch (e) {}
  };

  const pendingReviewCount = alerts.filter((a) => a.status === "REVIEW_REQUIRED").length;

  return (
    <main id="main-content">
      <TopBar
        wsConnected={wsConnected}
        signalCount={signalCount}
        lastScanTime={lastScanTime}
        isScanning={isScanning}
        onTriggerScan={handleTriggerScan}
        pipelineComplete={pipelineComplete}
        groqKeyIndex={groqKeyIndex}
        pendingReviewCount={pendingReviewCount}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode(!demoMode)}
      />

      <div className="radar-layout" role="main" aria-label="Opportunity Radar Dashboard">
        {/* Left Panel — Agent Pipeline */}
        <aside className="panel" aria-label="Agent Pipeline Status">
          <div className="panel-header">
            <h2 className="panel-title">Agent Pipeline</h2>
          </div>
          <div className="panel-scrollable">
            <AgentPipeline
              statuses={agentStatuses}
              messages={agentMessages}
              data={agentData}
              isScanning={isScanning}
            />
          </div>
        </aside>

        {/* Center Panel */}
        <section className="panel" aria-label="Signal Intelligence">
          <div className="panel-header">
            <div className="tabs" role="tablist">
              <button
                className={`tab ${activeTab === "alerts" ? "active" : ""}`}
                onClick={() => setActiveTab("alerts")}
                role="tab"
                aria-selected={activeTab === "alerts"}
              >
                Signals ({alerts.length})
              </button>
              <button
                className={`tab ${activeTab === "heatmap" ? "active" : ""}`}
                onClick={() => setActiveTab("heatmap")}
                role="tab"
                aria-selected={activeTab === "heatmap"}
              >
                Sector Radar
              </button>
              <button
                className={`tab ${activeTab === "audit" ? "active" : ""}`}
                onClick={() => { setActiveTab("audit"); fetchAuditLog(); }}
                role="tab"
                aria-selected={activeTab === "audit"}
              >
                Audit Trail
              </button>
            </div>
          </div>
          <div className="panel-scrollable">
            {activeTab === "alerts" && (
              <div role="tabpanel">
                {/* Signal Timeline */}
                {selectedAlert && (
                  <SignalTimeline selectedAlert={selectedAlert} alerts={alerts} />
                )}
                <AlertFeed
                  alerts={alerts}
                  onSelectAlert={setSelectedAlert}
                  selectedAlertId={selectedAlert?.alert_id}
                />
              </div>
            )}
            {activeTab === "heatmap" && (
              <div role="tabpanel">
                <SectorHeatmap alerts={alerts} />
              </div>
            )}
            {activeTab === "audit" && (
              <div role="tabpanel">
                <AuditLog entries={auditLog} />
              </div>
            )}
          </div>
        </section>

        {/* Right Panel — Watchlist */}
        <aside className="panel" aria-label="Stock Watchlist">
          <div className="panel-header">
            <h2 className="panel-title">Watchlist</h2>
          </div>
          <div className="panel-scrollable">
            <WatchlistPanel apiUrl={API_URL} />
          </div>
        </aside>
      </div>

      {/* Alert Detail Slide-Over */}
      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

      {/* HITL Review Modal */}
      {reviewAlert && (
        <ReviewGate
          alert={reviewAlert}
          onAction={handleHITLAction}
          onClose={() => setReviewAlert(null)}
        />
      )}

      {/* Demo Narration Overlay */}
      <DemoOverlay
        agentStatuses={agentStatuses}
        isScanning={isScanning}
        enabled={demoMode}
      />

      {/* Chat Widget */}
      <ChatWidget apiUrl={API_URL} />

      {/* Regulatory Disclaimer Footer */}
      <footer style={{
        textAlign: "center",
        padding: "0.75rem 1.5rem",
        fontSize: "0.6875rem",
        color: "var(--text-muted)",
        borderTop: "1px solid var(--border-light)",
        background: "var(--bg-card)",
      }}>
        Opportunity Radar surfaces public regulatory data for informational purposes only. Not financial advice.
        Sources: <a href="https://www.sebi.gov.in" target="_blank" rel="noopener" style={{ color: "var(--blue-600)" }}>SEBI</a>,{" "}
        <a href="https://www.nseindia.com" target="_blank" rel="noopener" style={{ color: "var(--blue-600)" }}>NSE</a>,{" "}
        <a href="https://www.bseindia.com" target="_blank" rel="noopener" style={{ color: "var(--blue-600)" }}>BSE</a>
      </footer>
    </main>
  );
}
