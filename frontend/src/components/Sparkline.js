"use client";

export default function Sparkline({ data, width = 80, height = 24, clusterDate, isBuy }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(" L")}`;

  // Gradient fill below line
  const fillPoints = [
    `${width},${height}`,
    `0,${height}`,
    points[0],
    ...points.slice(1),
  ];
  const fillD = `M0,${height} L${points.join(" L")} L${width},${height} Z`;

  // Cluster marker position (last 10 days = ~33% from end)
  const markerX = clusterDate
    ? Math.max(0, Math.min(width, width * 0.7))
    : null;

  const lineColor = isBuy ? "var(--green-500)" : "var(--red-500)";
  const fillColor = isBuy ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {/* Gradient fill */}
      <path d={fillD} fill={fillColor} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5" />
      {/* Cluster date marker */}
      {markerX !== null && (
        <>
          <line
            x1={markerX} y1={0} x2={markerX} y2={height}
            stroke="var(--amber-500)" strokeWidth="1.5" strokeDasharray="2,2"
          />
          <circle cx={markerX} cy={height - ((data[Math.round(data.length * 0.7)] - min) / range) * (height - 4) - 2} r="2.5" fill="var(--amber-500)" />
        </>
      )}
    </svg>
  );
}

// Generate mock 30-day price data based on ticker hash
export function generateSparklineData(ticker, direction) {
  const seed = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rng = (i) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297;
    return x - Math.floor(x);
  };

  const data = [];
  let price = 1000 + (seed % 500);

  for (let i = 0; i < 30; i++) {
    const change = (rng(i) - 0.48) * 20;
    // Add trend in last 10 days matching direction
    if (i >= 20) {
      price += direction === "BUY" ? Math.abs(change) * 0.5 : -Math.abs(change) * 0.5;
    }
    price += change;
    data.push(Math.round(price * 100) / 100);
  }
  return data;
}
