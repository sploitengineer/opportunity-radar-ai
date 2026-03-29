"use client";

export default function SignalTimeline({ selectedAlert, alerts }) {
  if (!selectedAlert) return null;

  const ticker = selectedAlert.ticker;
  const tickerAlerts = alerts.filter((a) => a.ticker === ticker);

  if (tickerAlerts.length === 0) return null;

  // Build timeline from window dates
  const events = [];
  tickerAlerts.forEach((alert) => {
    const actors = alert.actors || [];
    if (alert.window_start) {
      events.push({
        date: alert.window_start,
        type: "window_start",
        label: "Cluster Start",
        alert,
      });
    }
    actors.forEach((actor, i) => {
      const dayOffset = i * 3; // Spread events across the window
      events.push({
        date: alert.window_start || `2025-03-${15 + dayOffset}`,
        type: "insider_trade",
        label: actor,
        alert,
      });
    });
    if (alert.window_end) {
      events.push({
        date: alert.window_end,
        type: "window_end",
        label: "Cluster End",
        alert,
      });
    }
  });

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  const width = 600;
  const height = 64;
  const padding = 40;
  const usableWidth = width - padding * 2;

  // Parse date range
  const dates = events.map((e) => new Date(e.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 86400000; // At least 1 day

  const getX = (dateStr) => {
    const t = new Date(dateStr).getTime();
    return padding + ((t - minDate) / dateRange) * usableWidth;
  };

  // Cluster window highlight
  const clusterStart = selectedAlert.window_start ? getX(selectedAlert.window_start) : null;
  const clusterEnd = selectedAlert.window_end ? getX(selectedAlert.window_end) : null;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  return (
    <div style={{
      marginBottom: "0.75rem",
      padding: "0.625rem 0.75rem",
      background: "var(--bg-card)",
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius-md)",
      animation: "fadeIn 0.3s ease-out",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.375rem",
      }}>
        <span style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-muted)",
        }}>
          {ticker} — Insider Event Timeline
        </span>
        <span className="mono" style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
          {events.length} events
        </span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
        aria-label={`Timeline for ${ticker} with ${events.length} insider events`}
      >
        {/* Cluster window highlight */}
        {clusterStart != null && clusterEnd != null && (
          <rect
            x={clusterStart}
            y={8}
            width={Math.max(clusterEnd - clusterStart, 4)}
            height={height - 16}
            fill="var(--amber-400)"
            fillOpacity={0.15}
            rx={4}
          />
        )}

        {/* Base timeline axis */}
        <line
          x1={padding} y1={height / 2}
          x2={width - padding} y2={height / 2}
          stroke="var(--gray-300)" strokeWidth={1.5}
        />

        {/* Event markers */}
        {events.map((event, i) => {
          const x = getX(event.date);
          const isWindowBound = event.type === "window_start" || event.type === "window_end";
          const isTrade = event.type === "insider_trade";

          return (
            <g key={i}>
              {isWindowBound ? (
                <>
                  <line
                    x1={x} y1={12} x2={x} y2={height - 12}
                    stroke="var(--amber-500)"
                    strokeWidth={2}
                    strokeDasharray="3,2"
                  />
                  <text
                    x={x} y={10}
                    textAnchor="middle"
                    fill="var(--amber-600)"
                    fontSize="7"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                  >
                    {formatDate(event.date)}
                  </text>
                </>
              ) : isTrade ? (
                <>
                  <circle
                    cx={x}
                    cy={height / 2}
                    r={5}
                    fill={event.alert.direction === "BUY" ? "var(--green-500)" : "var(--red-500)"}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  <text
                    x={x} y={height - 4}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="6"
                    fontFamily="var(--font-body)"
                  >
                    {event.label.split(" ")[0]}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={padding} y={height - 2} fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">
          {events.length > 0 ? formatDate(events[0].date) : ""}
        </text>
        <text x={width - padding} y={height - 2} textAnchor="end" fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">
          {events.length > 0 ? formatDate(events[events.length - 1].date) : ""}
        </text>
      </svg>
    </div>
  );
}
