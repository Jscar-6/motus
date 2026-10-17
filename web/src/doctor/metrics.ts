// The six live metrics shown in the math panel: how each is read, its formula text, and its display scale.
// Thresholds come only from FORWARD_REACH (lib/config.ts); the scales here are display ranges derived from them.
import { FORWARD_REACH } from '../lib/config';
import type { Level, LiveSample } from '../live/types';

export type MetricKey = 'lean' | 'hike' | 'rot' | 'elbow' | 'flex' | 'vis';

/** One row of the math panel. */
export interface Metric {
  key: MetricKey;
  label: string;
  unit: string;
  formula: string;
  digits: number;
  lo: number;                 // sparkline range, low end
  hi: number;                 // sparkline range, high end
  guides: number[];           // dashed threshold lines on the sparkline
  check?: 'lean' | 'hike' | 'rot';
  read: (s: LiveSample) => number | null;
}

const T = FORWARD_REACH.thresholds;

export const METRICS: Metric[] = [
  { key: 'lean', label: 'Trunk lean', unit: '°', formula: '∠(hip→shoulder, vertical) − rest', digits: 1, lo: -2 * T.lean, hi: 2 * T.lean, guides: [-T.lean, T.lean], check: 'lean', read: (s) => s.features?.leanDeg ?? null },
  { key: 'hike', label: 'Shoulder hike', unit: '', formula: '(rest ear–shoulder − now) ÷ trunk', digits: 2, lo: -T.hike, hi: 2 * T.hike, guides: [T.hike], check: 'hike', read: (s) => s.features?.hikeRatio ?? null },
  { key: 'rot', label: 'Trunk rotation', unit: '°', formula: 'Chest heading change − rest', digits: 1, lo: -2 * T.rot, hi: 2 * T.rot, guides: [-T.rot, T.rot], check: 'rot', read: (s) => s.features?.rotDeg ?? null },
  { key: 'elbow', label: 'Elbow angle', unit: '°', formula: '∠ shoulder · elbow · wrist', digits: 0, lo: 0, hi: 180, guides: [], read: (s) => s.features?.elbowDeg ?? null },
  { key: 'flex', label: 'Shoulder flexion', unit: '°', formula: '∠ hip · shoulder · wrist', digits: 0, lo: 0, hi: 180, guides: [], read: (s) => s.features?.shoulderFlexDeg ?? null },
  { key: 'vis', label: 'Visibility', unit: '', formula: 'min landmark visibility', digits: 2, lo: 0, hi: 1, guides: [FORWARD_REACH.visMin], read: (s) => s.features?.vis ?? null },
];

/** Rule level for a metric, or null when it has none (display-only metrics, skipped checks, no data). */
export function levelOf(metric: Metric, s: LiveSample): Level | null {
  if (metric.check) {
    const c = s.rules?.checks.find((x) => x.key === metric.check);
    return c && c.enabled ? c.level : null;
  }
  if (metric.key === 'vis') return s.features ? (s.features.vis < FORWARD_REACH.visMin ? 'over' : 'ok') : null;
  return null;
}

/** Fill fraction (0..1) of the threshold track: 0..2x threshold for checks, 0..1 for visibility, 0..180 for angles. */
export function fillOf(metric: Metric, value: number | null): number {
  if (value === null) return 0;
  const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
  switch (metric.key) {
    case 'lean': return clamp(Math.abs(value) / (2 * T.lean));
    case 'hike': return clamp(value / (2 * T.hike));
    case 'rot': return clamp(Math.abs(value) / (2 * T.rot));
    case 'vis': return clamp(value);
    default: return clamp(value / 180);
  }
}

/** Where the threshold tick sits on the track (0..1), or null for display-only metrics. */
export function tickOf(metric: Metric): number | null {
  if (metric.check) return 0.5;
  return metric.key === 'vis' ? FORWARD_REACH.visMin : null;
}
