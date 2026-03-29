"use client";

const SECTORS = [
  { id: "energy", name: "Energy", tickers: ["RELIANCE"], color: "#f59e0b" },
  { id: "technology", name: "Technology", tickers: ["TCS", "INFY"], color: "#3b82f6" },
  { id: "banking", name: "Banking", tickers: ["HDFCBANK"], color: "#10b981" },
  { id: "fmcg", name: "FMCG", tickers: ["ITC"], color: "#8b5cf6" },
  { id: "auto", name: "Auto", tickers: ["TATAMOTORS"], color: "#ef4444" },
  { id: "pharma", name: "Pharma", tickers: ["SUNPHARMA"], color: "#06b6d4" },
  { id: "metal", name: "Metals", tickers: ["TATASTEEL"], color: "#64748b" },
  { id: "realty", name: "Realty", tickers: ["DLF"], color: "#d97706" },
  { id: "infra", name: "Infra", tickers: ["LARSEN"], color: "#059669" },
  { id: "telecom", name: "Telecom", tickers: ["BHARTIARTL"], color: "#7c3aed" },
];

export default function SectorHeatmap({ alerts }) {
  // Calculate activity per sector from alerts
  const sectorActivity = {};
  let maxActivity = 1;

  SECTORS.forEach((s) => {
    let activity = 0;
    let totalZ = 0;
    let direction = null;

    alerts.forEach((alert) => {
      if (s.tickers.some((t) => alert.ticker?.includes(t) || t.includes(alert.ticker))) {
        activity += alert.insider_count || 1;
        totalZ += alert.z_score || 0;
        direction = alert.direction;
      }
    });

    sectorActivity[s.id] = { activity, avgZ: activity > 0 ? totalZ / activity : 0, direction };
    if (activity > maxActivity) maxActivity = activity;
  });

  return (
    <div style={{ padding: "0.5rem 0" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "0.5rem",
      }}>
        {SECTORS.map((sector) => {
          const data = sectorActivity[sector.id];
          const intensity = data.activity / maxActivity;
          const hasActivity = data.activity > 0;

          return (
            <div
              key={sector.id}
              style={{
                position: "relative",
                aspectRatio: "1.3",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${hasActivity ? sector.color + "40" : "var(--border-light)"}`,
                background: hasActivity
                  ? `${sector.color}${Math.round(intensity * 30 + 5).toString(16).padStart(2, "0")}`
                  : "var(--gray-50)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
                transition: "all 0.3s ease",
                cursor: hasActivity ? "pointer" : "default",
                overflow: "hidden",
              }}
              title={hasActivity
                ? `${sector.name}: ${data.activity} insider trades, avg z-score ${data.avgZ.toFixed(1)}`
                : `${sector.name}: No activity`
              }
            >
              {/* Radar sweep animation for active sectors */}
              {hasActivity && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: `conic-gradient(from 0deg, transparent 0%, ${sector.color}15 ${intensity * 100}%, transparent ${intensity * 100}%)`,
                  animation: "radarSweep 4s linear infinite",
                  borderRadius: "inherit",
                }} />
              )}

              <span style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: hasActivity ? sector.color : "var(--text-muted)",
                position: "relative",
                zIndex: 1,
                textAlign: "center",
              }}>
                {sector.name}
              </span>

              {hasActivity && (
                <span className="mono" style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: sector.color,
                  position: "relative",
                  zIndex: 1,
                }}>
                  {data.activity} trades
                </span>
              )}

              {/* Activity intensity dots */}
              {hasActivity && (
                <div style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  gap: "2px",
                }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: i <= Math.ceil(intensity * 5) ? sector.color : "var(--gray-300)",
                        transition: "background 0.3s",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        marginTop: "0.75rem",
        fontSize: "0.625rem",
        color: "var(--text-muted)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 12, height: 6, borderRadius: 2, background: "var(--gray-200)" }} />
          Low
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 12, height: 6, borderRadius: 2, background: "var(--amber-400)" }} />
          Medium
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 12, height: 6, borderRadius: 2, background: "var(--red-500)" }} />
          High
        </span>
      </div>
    </div>
  );
}
