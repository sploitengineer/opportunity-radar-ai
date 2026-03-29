"use client";

function RadarLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="var(--blue-700)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="4" opacity="0.6" />
      <circle cx="10" cy="10" r="1.5" fill="var(--blue-700)" stroke="none" />
      <line x1="10" y1="3" x2="10" y2="10" />
      <line x1="10" y1="10" x2="14.5" y2="5.5" />
    </svg>
  );
}

export default function TopBar({
  wsConnected,
  signalCount,
  lastScanTime,
  isScanning,
  onTriggerScan,
  pipelineComplete,
  groqKeyIndex,
  pendingReviewCount,
  demoMode,
  onToggleDemo,
}) {
  const now = new Date();
  const hours = now.getHours();
  const isMarketHours = hours >= 9 && hours < 16;

  return (
    <header className="top-bar" role="banner">
      <div className="top-bar-brand">
        <RadarLogo />
        <div>
          <h1 className="top-bar-title">Opportunity Radar</h1>
          <span className="top-bar-subtitle">AI Market Intelligence System</span>
        </div>
      </div>

      <div className="top-bar-stats">
        {/* Market Status */}
        <div className="market-status" aria-label={`Market ${isMarketHours ? "open" : "closed"}`}>
          <span className={`market-dot ${isMarketHours ? "open" : "closed"}`} aria-hidden="true" />
          <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            {isMarketHours ? "Market Open" : "Market Closed"}
          </span>
        </div>

        {/* Signal Count */}
        <div className="stat-chip" aria-label={`${signalCount} signals detected`}>
          <span className="stat-chip-value">{signalCount}</span>
          <span className="stat-chip-label">Signals</span>
        </div>

        {/* Last Scan */}
        {lastScanTime && (
          <div className="stat-chip" aria-label={`Last scan at ${lastScanTime}`}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="10" cy="10" r="8" />
              <polyline points="10,5 10,10 14,12" />
            </svg>
            <span className="stat-chip-value" style={{ fontSize: "0.75rem" }}>{lastScanTime}</span>
          </div>
        )}

        {/* Groq API Key Indicator */}
        {groqKeyIndex != null && groqKeyIndex > 0 && (
          <div className="stat-chip" style={{
            background: "var(--amber-50)",
            borderColor: "var(--amber-100)",
          }} aria-label={`Groq API Key ${groqKeyIndex + 1} active`}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--amber-500)", display: "inline-block",
            }} />
            <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--amber-600)" }}>
              Key {groqKeyIndex + 1}
            </span>
          </div>
        )}

        {/* Pending Reviews (was "1 Issue" bug — now amber) */}
        {pendingReviewCount > 0 && (
          <div className="stat-chip" style={{
            background: "var(--amber-50)",
            borderColor: "var(--amber-200)",
            cursor: "pointer",
          }} aria-label={`${pendingReviewCount} pending review`}>
            <span style={{ fontSize: "0.75rem" }}>⚠</span>
            <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--amber-600)" }}>
              {pendingReviewCount}
            </span>
            <span style={{ fontSize: "0.6875rem", color: "var(--amber-600)" }}>
              Pending Review
            </span>
          </div>
        )}

        {/* Connection Status */}
        <div className="stat-chip" aria-label={wsConnected ? "Connected" : "Disconnected"}>
          <span
            className={`market-dot ${wsConnected ? "open" : "closed"}`}
            style={{ width: 6, height: 6 }}
            aria-hidden="true"
          />
          <span className="stat-chip-label" style={{ fontSize: "0.75rem" }}>
            {wsConnected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Demo Mode Toggle */}
        <button
          className="stat-chip"
          onClick={onToggleDemo}
          style={{
            cursor: "pointer",
            background: demoMode ? "var(--blue-50)" : "var(--gray-50)",
            borderColor: demoMode ? "var(--blue-200)" : "var(--border-light)",
          }}
          aria-label={`Demo narration ${demoMode ? "on" : "off"}`}
          title="Toggle demo narration overlay"
        >
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: demoMode ? "var(--blue-500)" : "var(--gray-400)",
            display: "inline-block",
          }} />
          <span style={{
            fontSize: "0.6875rem",
            color: demoMode ? "var(--blue-700)" : "var(--text-muted)",
            fontWeight: demoMode ? 600 : 400,
          }}>
            NARRATOR
          </span>
        </button>

        {/* LIVE MODE Toggle (grayed out) */}
        <div className="live-mode-toggle" title="Coming post-hackathon" aria-label="Live mode coming post-hackathon">
          <span className="toggle-dot" aria-hidden="true" />
          <span>LIVE MODE</span>
        </div>

        {/* Scan Button */}
        <button
          className="btn btn-scan"
          onClick={onTriggerScan}
          disabled={isScanning}
          aria-label={isScanning ? "Scan in progress" : "Run live scan"}
          id="trigger-scan-btn"
        >
          {isScanning ? (
            <>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              Scanning...
            </>
          ) : pipelineComplete ? (
            <>✓ Scan Complete</>
          ) : (
            <>▶ Run Live Scan</>
          )}
        </button>
      </div>
    </header>
  );
}
