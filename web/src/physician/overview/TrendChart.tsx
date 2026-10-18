// Line graph of every patient's share of time compensating per session, with the patients needing attention in red.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../../patient/motion';
import { pct, stamp } from '../format';
import { ATTENTION_PCT } from '../severity';
import type { Entry } from './model';

const M = { top: 14, right: 132, bottom: 28, left: 40 };
const LABEL_GAP = 14;
const NAME_MAX = 16;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];
const X_TICKS = 4;
const MUTED = 'var(--color-ink-3)';
const HOT = 'var(--color-bad)';

interface Pt { x: number; y: number; t: number; v: number }
interface Line { entry: Entry; pts: Pt[]; hot: boolean; labelY: number }
interface Hover { id: string; i: number }

/** Spread label y positions so none are closer than `gap`, keeping their order. */
function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(ys.length);
  let prev = lo - gap;
  for (const [y, i] of order) { prev = Math.max(y, prev + gap); out[i] = prev; }
  for (let k = order.length - 1, next = hi + gap; k >= 0; k--) {
    const i = order[k][1];
    next = Math.min(out[i], next - gap);
    out[i] = next;
  }
  return out;
}

/** Shorten a long name for the line-end label. */
function short(name: string): string {
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name;
}

/** Responsive SVG line chart; hovering or focusing a line highlights it and shows a tooltip. */
export default function TrendChart({ entries }: { entries: Entry[] }) {
  const box = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const withData = useMemo(() => entries.filter((e) => e.series.length > 0), [entries]);
  const { w, h } = size;
  const pw = Math.max(w - M.left - M.right, 1);
  const ph = Math.max(h - M.top - M.bottom, 1);

  const { lines, t0, t1 } = useMemo(() => {
    const times = withData.flatMap((e) => e.series.map((r) => new Date(r.started_at).getTime()));
    const day = 86_400_000;
    let lo = Math.min(...times);
    let hi = Math.max(...times);
    if (hi - lo < day) { lo -= day / 2; hi += day / 2; }
    const xOf = (t: number) => M.left + 6 + ((t - lo) / (hi - lo)) * (pw - 12);
    const yOf = (v: number) => M.top + (1 - Math.min(Math.max(v, 0), 1)) * ph;
    const built = withData.map((entry): Line => {
      const pts = entry.series.map((r) => {
        const t = new Date(r.started_at).getTime();
        const v = r.pct_compensating ?? 0;
        return { x: xOf(t), y: yOf(v), t, v };
      });
      return { entry, pts, hot: entry.severity.level === 'attention', labelY: pts[pts.length - 1].y };
    });
    const spaced = spread(built.map((l) => l.labelY), LABEL_GAP, M.top + 4, M.top + ph - 2);
    built.forEach((l, i) => { l.labelY = spaced[i]; });
    return { lines: built, t0: lo, t1: hi };
  }, [withData, pw, ph]);

  const drawOrder = useMemo(() => lines.slice().sort((a, b) => Number(a.hot) - Number(b.hot)), [lines]);
  const active = hover ? lines.find((l) => l.entry.patient.id === hover.id) : undefined;
  const tipPoint = active?.pts[hover?.i ?? 0];

  /** Index of the point nearest the pointer along x. */
  const nearest = (line: Line, clientX: number): number => {
    const left = box.current?.getBoundingClientRect().left ?? 0;
    const x = clientX - left;
    return line.pts.reduce((best, p, i) => (Math.abs(p.x - x) < Math.abs(line.pts[best].x - x) ? i : best), 0);
  };

  if (!withData.length) {
    return <p className="grid h-full place-items-center px-6 text-center text-ink-2">No sessions yet: recordings appear here as patients finish them.</p>;
  }

  return (
    <div ref={box} className="relative size-full">
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="absolute inset-0 overflow-visible" role="group" aria-label="Share of time compensating per session, one line per patient">
          {Y_TICKS.map((v) => {
            const y = M.top + (1 - v) * ph;
            return (
              <g key={v}>
                <line x1={M.left} x2={M.left + pw} y1={y} y2={y} stroke="var(--color-hairline)" />
                <text x={M.left - 8} y={y + 4} textAnchor="end" className="tabular" fontSize="11" fill="var(--color-ink-3)">{Math.round(v * 100)}%</text>
              </g>
            );
          })}
          {Array.from({ length: X_TICKS }, (_, k) => {
            const t = t0 + ((t1 - t0) * k) / (X_TICKS - 1);
            const x = M.left + 6 + (k / (X_TICKS - 1)) * (pw - 12);
            return (
              <text key={k} x={x} y={h - 8} textAnchor={k === 0 ? 'start' : k === X_TICKS - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--color-ink-3)">
                {new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            );
          })}

          <line x1={M.left} x2={M.left + pw} y1={M.top + (1 - ATTENTION_PCT) * ph} y2={M.top + (1 - ATTENTION_PCT) * ph} stroke={HOT} strokeOpacity="0.55" strokeDasharray="4 4" />
          <text x={M.left + 4} y={M.top + (1 - ATTENTION_PCT) * ph - 5} fontSize="11" fill={HOT}>Needs attention</text>

          {drawOrder.map((line, k) => {
            const id = line.entry.patient.id;
            const color = line.hot ? HOT : MUTED;
            const focused = hover?.id === id;
            const dimmed = hover !== null && !focused;
            const last = line.pts[line.pts.length - 1];
            const d = line.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const level = line.hot ? ', needs attention' : '';
            return (
              <g
                key={id}
                tabIndex={0}
                role="img"
                aria-label={`${line.entry.patient.name}: ${pct(last.v)} at the latest session${level}`}
                style={{ opacity: dimmed ? 0.18 : 1, transition: 'opacity 200ms ease-out', outline: 'none', cursor: 'pointer' }}
                onPointerMove={(e) => setHover({ id, i: nearest(line, e.clientX) })}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover({ id, i: line.pts.length - 1 })}
                onBlur={() => setHover(null)}
              >
                {line.pts.length > 1 && (
                  <>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ strokeWidth: focused ? 3 : line.hot ? 2.25 : 1.5, transition: 'stroke-width 150ms ease-out' }}
                      initial={{ pathLength: reduced ? 1 : 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.7, ease: EASE_OUT, delay: k * 0.04 }}
                    />
                    <path d={d} fill="none" stroke="transparent" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
                <circle cx={last.x} cy={last.y} r={focused ? 5 : 3.5} fill={color} style={{ transition: 'r 150ms ease-out' }} />
                <circle cx={last.x} cy={last.y} r="12" fill="transparent" />
                {focused && hover && <circle cx={line.pts[hover.i].x} cy={line.pts[hover.i].y} r="4.5" fill="#fff" stroke={color} strokeWidth="2" />}
                <text
                  x={last.x + 10}
                  y={line.labelY + 4}
                  fontSize="12"
                  fontWeight={line.hot || focused ? 700 : 400}
                  fill={line.hot ? HOT : 'var(--color-ink-2)'}
                >
                  {short(line.entry.patient.name)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {active && tipPoint && (
        <div
          role="presentation"
          className="material-solid pointer-events-none absolute z-10 whitespace-nowrap px-3 py-2 text-[0.8125rem] leading-tight"
          style={{
            left: Math.min(Math.max(tipPoint.x, 80), Math.max(w - 80, 80)),
            top: tipPoint.y,
            transform: 'translate(-50%, calc(-100% - 12px))',
            borderRadius: 14,
          }}
        >
          <p className="font-display text-[0.95rem]">{active.entry.patient.name}</p>
          <p className="tabular text-ink-2">{stamp(new Date(tipPoint.t).toISOString())} · <span className={active.hot ? 'text-bad' : ''}>{pct(tipPoint.v)}</span></p>
        </div>
      )}
    </div>
  );
}
