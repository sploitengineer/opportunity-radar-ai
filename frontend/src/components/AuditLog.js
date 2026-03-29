"use client";

export default function AuditLog({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "3rem 1rem",
        color: "var(--text-muted)",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
        <p style={{ fontSize: "0.875rem" }}>
          Run a scan to see the agent decision audit trail.
        </p>
      </div>
    );
  }

  const AGENT_COLORS = {
    Sentinel: "var(--agent-sentinel)",
    Cartographer: "var(--agent-cartographer)",
    Bloodhound: "var(--agent-bloodhound)",
    Archaeologist: "var(--agent-archaeologist)",
    Historian: "var(--agent-historian)",
    Oracle: "var(--agent-oracle)",
    Herald: "var(--agent-herald)",
  };

  const exportCSV = () => {
    const headers = ["Timestamp", "Agent", "Decision", "Reasoning", "Latency (ms)", "Input Hash", "Output Hash"];
    const rows = entries.map((e) => [
      e.timestamp,
      e.agent,
      e.decision,
      `"${(e.reasoning_snippet || "").replace(/"/g, '""')}"`,
      e.latency_ms,
      e.input_hash,
      e.output_hash,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.75rem",
      }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          {entries.length} decisions logged
        </span>
        <button
          className="btn btn-ghost"
          onClick={exportCSV}
          style={{ fontSize: "0.75rem" }}
          aria-label="Export audit log as CSV"
        >
          📥 Export CSV
        </button>
      </div>

      <div role="list" aria-label="Agent audit trail">
        {entries.map((entry, i) => {
          const color = AGENT_COLORS[entry.agent] || "var(--blue-700)";
          const time = entry.timestamp
            ? new Date(entry.timestamp).toLocaleTimeString()
            : "";

          return (
            <div key={i} className="audit-entry" role="listitem">
              <div>
                <span
                  className="audit-agent-badge"
                  style={{ background: `${color}15`, color }}
                >
                  {entry.agent}
                </span>
              </div>
              <div>
                <div className="audit-decision">{entry.decision}</div>
                {entry.reasoning_snippet && (
                  <div className="audit-reasoning">{entry.reasoning_snippet}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="audit-time">{time}</div>
                <div className="mono" style={{
                  fontSize: "0.625rem",
                  color: "var(--text-muted)",
                }}>
                  {entry.latency_ms}ms
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
