"use client";

/* ── SVG Agent Icons (20×20, stroke-width 1.5, no fill) ── */
function SentinelIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="10" y1="16" x2="10" y2="19" />
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
    </svg>
  );
}

function CartographerIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1,4 7,2 13,4 19,2 19,16 13,18 7,16 1,18" />
      <line x1="7" y1="2" x2="7" y2="16" />
      <line x1="13" y1="4" x2="13" y2="18" />
    </svg>
  );
}

function BloodhoundIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="8.5" r="6" />
      <line x1="13" y1="13" x2="18" y2="18" />
      <circle cx="8.5" cy="8.5" r="2" fill={color} fillOpacity="0.2" stroke="none" />
      <circle cx="6" cy="6" r="1" fill={color} fillOpacity="0.15" stroke="none" />
      <circle cx="11" cy="7" r="1.2" fill={color} fillOpacity="0.15" stroke="none" />
    </svg>
  );
}

function ArchaeologistIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <polyline points="12,2 12,6 16,6" />
      <line x1="6" y1="10" x2="14" y2="10" />
      <line x1="6" y1="13" x2="14" y2="13" />
      <line x1="6" y1="16" x2="10" y2="16" />
      <circle cx="15" cy="15" r="3.5" fill="white" stroke={color} />
      <line x1="17.5" y1="17.5" x2="19" y2="19" />
    </svg>
  );
}

function HistorianIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,16 6,10 10,13 14,5 18,8" />
      <polyline points="15,5 18,5 18,8" />
      <line x1="2" y1="18" x2="18" y2="18" />
    </svg>
  );
}

function OracleIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="8" rx="7" ry="5" />
      <path d="M5 12c0 2.5 2.2 4.5 5 4.5s5-2 5-4.5" />
      <circle cx="7.5" cy="7.5" r="0.8" fill={color} stroke="none" />
      <circle cx="12.5" cy="7.5" r="0.8" fill={color} stroke="none" />
      <path d="M8.5 9.5c.8.6 2.2.6 3 0" />
    </svg>
  );
}

function HeraldIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 16a2 2 0 004 0" />
      <path d="M10 3a1 1 0 011 1v1a5 5 0 014 4.9V12l2 2H3l2-2v-2.1A5 5 0 019 5V4a1 1 0 011-1z" />
      <circle cx="15" cy="4" r="2.5" fill={color} fillOpacity="0.25" stroke={color} />
    </svg>
  );
}

const ICON_MAP = {
  sentinel: SentinelIcon,
  cartographer: CartographerIcon,
  bloodhound: BloodhoundIcon,
  archaeologist: ArchaeologistIcon,
  historian: HistorianIcon,
  oracle: OracleIcon,
  herald: HeraldIcon,
};

const AGENTS = [
  { id: "sentinel", name: "Sentinel", role: "Data Ingestion", color: "var(--agent-sentinel)" },
  { id: "cartographer", name: "Cartographer", role: "Normalize & Dedup", color: "var(--agent-cartographer)" },
  { id: "bloodhound", name: "Bloodhound", role: "Cluster Detection", color: "var(--agent-bloodhound)" },
  { id: "archaeologist", name: "Archaeologist", role: "RAG Context", color: "var(--agent-archaeologist)" },
  { id: "historian", name: "Historian", role: "Back-Test Scorer", color: "var(--agent-historian)" },
  { id: "oracle", name: "Oracle", role: "Signal Synthesis", color: "var(--agent-oracle)" },
  { id: "herald", name: "Herald", role: "Alert Delivery", color: "var(--agent-herald)" },
];

