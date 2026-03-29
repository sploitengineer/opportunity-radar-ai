"use client";

import { useState, useRef, useEffect } from "react";

export default function ChatWidget({ apiUrl }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hi! I'm the Radar Assistant. I can help you understand signals, explain financial terms, or answer questions about how the agent pipeline works. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response || "Sorry, I couldn't process that." },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble connecting. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const QUICK_QUESTIONS = [
    "What is a z-score?",
    "How does insider cluster detection work?",
    "What does the back-test percentage mean?",
  ];

  return (
    <div className="chat-widget-container">
      {isOpen && (
        <div className="chat-window" role="dialog" aria-label="Radar Assistant Chat">
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3>💬 Radar Assistant</h3>
                <p>Ask me about signals & terms</p>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setIsOpen(false)}
                style={{ color: "white", padding: "0.25rem" }}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="chat-messages" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                {msg.content}
              </div>
            ))}

            {isLoading && (
              <div className="chat-message assistant" style={{ opacity: 0.6 }}>
                <span style={{ animation: "pulse-dot 1s infinite" }}>Thinking...</span>
              </div>
            )}

            {/* Quick Questions (show after initial message only) */}
            {messages.length === 1 && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                marginTop: "0.25rem",
              }}>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="btn btn-outline"
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => {
                        setMessages((prev) => [...prev, { role: "user", content: q }]);
                        setInput("");
                        setIsLoading(true);

                        fetch(`${apiUrl}/api/chat`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ message: q }),
                        })
                          .then((r) => r.json())
                          .then((data) => {
                            setMessages((prev) => [
                              ...prev,
                              { role: "assistant", content: data.response },
                            ]);
                          })
                          .catch(() => {
                            setMessages((prev) => [
                              ...prev,
                              { role: "assistant", content: "Connection issue. Try again." },
                            ]);
                          })
                          .finally(() => setIsLoading(false));
                      }, 100);
                    }}
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.375rem 0.625rem",
                      textAlign: "left",
                      justifyContent: "flex-start",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-bar">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Ask about signals, terms..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              disabled={isLoading}
              aria-label="Chat message input"
              id="chat-input"
            />
            <button
              className="chat-send"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              →
            </button>
          </div>
        </div>
      )}

      <button
        className="chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close Radar Assistant" : "Open Radar Assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}
