"use client";

import { useState } from "react";
import Sparkline, { generateSparklineData } from "@/components/Sparkline";

function getConfidenceBadge(level, zScore) {
  const map = {
    HIGH_CONVICTION: { label: "High Conviction", bg: "var(--amber-100)", color: "var(--amber-600)" },
    STRONG: { label: "Strong", bg: "var(--blue-100)", color: "var(--blue-700)" },
    MODERATE: { label: "Moderate", bg: "var(--gray-200)", color: "var(--gray-500)" },
  };
  const badge = map[level] || map.MODERATE;
  return (
    <span
      className="alert-badge"
      style={{ background: badge.bg, color: badge.color }}
      title={`z-score: ${zScore}`}
    >
      {badge.label}
    </span>
  );
}

function getDaysRemaining(validUntil) {
  if (!validUntil) return null;
  const now = new Date();
  const expiry = new Date(validUntil);
  const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function AlertFeed({ alerts, onSelectAlert, selectedAlertId }) {
  const [filter, setFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");

  const SECTORS = {
    RELIANCE: "Energy",
    TCS: "Technology",
    HDFCBANK: "Banking",
    INFY: "Technology",
    ITC: "FMCG",
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter !== "all") {
      if (filter === "buy" && alert.direction !== "BUY") return false;
      if (filter === "sell" && alert.direction !== "SELL") return false;
      if (filter === "high" && alert.confidence_level !== "HIGH_CONVICTION" && alert.confidence_level !== "STRONG") return false;
    }
    if (sectorFilter !== "all") {
      const sector = SECTORS[alert.ticker] || "";
      if (sector !== sectorFilter) return false;
    }
    return true;
  });

  if (alerts.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "3rem 1rem",
        color: "var(--text-muted)",
      }}>
        <svg width="48" height="48" viewBox="0 0 20 20" fill="none" stroke="var(--gray-400)" strokeWidth="1.2" style={{ margin: "0 auto 0.75rem", display: "block" }}>
          <circle cx="10" cy="10" r="7" />
          <circle cx="10" cy="10" r="3" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="10" y1="16" x2="10" y2="19" />
          <line x1="1" y1="10" x2="4" y2="10" />
          <line x1="16" y1="10" x2="19" y2="10" />
        </svg>
        <h3 style={{ color: "var(--text-secondary)", marginBottom: "0.375rem" }}>No signals yet</h3>
        <p style={{ fontSize: "0.875rem" }}>
          Click <strong>▶ Run Live Scan</strong> to start the agent pipeline
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="filter-bar" role="group" aria-label="Signal filters">
        {[
          { key: "all", label: "All" },
          { key: "buy", label: "Buy Clusters", dot: "var(--green-500)" },
          { key: "sell", label: "Sell Clusters", dot: "var(--red-500)" },
          { key: "high", label: "High Confidence", dot: "var(--amber-500)" },
        ].map((f) => (
          <button
            key={f.key}
            className={`filter-chip ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.dot, display: "inline-block" }} />}
            {f.label}
          </button>
        ))}

        <span style={{ width: 1, height: 20, background: "var(--gray-200)", margin: "0 0.25rem" }} />

        {["all", "Energy", "Technology", "Banking", "FMCG"].map((s) => (
          <button
            key={s}
            className={`filter-chip ${sectorFilter === s ? "active" : ""}`}
            onClick={() => setSectorFilter(s)}
            aria-pressed={sectorFilter === s}
          >
            {s === "all" ? "All Sectors" : s}
          </button>
        ))}
      </div>

      {/* Alert Cards */}
      <div role="list" aria-label="Signal alerts">
        {filteredAlerts.map((alert) => (
          <AlertCard
            key={alert.alert_id}
            alert={alert}
            isSelected={selectedAlertId === alert.alert_id}
            onClick={() => onSelectAlert(alert)}
            sector={SECTORS[alert.ticker] || ""}
          />
        ))}
        {filteredAlerts.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
            No signals match the current filters.
          </p>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert, isSelected, onClick, sector }) {
  const [whyExpanded, setWhyExpanded] = useState(false);
  const direction = alert.direction || "BUY";
  const isBuy = direction === "BUY";
  const successRate = alert.backtest_summary?.success_rate || 0;
  const brief = alert.brief || {};
  const confidenceLevel = alert.confidence_level || (alert.z_score > 3.5 ? "HIGH_CONVICTION" : alert.z_score >= 2.5 ? "STRONG" : "MODERATE");
  const daysLeft = getDaysRemaining(alert.valid_until);
  const sparkData = generateSparklineData(alert.ticker, direction);
  const sources = alert.sources || [];
  const preview = alert.card_preview || brief.what_happened || "Signal detected — click to view full brief";

  return (
    <div
      className={`alert-card ${isBuy ? "buy" : "sell"}`}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      aria-label={`${alert.ticker} ${direction} signal, ${confidenceLevel}`}
      style={{
        marginBottom: "0.75rem",
        outline: isSelected ? "2px solid var(--blue-500)" : "none",
      }}
    >
      {/* Row 1: Ticker + Badges */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className="alert-ticker" onClick={onClick} style={{ cursor: "pointer" }}>{alert.ticker}</span>
          <span className={`alert-badge ${isBuy ? "buy" : "sell"}`}>
            {isBuy ? "↑ BUY" : "↓ SELL"}
          </span>
          {getConfidenceBadge(confidenceLevel, alert.z_score)}
          {alert.status === "REVIEW_REQUIRED" && (
            <span className="alert-badge" style={{ background: "var(--amber-100)", color: "var(--amber-600)" }}>
              ⚠ Review
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sector}</span>
      </div>

      {/* Row 2: Preview text + Sparkline */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem", alignItems: "flex-start" }}>
        <p onClick={onClick} style={{
          flex: 1,
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          cursor: "pointer",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          margin: 0,
        }}>
          {preview}
        </p>
        <div style={{ flexShrink: 0 }}>
          <Sparkline data={sparkData} clusterDate={alert.window_end} isBuy={isBuy} />
        </div>
      </div>

      {/* Row 3: Metrics */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}>
        <MetricPill label="z-score" value={alert.z_score || "—"} color={(alert.z_score || 0) >= 3 ? "var(--red-600)" : "var(--amber-600)"} />
        <MetricPill label="insiders" value={alert.insider_count || "—"} />
        <MetricPill label="value" value={`₹${alert.combined_value_cr || "—"} Cr`} />

        {/* Direction-aware backtest bar */}
        <div style={{ flex: 1, minWidth: "80px" }}>
          <div className="backtest-bar-container">
            <div className="backtest-bar">
              <div
                className={`backtest-bar-fill ${isBuy ? "" : "sell"}`}
                style={{ width: `${Math.round(successRate * 100)}%` }}
              />
            </div>
            <span className="backtest-label">
              {Math.round(successRate * 100)}% win
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: "Why this matters" expandable */}
      {brief.why_it_matters && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setWhyExpanded(!whyExpanded); }}
            style={{
              background: "none",
              border: "none",
              padding: "0.25rem 0",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--blue-700)",
              fontFamily: "var(--font-body)",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
            aria-expanded={whyExpanded}
            aria-label="Toggle why this matters section"
          >
            <span style={{
              display: "inline-block",
              transition: "transform 0.2s",
              transform: whyExpanded ? "rotate(90deg)" : "rotate(0deg)",
              fontSize: "0.625rem",
            }}>▶</span>
            Why this matters
          </button>
          {whyExpanded && (
            <p style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              padding: "0.375rem 0 0.375rem 1rem",
              borderLeft: "2px solid var(--blue-100)",
              margin: "0.25rem 0 0 0",
              animation: "fadeIn 0.2s ease-out",
            }}>
              {brief.why_it_matters}
            </p>
          )}
        </div>
      )}

      {/* Row 5: Footer — Expiry + Provenance */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "0.5rem",
        paddingTop: "0.375rem",
        borderTop: "1px solid var(--gray-100)",
      }}>
        {/* Signal expiry */}
        <div>
          {daysLeft !== null && (
            <span className="mono" style={{
              fontSize: "0.625rem",
              color: daysLeft <= 5 ? "var(--red-500)" : "var(--text-muted)",
              letterSpacing: "0.02em",
            }}>
              {daysLeft <= 0 ? "EXPIRED" : `Expires in ${daysLeft} days`}
            </span>
          )}
        </div>

        {/* Data provenance */}
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {(sources.length > 0 ? sources : [
            { label: "SEBI PIT", url: "https://www.sebi.gov.in" },
            { label: "NSE Bulk", url: "https://www.nseindia.com" },
            { label: "BSE Filing", url: "https://www.bseindia.com" },
          ]).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: "0.5625rem",
                color: "var(--blue-600)",
                textDecoration: "none",
                padding: "0.0625rem 0.375rem",
                background: "var(--blue-50)",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--blue-100)",
                whiteSpace: "nowrap",
              }}
              title={`Open ${s.label}`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{label}</span>
      <span className="mono" style={{
        fontWeight: 700,
        fontSize: "0.8125rem",
        color: color || "var(--text-primary)",
      }}>
        {value}
      </span>
    </div>
  );
}
