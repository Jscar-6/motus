// Tiny inline trend of a patient's last sessions, drawn as one SVG polyline.

/** Sparkline of values in 0–1; needs at least two points. */
export default function Sparkline({ values, stroke, className }: { values: number[]; stroke: string; className?: string }) {
  if (values.length < 2) return null;
  const w = 64;
  const h = 24;
  const pad = 3;
  const points = values.map((v, i) => `${pad + (i / (values.length - 1)) * (w - 2 * pad)},${h - pad - Math.min(Math.max(v, 0), 1) * (h - 2 * pad)}`);
  const [lx, ly] = points[points.length - 1].split(',');
  return (
    <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className}>
      <polyline points={points.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.25" fill={stroke} />
    </svg>
  );
}
