import "./globals.css";

export const metadata = {
  title: "Opportunity Radar — AI Market Intelligence",
  description: "Multi-agent financial intelligence system that detects insider trading clusters and surfaces actionable signals for Indian retail investors. Built for ET Markets AI Hackathon 2026.",
  keywords: "opportunity radar, insider trading, Indian stocks, AI, multi-agent, SEBI, NSE, BSE",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📡</text></svg>" />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
