// Builds the compact, measured-numbers-only summary that the coach (Gemini or template) is given.
import { FORWARD_REACH } from '../../lib/config';
import type { CompLabel } from '../../lib/types';
import { getHistory, useLive } from '../../live/store';
import type { BuzzSensitivity, Source } from '../../live/types';

const WINDOW_MS = 8000;

export type FlagCounts = Partial<Record<CompLabel, number>>;

/** What the coach knows: rounded measurements from the last few seconds plus session counters. All fields are measured or read from config. */
export interface CoachContext {
  windowSec: number;
  sampleCount: number;
  maxLean: number | null;
  meanLean: number | null;
  maxHike: number | null;
  minElbow: number | null;
  maxShoulderFlex: number | null;
  minVis: number | null;
  flags: CompLabel[];
  windowFlagCounts: FlagCounts;
  sessionFlagCounts: FlagCounts;
  near: boolean;
  restCaptured: boolean;
  source: Source;
  buzz: BuzzSensitivity;
  thresholds: { lean: number; hike: number; rot: number; minFlagMs: number; visMin: number; placeholders: true; note: string };
}

/** Round to a fixed number of decimals. */
function round(n: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
}

/** Count flag events by label. */
function countFlags(labels: CompLabel[]): FlagCounts {
  const counts: FlagCounts = {};
  for (const l of labels) counts[l] = (counts[l] ?? 0) + 1;
  return counts;
}

/** Summarise the last ~8 s of samples and the store into a CoachContext. */
export function buildCoachContext(): CoachContext {
  const state = useLive.getState();
  const history = getHistory();
  const last = history[history.length - 1];
  const cutoff = last ? last.t - WINDOW_MS : 0;
  const features = history.filter((s) => s.t >= cutoff && s.features).map((s) => s.features!);
  const leans = features.map((f) => Math.abs(f.leanDeg));
  const th = FORWARD_REACH.thresholds;

  return {
    windowSec: WINDOW_MS / 1000,
    sampleCount: features.length,
    maxLean: leans.length ? round(Math.max(...leans), 0) : null,
    meanLean: leans.length ? round(leans.reduce((a, b) => a + b, 0) / leans.length, 1) : null,
    maxHike: features.length ? round(Math.max(...features.map((f) => Math.abs(f.hikeRatio))), 2) : null,
    minElbow: features.length ? round(Math.min(...features.map((f) => f.elbowDeg)), 0) : null,
    maxShoulderFlex: features.length ? round(Math.max(...features.map((f) => f.shoulderFlexDeg)), 0) : null,
    minVis: features.length ? round(Math.min(...features.map((f) => f.vis)), 2) : null,
    flags: last?.rules?.flags ?? [],
    windowFlagCounts: countFlags(state.flags.filter((e) => e.t >= cutoff).map((e) => e.label)),
    sessionFlagCounts: countFlags(state.flags.map((e) => e.label)),
    near: state.near,
    restCaptured: state.restCaptured,
    source: state.source,
    buzz: state.buzz,
    thresholds: {
      lean: th.lean,
      hike: th.hike,
      rot: th.rot,
      minFlagMs: FORWARD_REACH.minFlagMs,
      visMin: FORWARD_REACH.visMin,
      placeholders: true,
      note: 'Thresholds are placeholders until D3 (TRSP analysis) sets them.',
    },
  };
}