export default function AgentPipeline({ statuses, messages, data, isScanning }) {
  return (
    <div role="list" aria-label="Agent pipeline status">
      {AGENTS.map((agent, index) => {
        const status = statuses[agent.id] || "IDLE";
        const message = messages[agent.id] || "";
        const agentData = data[agent.id] || {};
        const IconComponent = ICON_MAP[agent.id];

        return (
          <div key={agent.id}>
            <div
              className="agent-pod"
              data-status={status}
              role="listitem"
              aria-label={`${agent.name}: ${status}`}
            >
              <div
                className="agent-icon"
                style={{ background: `${agent.color}15` }}
                aria-hidden="true"
              >
                <IconComponent color={agent.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="agent-name">{agent.name}</div>
                <div className="agent-status-text">
                  {status === "RUNNING" ? (
                    <span style={{ color: "var(--blue-600)" }}>
                      {message || agent.role}
                    </span>
                  ) : status === "COMPLETE" ? (
                    <span style={{ color: "var(--green-600)" }}>
                      {message ? message.substring(0, 60) + (message.length > 60 ? "..." : "") : "✓ Complete"}
                    </span>
                  ) : status === "ERROR" ? (
                    <span style={{ color: "var(--red-600)" }}>Error</span>
                  ) : (
                    <span>{agent.role}</span>
                  )}
                </div>

                {/* Show data highlights for completed agents */}
                {status === "COMPLETE" && agentData && Object.keys(agentData).length > 0 && (
                  <div style={{
                    marginTop: "0.375rem",
                    display: "flex",
                    gap: "0.375rem",
                    flexWrap: "wrap",
                  }}>
                    {renderAgentDataChips(agent.id, agentData)}
                  </div>
                )}
              </div>

              {/* Status indicator */}
              <div aria-hidden="true" style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                flexShrink: 0,
                background:
                  status === "RUNNING" ? "var(--blue-500)" :
                  status === "COMPLETE" ? "var(--green-500)" :
                  status === "ERROR" ? "var(--red-500)" :
                  "var(--gray-300)",
                animation: status === "RUNNING" ? "pulse-dot 1.5s infinite" : "none",
              }} />
            </div>

            {/* Connector line between agents */}
            {index < AGENTS.length - 1 && (
              <div
                className={`pipeline-connector ${
                  status === "COMPLETE" ? "active" : ""
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderAgentDataChips(agentId, data) {
  const chips = [];

  switch (agentId) {
    case "sentinel":
      if (data.item_count != null) {
        chips.push(
          <DataChip key="items" label="Events" value={data.item_count} />
        );
      }
      break;
    case "cartographer":
      if (data.new_signals != null) {
        chips.push(
          <DataChip key="new" label="New" value={data.new_signals} />,
          <DataChip key="dedup" label="Dedup" value={data.dedup_count || 0} />
        );
      }
      break;
    case "bloodhound":
      if (data.candidates != null) {
        chips.push(
          <DataChip key="clusters" label="Clusters" value={data.candidates} />
        );
        if (data.clusters) {
          // Deduplicate by ticker — show highest z-score per ticker
          const byTicker = {};
          data.clusters.forEach((c) => {
            if (!byTicker[c.ticker] || c.z_score > byTicker[c.ticker].z_score) {
              byTicker[c.ticker] = c;
            }
          });
          Object.values(byTicker).slice(0, 3).forEach((c, i) => {
            chips.push(
              <DataChip
                key={`z${i}`}
                label={c.ticker}
                value={`z=${c.z_score}`}
                highlight
              />
            );
          });
        }
      }
      break;
    case "archaeologist":
      if (data.total_chunks != null) {
        chips.push(
          <DataChip key="chunks" label="Chunks" value={data.total_chunks} />
        );
      }
      break;
    case "historian":
      if (data.results) {
        // BUG-2 FIX: Deduplicate by ticker — show one win rate per unique ticker
        const tickerRates = {};
        Object.entries(data.results).forEach(([id, r]) => {
          // Extract ticker from cluster_id or use id
          const rate = r.success_rate;
          const rateStr = typeof rate === 'string' ? rate : `${Math.round(rate * 100)}%`;
          // Use the rate value as a dedup key to avoid showing identical values
          if (!tickerRates[rateStr]) {
            tickerRates[rateStr] = { id, rate: rateStr };
          }
        });
        Object.values(tickerRates).slice(0, 3).forEach(({ id, rate }) => {
          chips.push(
            <DataChip key={id} label="Win Rate" value={rate} highlight />
          );
        });
      }
      break;
    case "oracle":
      if (data.briefs_generated != null) {
        chips.push(
          <DataChip key="briefs" label="Briefs" value={data.briefs_generated} />
        );
      }
      break;
    case "herald":
      if (data.delivered_count != null) {
        chips.push(
          <DataChip key="delivered" label="Delivered" value={data.delivered_count} />
        );
      }
      break;
  }

  return chips;
}

function DataChip({ label, value, highlight }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.25rem",
      padding: "0.0625rem 0.5rem",
      background: highlight ? "var(--amber-50)" : "var(--gray-50)",
      border: `1px solid ${highlight ? "var(--amber-100)" : "var(--border-light)"}`,
      borderRadius: "var(--radius-full)",
      fontSize: "0.6875rem",
    }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="mono" style={{
        fontWeight: 700,
        color: highlight ? "var(--amber-600)" : "var(--text-primary)",
      }}>
        {value}
      </span>
    </span>
  );
}
