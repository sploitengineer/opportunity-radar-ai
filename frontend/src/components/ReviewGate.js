"use client";

import { useState, useEffect } from "react";

export default function ReviewGate({ alert, onAction, onClose }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const brief = alert.brief || {};

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Signal review required">
        <div className="modal-header">
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--amber-500)" }}>⚠</span>
              High-Anomaly Signal Review
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              This signal has a z-score ≥ 3.5 and requires human review before delivery.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close review">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Signal Summary */}
          <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span className="alert-ticker">{alert.ticker}</span>
              <span className={`alert-badge ${alert.direction === "BUY" ? "buy" : "sell"}`}>
                {alert.direction === "BUY" ? "↑ BUY" : "↓ SELL"}
              </span>
              <span className="mono" style={{
                fontWeight: 700,
                color: "var(--red-600)",
                fontSize: "0.875rem",
              }}>
                z = {alert.z_score}
              </span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              {brief.what_happened || "Signal requires review"}
            </p>
          </div>

          {/* Rejection reason */}
          <div style={{ marginBottom: "0.5rem" }}>
            <label
              htmlFor="review-reason"
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.375rem",
              }}
            >
              Rejection reason (optional)
            </label>
            <textarea
              id="review-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this signal should be rejected..."
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "0.625rem",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => onAction(alert.alert_id, "REJECT", reason)}
            style={{
              background: "var(--red-500)",
              color: "white",
            }}
          >
            ✕ Reject Signal
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onAction(alert.alert_id, "APPROVE")}
          >
            ✓ Approve & Deliver
          </button>
        </div>
      </div>
    </div>
  );
}
