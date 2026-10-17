// Decorative stippled arc tracing a forward reach (the designer's stipple motif); dots fade in along the path once, then stay still.
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from './motion';

interface Dot { x: number; y: number; r: number; o: number; order: number }

const P = [[70, 470], [230, 90], [800, 30], [1130, 300]] as const; // cubic Bezier: shoulder to hand
const STEPS = 72;
const DOT_STAGGER = 0.016;

/** Deterministic pseudo-random sequence so the stipple is identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Point and unit normal on the cubic at parameter t. */
function sample(t: number): { x: number; y: number; nx: number; ny: number } {
  const u = 1 - t;
  const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const d = [3 * u * u, 6 * u * t, 3 * t * t];
  const x = b.reduce((s, k, i) => s + k * P[i][0], 0);
  const y = b.reduce((s, k, i) => s + k * P[i][1], 0);
  const dx = d.reduce((s, k, i) => s + k * (P[i + 1][0] - P[i][0]), 0);
  const dy = d.reduce((s, k, i) => s + k * (P[i + 1][1] - P[i][1]), 0);
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, nx: -dy / len, ny: dx / len };
}

/** The main dots grow along the path; two scattered satellites per dot give the stipple texture. */
function buildDots(): Dot[] {
  const rand = mulberry32(7);
  const dots: Dot[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const s = sample(t);
    dots.push({ x: s.x, y: s.y, r: 2.4 + 4.6 * t, o: 0.16 + 0.4 * t, order: i });
    for (let k = 0; k < 2; k++) {
      const off = (rand() - 0.5) * 2 * (14 + 26 * rand());
      const along = (rand() - 0.5) * 14;
      dots.push({ x: s.x + s.nx * off + s.ny * along, y: s.y + s.ny * off - s.nx * along, r: 1.1 + rand() * 1.6, o: 0.08 + rand() * 0.16, order: i + 1 });
    }
  }
  return dots;
}

const DOTS = buildDots();

/** Absolutely positioned, non-interactive arc; place it behind the hero. */
export default function StippleArc({ className, delay = 0.5 }: { className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const when = (order: number) => (reduced ? 0 : delay + order * DOT_STAGGER);
  const end = when(STEPS + 1);
  const fade = (at: number) => ({ duration: reduced ? 0.2 : 0.45, delay: at, ease: EASE_OUT });
  return (
    <svg aria-hidden viewBox="0 0 1200 560" className={className} fill="currentColor">
      {DOTS.map((d, i) => (
        <motion.circle key={i} cx={d.x} cy={d.y} r={d.r} initial={{ opacity: 0 }} animate={{ opacity: d.o }} transition={fade(when(d.order))} />
      ))}
      <motion.circle cx={P[0][0]} cy={P[0][1]} r={13} fill="none" stroke="currentColor" strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} transition={fade(when(0))} />
      <motion.circle cx={P[3][0]} cy={P[3][1]} r={30} fill="none" stroke="var(--color-bad)" strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={fade(end)} />
      <motion.circle cx={P[3][0]} cy={P[3][1]} r={9} fill="var(--color-bad)" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={fade(end + 0.1)} />
    </svg>
  );
}
