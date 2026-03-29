"use client";

import { useState, useEffect, useRef } from "react";

const DEMO_NARRATIONS = [
  {
    agent: "sentinel",
    title: "Sentinel: Data Ingestion",
    message: "Scanning 15 market events from SEBI PIT disclosures, NSE bulk deals, and BSE filings — covering RELIANCE, TCS, HDFCBANK, INFY, and ITC.",
    position: "right",
  },
  {
    agent: "cartographer",
    title: "Cartographer: Normalization",
    message: "Each event is normalized into a standard schema and hashed with SHA-256 to eliminate duplicates. Zero duplicates found in this batch.",
    position: "right",
  },
  {
    agent: "bloodhound",
    title: "Bloodhound: Anomaly Detection",
    message: "Found 3 insiders buying RELIANCE within 9 days — that's 3.54σ above the 90-day baseline. This is the kind of coordinated pattern that preceded a 12% rally in 2024.",
    position: "right",
  },
  {
    agent: "archaeologist",
    title: "Archaeologist: Filing Context",
    message: "Retrieving 8 relevant chunks from quarterly earnings filings and board announcements via semantic FAISS search — checking if management commentary supports the insider pattern.",
    position: "right",
  },
  {
    agent: "historian",
    title: "Historian: Back-Testing",
    message: "Cross-referencing against 3 years of price data via yfinance. Similar insider clusters on RELIANCE led to >5% gains 75% of the time within 30 days.",
    position: "right",
  },
  {
    agent: "oracle",
    title: "Oracle: AI Brief Generation",
    message: "Generating 5 plain-English signal briefs using Groq LLM with anti-hallucination guardrails. Every claim is cited back to the original filing source.",
    position: "right",
  },
  {
    agent: "herald",
    title: "Herald: Alert Delivery",
    message: "Delivering finalized signals to the dashboard via WebSocket. High-anomaly signals (z≥3.5) are paused for human review — see the HITL gate in action.",
    position: "right",
  },
];

export default function DemoOverlay({ agentStatuses, isScanning, enabled }) {
  const [currentNarration, setCurrentNarration] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const prevStatuses = useRef(agentStatuses);

  useEffect(() => {
    if (!enabled || !isScanning) {
      setCurrentNarration(null);
      setVisible(false);
      return;
    }

    // Detect which agent just went COMPLETE
    const agents = Object.keys(agentStatuses);
    for (const agent of agents) {
      if (
        agentStatuses[agent] === "COMPLETE" &&
        prevStatuses.current[agent] !== "COMPLETE" &&
        !dismissed.has(agent)
      ) {
        const narration = DEMO_NARRATIONS.find((n) => n.agent === agent);
        if (narration) {
          setCurrentNarration(narration);
          setVisible(true);

          // Auto-dismiss after 6 seconds
          const timer = setTimeout(() => {
            setVisible(false);
            setDismissed((prev) => new Set([...prev, agent]));
          }, 6000);

          prevStatuses.current = { ...agentStatuses };
          return () => clearTimeout(timer);
        }
      }
    }

    prevStatuses.current = { ...agentStatuses };
  }, [agentStatuses, enabled, isScanning, dismissed]);

  // Reset on new scan
  useEffect(() => {
    if (isScanning) {
      setDismissed(new Set());
    }
  }, [isScanning]);

  if (!currentNarration || !visible) return null;

  return (
    <div
      className="demo-overlay-tooltip"
      style={{
        position: "fixed",
        left: 310,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 300,
        maxWidth: 360,
        animation: "slideInLeft 0.4s ease-out",
      }}
      role="alert"
      aria-live="polite"
    >
      <div style={{
        background: "var(--blue-900)",
        color: "white",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.25rem",
        boxShadow: "0 12px 40px rgba(15, 37, 87, 0.35)",
        position: "relative",
      }}>
        {/* Arrow pointing left */}
        <div style={{
          position: "absolute",
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "8px solid var(--blue-900)",
        }} />

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--amber-400)",
          }}>
            {currentNarration.title}
          </span>
          <button
            onClick={() => {
              setVisible(false);
              setDismissed((prev) => new Set([...prev, currentNarration.agent]));
            }}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "0.875rem",
              padding: "0 0.25rem",
            }}
            aria-label="Dismiss narration"
          >
            ✕
          </button>
        </div>

        <p style={{
          fontSize: "0.8125rem",
          lineHeight: 1.6,
          color: "rgba(255,255,255,0.9)",
          margin: 0,
        }}>
          {currentNarration.message}
        </p>

        {/* Progress dots */}
        <div style={{
          display: "flex",
          gap: "0.25rem",
          marginTop: "0.625rem",
          justifyContent: "center",
        }}>
          {DEMO_NARRATIONS.map((n, i) => (
            <span
              key={n.agent}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: dismissed.has(n.agent) || n.agent === currentNarration.agent
                  ? "var(--amber-400)"
                  : "rgba(255,255,255,0.2)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
