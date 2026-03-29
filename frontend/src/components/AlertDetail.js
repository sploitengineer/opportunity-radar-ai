"use client";

import { useEffect } from "react";
import Sparkline, { generateSparklineData } from "@/components/Sparkline";

function getConfidenceBadge(level, zScore) {
  const map = {
    HIGH_CONVICTION: { label: "High Conviction", bg: "var(--amber-100)", color: "var(--amber-600)" },
    STRONG: { label: "Strong", bg: "var(--blue-100)", color: "var(--blue-700)" },
    MODERATE: { label: "Moderate", bg: "var(--gray-200)", color: "var(--gray-500)" },
  };
  const badge = map[level] || map.MODERATE;
  return (
    <span className="alert-badge" style={{ background: badge.bg, color: badge.color }} title={`z-score: ${zScore}`}>
      {badge.label}
    </span>
  );
}

export default function AlertDetail({ alert, onClose }) {
  const brief = alert.brief || {};
  const backtest = alert.backtest_summary || {};
  const citations = alert.citations || [];
  const sources = alert.sources || [];
  const confidenceLevel = alert.confidence_level || "MODERATE";
  const direction = alert.direction || "BUY";
  const isBuy = direction === "BUY";
  const sparkData = generateSparklineData(alert.ticker, direction);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const successCount = Math.round((backtest.success_rate || 0) * (backtest.sample_count || 0));

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="slide-over"
        role="dialog"
        aria-modal="true"
        aria-label={`Signal detail for ${alert.ticker}`}
        id="alert-detail-panel"
      >
        <div className="slide-over-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span className="alert-ticker" style={{ fontSize: "1.25rem" }}>{alert.ticker}</span>
            <span className={`alert-badge ${isBuy ? "buy" : "sell"}`} style={{ fontSize: "0.75rem" }}>
              {isBuy ? "↑ BUY" : "↓ SELL"} Cluster
            </span>
            {getConfidenceBadge(confidenceLevel, alert.z_score)}
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close detail panel"
            style={{ fontSize: "1.25rem" }}
          >
            ✕
          </button>
        </div>

        <div className="slide-over-body">
          {/* Key Metrics Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}>
            <MetricCard label="Z-Score" value={alert.z_score || "—"} color={
              (alert.z_score || 0) >= 3 ? "var(--red-600)" : "var(--amber-600)"
            } />
            <MetricCard label="Insiders" value={alert.insider_count || "—"} />
            <MetricCard label="Value" value={`₹${alert.combined_value_cr || "—"} Cr`} />
            <MetricCard
              label="Win Rate"
              value={`${Math.round((backtest.success_rate || 0) * 100)}%`}
              color={isBuy ? "var(--green-600)" : "var(--red-600)"}
            />
          </div>

          {/* Sparkline */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "0.75rem",
            background: "var(--gray-50)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}>
            <div style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              marginBottom: "0.5rem",
            }}>
              30-Day Price Movement
            </div>
            <Sparkline data={sparkData} width={450} height={60} clusterDate={alert.window_end} isBuy={isBuy} />
          </div>

          {/* Backtest Visual */}
          <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
            <h4 style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              marginBottom: "0.625rem",
            }}>
              Historical Back-Test
            </h4>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.5rem",
            }}>
              <div className="backtest-bar" style={{ flex: 1, height: 10 }}>
                <div
                  className={`backtest-bar-fill ${isBuy ? "" : "sell"}`}
                  style={{ width: `${Math.round((backtest.success_rate || 0) * 100)}%` }}
                />
              </div>
              <span className="mono" style={{ fontWeight: 700, fontSize: "1.125rem" }}>
                {Math.round((backtest.success_rate || 0) * 100)}% win rate
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              <span className="mono" style={{ fontWeight: 700 }}>{successCount}</span>
              {" "}of{" "}
              <span className="mono" style={{ fontWeight: 700 }}>{backtest.sample_count || 0}</span>
              {" "}similar signals led to &gt;5% gain in 30 days
              {backtest.avg_return_pct ? (
                <> — avg return <span className="mono" style={{ fontWeight: 700, color: isBuy ? "var(--green-600)" : "var(--red-600)" }}>
                  {isBuy ? "+" : ""}{backtest.avg_return_pct}%
                </span></>
              ) : null}
            </p>
          </div>

          {/* Brief Sections */}
          {brief.what_happened && (
            <BriefSection title="What Happened" content={brief.what_happened} />
          )}
          {brief.why_it_matters && (
            <BriefSection title="Why It Might Matter" content={brief.why_it_matters} highlight />
          )}
          {brief.the_numbers && (
            <BriefSection title="The Numbers" content={brief.the_numbers} mono />
          )}
          {brief.historical_odds && (
            <BriefSection title="Historical Odds" content={brief.historical_odds} />
          )}
          {brief.what_to_watch && (
            <BriefSection title="What to Watch" content={brief.what_to_watch} />
          )}

          {/* Data Provenance */}
          <div style={{ marginTop: "1.5rem" }}>
            <h4 style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              marginBottom: "0.5rem",
            }}>
              Data Sources
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {(sources.length > 0 ? sources : [
                { label: "SEBI PIT Disclosure", url: "https://www.sebi.gov.in" },
                { label: "NSE Bulk Deals", url: "https://www.nseindia.com" },
                { label: "BSE Corporate Filing", url: "https://www.bseindia.com" },
              ]).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="citation-pill"
                  style={{ textDecoration: "none" }}
                >
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                    <polyline points="12,2 12,6 16,6" />
                  </svg>
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Citations */}
          {citations.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h4 style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                marginBottom: "0.5rem",
              }}>
                Filing Citations
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {citations.map((c, i) => (
                  <span key={i} className="citation-pill" title={c.url || ""}>
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                      <polyline points="12,2 12,6 16,6" />
                    </svg>
                    {c.label}
                    {c.date ? ` — ${c.date}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Export as PDF + Export Brief */}
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
            <button
              className="btn btn-primary"
              onClick={() => exportAsPDF(alert)}
              aria-label="Export signal brief as PDF"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 14v3a1 1 0 001 1h12a1 1 0 001-1v-3" />
                <polyline points="7,10 10,13 13,10" />
                <line x1="10" y1="3" x2="10" y2="13" />
              </svg>
              Export as PDF
            </button>
            <button
              className="btn btn-outline"
              onClick={() => exportBrief(alert)}
              aria-label="Export signal brief as text file"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                <polyline points="12,2 12,6 16,6" />
              </svg>
              Export .txt
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function BriefSection({ title, content, mono, highlight }) {
  return (
    <div className="brief-section" style={highlight ? {
      background: "var(--blue-50)",
      padding: "0.75rem 1rem",
      borderRadius: "var(--radius-md)",
      marginBottom: "1.5rem",
      border: "1px solid var(--blue-100)",
    } : {}}>
      <h4>{title}</h4>
      <div style={{
        fontSize: mono ? "0.8125rem" : "0.9375rem",
        lineHeight: 1.7,
        color: "var(--text-secondary)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "0.625rem",
      background: "var(--gray-50)",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border-light)",
    }}>
      <div style={{
        fontSize: "0.6875rem",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: "0.25rem",
      }}>
        {label}
      </div>
      <div className="mono" style={{
        fontWeight: 700,
        fontSize: "1rem",
        color: color || "var(--text-primary)",
      }}>
        {value}
      </div>
    </div>
  );
}

function exportAsPDF(alert) {
  const brief = alert.brief || {};
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Signal Brief — ${alert.ticker}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; color: #1a2332; padding: 2rem; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
        h2 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8896a6; margin-top: 1.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
        .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .buy { background: #d1fae5; color: #059669; }
        .sell { background: #fee2e2; color: #dc2626; }
        .metrics { display: flex; gap: 1rem; margin: 1rem 0; }
        .metric { text-align: center; padding: 0.5rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .metric-label { font-size: 0.625rem; text-transform: uppercase; color: #8896a6; }
        .metric-value { font-family: 'Space Mono', monospace; font-weight: 700; font-size: 1rem; }
        .section { margin-bottom: 1rem; }
        .section p { font-size: 0.9375rem; line-height: 1.7; color: #5a6a7e; }
        .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #8896a6; }
        @media print { body { padding: 1rem; } }
      </style>
    </head>
    <body>
      <h1>${alert.ticker} <span class="badge ${alert.direction === 'BUY' ? 'buy' : 'sell'}">${alert.direction === 'BUY' ? '↑ BUY' : '↓ SELL'} Cluster</span></h1>
      <p style="color: #8896a6; font-size: 0.875rem;">Generated: ${new Date(alert.generated_at || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>

      <div class="metrics">
        <div class="metric"><div class="metric-label">Z-Score</div><div class="metric-value">${alert.z_score || '—'}</div></div>
        <div class="metric"><div class="metric-label">Insiders</div><div class="metric-value">${alert.insider_count || '—'}</div></div>
        <div class="metric"><div class="metric-label">Value</div><div class="metric-value">₹${alert.combined_value_cr || '—'} Cr</div></div>
        <div class="metric"><div class="metric-label">Win Rate</div><div class="metric-value">${Math.round((alert.backtest_summary?.success_rate || 0) * 100)}%</div></div>
      </div>

      ${brief.what_happened ? `<h2>What Happened</h2><div class="section"><p>${brief.what_happened}</p></div>` : ''}
      ${brief.why_it_matters ? `<h2>Why It Might Matter</h2><div class="section"><p>${brief.why_it_matters}</p></div>` : ''}
      ${brief.the_numbers ? `<h2>The Numbers</h2><div class="section"><p style="font-family: 'Space Mono', monospace; font-size: 0.8125rem;">${brief.the_numbers.replace(/\n/g, '<br>')}</p></div>` : ''}
      ${brief.historical_odds ? `<h2>Historical Odds</h2><div class="section"><p>${brief.historical_odds}</p></div>` : ''}
      ${brief.what_to_watch ? `<h2>What to Watch</h2><div class="section"><p>${brief.what_to_watch}</p></div>` : ''}

      <div class="footer">
        <p>Generated by <strong>Opportunity Radar</strong> — AI Market Intelligence System</p>
        <p>Sources: SEBI PIT Disclosure · NSE Bulk Deals · BSE Corporate Filing</p>
        <p>This is not financial advice. Based on public regulatory data for informational purposes only.</p>
      </div>

      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

function exportBrief(alert) {
  const brief = alert.brief || {};
  const text = [
    `OPPORTUNITY RADAR — Signal Brief`,
    `Ticker: ${alert.ticker}`,
    `Date: ${alert.generated_at || new Date().toISOString()}`,
    `Direction: ${alert.direction}`,
    `Z-Score: ${alert.z_score}`,
    `Confidence: ${alert.confidence_level || "N/A"}`,
    ``,
    `WHAT HAPPENED`,
    brief.what_happened || "",
    ``,
    `WHY IT MIGHT MATTER`,
    brief.why_it_matters || "",
    ``,
    `THE NUMBERS`,
    brief.the_numbers || "",
    ``,
    `HISTORICAL ODDS`,
    brief.historical_odds || "",
    ``,
    `WHAT TO WATCH`,
    brief.what_to_watch || "",
    ``,
    `---`,
    `Sources: SEBI PIT Disclosure · NSE Bulk Deals · BSE Corporate Filing`,
    `Generated by Opportunity Radar | AI Market Intelligence System`,
    `Not financial advice. Based on public regulatory data only.`,
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signal_${alert.ticker}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
