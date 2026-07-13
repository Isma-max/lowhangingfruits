"use client";

interface Point {
  x: number;
  y: number;
}

function catmullRom(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function buildChart(values: number[], w: number, h: number, padTop: number) {
  const max = Math.max(...values);
  const min = Math.min(...values) * 0.85;
  const range = max - min || 1;
  const points = values.map((v, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * w : w / 2,
    y: padTop + (h - padTop) * (1 - (v - min) / range),
  }));
  const linePath = catmullRom(points);
  const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;
  return { points, linePath, areaPath };
}

/** Ported from the Wemul Design System's YouTube Dashboard mock — same catmull-rom smoothing, now driven by real data. */
export function TimeSeriesChart({
  values,
  labels,
  color = "var(--blue-500)",
  areaColor = "var(--blue-50)",
  width = 640,
  height = 220,
}: {
  values: number[];
  labels: string[];
  color?: string;
  areaColor?: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontFamily: "var(--font-text)" }}>
        Sin datos diarios para graficar.
      </div>
    );
  }

  const chart = buildChart(values, width, height, 20);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, overflow: "visible" }}>
        <line x1={0} y1={20} x2={width} y2={20} stroke="var(--border-subtle)" strokeWidth={1} />
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="var(--border-subtle)" strokeWidth={1} />
        <line x1={0} y1={height - 20} x2={width} y2={height - 20} stroke="var(--border-subtle)" strokeWidth={1} />
        <path d={chart.areaPath} fill={areaColor} />
        <path d={chart.linePath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        {chart.points.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={4} fill="#fff" stroke={color} strokeWidth={2.5} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {labels.map((lbl, i) => (
          <span key={i} style={{ fontFamily: "var(--font-text)", fontSize: "0.7rem", color: "var(--text-faint)" }}>
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}
