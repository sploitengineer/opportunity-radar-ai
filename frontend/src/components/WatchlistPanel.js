"use client";

import { useState, useEffect } from "react";

const STOCK_INFO = {
  RELIANCE: { sector: "Energy", name: "Reliance Industries" },
  TCS: { sector: "Technology", name: "Tata Consultancy Services" },
  HDFCBANK: { sector: "Banking", name: "HDFC Bank" },
  INFY: { sector: "Technology", name: "Infosys" },
  ITC: { sector: "FMCG", name: "ITC Ltd" },
  TATAMOTORS: { sector: "Auto", name: "Tata Motors" },
  WIPRO: { sector: "Technology", name: "Wipro" },
  SBIN: { sector: "Banking", name: "State Bank of India" },
  BHARTIARTL: { sector: "Telecom", name: "Bharti Airtel" },
  SUNPHARMA: { sector: "Pharma", name: "Sun Pharma" },
};

export default function WatchlistPanel({ apiUrl }) {
  const [watchlist, setWatchlist] = useState([]);
  const [addInput, setAddInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/watchlist`);
      const data = await res.json();
      setWatchlist(data.tickers || []);
    } catch (e) {
      setWatchlist(["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC"]);
    }
  };

  const addTicker = async (ticker) => {
    const upper = ticker.toUpperCase().trim();
    if (!upper || watchlist.includes(upper)) return;

    const updated = [...watchlist, upper];
    setWatchlist(updated);
    setAddInput("");
    setShowSuggestions(false);

    try {
      await fetch(`${apiUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: updated }),
      });
    } catch (e) {
      console.error("Failed to update watchlist");
    }
  };

  const removeTicker = async (ticker) => {
    const updated = watchlist.filter((t) => t !== ticker);
    setWatchlist(updated);

    try {
      await fetch(`${apiUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: updated }),
      });
    } catch (e) {
      console.error("Failed to update watchlist");
    }
  };

  const suggestions = Object.keys(STOCK_INFO).filter(
    (t) => !watchlist.includes(t) && t.includes(addInput.toUpperCase())
  );

  return (
    <div>
      {/* Add Ticker */}
      <div style={{ position: "relative", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <input
            type="text"
            className="chat-input"
            placeholder="Add ticker (e.g. SBIN)"
            value={addInput}
            onChange={(e) => {
              setAddInput(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTicker(addInput);
            }}
            onFocus={() => addInput && setShowSuggestions(true)}
            aria-label="Add stock ticker to watchlist"
            id="watchlist-add-input"
          />
          <button
            className="btn btn-primary"
            onClick={() => addTicker(addInput)}
            disabled={!addInput}
            style={{ padding: "0.375rem 0.75rem" }}
            aria-label="Add ticker"
          >
            +
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            zIndex: 10,
            maxHeight: "150px",
            overflowY: "auto",
          }}>
            {suggestions.slice(0, 5).map((t) => (
              <button
                key={t}
                onClick={() => addTicker(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8125rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.target.style.background = "var(--gray-50)"}
                onMouseLeave={(e) => e.target.style.background = "none"}
              >
                <span className="mono" style={{ fontWeight: 700 }}>{t}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  {STOCK_INFO[t]?.sector}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist Items */}
      <div role="list" aria-label="Watched stocks">
        {watchlist.map((ticker) => {
          const info = STOCK_INFO[ticker] || { sector: "—", name: ticker };
          return (
            <div
              key={ticker}
              className="watchlist-item"
              role="listitem"
            >
              <div>
                <div className="watchlist-ticker">{ticker}</div>
                <div className="watchlist-sector">{info.name}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-muted)",
                  padding: "0.125rem 0.5rem",
                  background: "var(--gray-50)",
                  borderRadius: "var(--radius-full)",
                }}>
                  {info.sector}
                </span>
                <button
                  className="watchlist-remove"
                  onClick={() => removeTicker(ticker)}
                  aria-label={`Remove ${ticker} from watchlist`}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {watchlist.length === 0 && (
        <p style={{
          textAlign: "center",
          color: "var(--text-muted)",
          padding: "2rem 1rem",
          fontSize: "0.875rem",
        }}>
          Add tickers to your watchlist to track signals.
        </p>
      )}
    </div>
  );
}
