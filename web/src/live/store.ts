// Live-session store. `latest` changes every frame, so React components read it through
// useThrottledSample(); canvases read getHistory() inside their own requestAnimationFrame loop.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { BuzzSensitivity, FlagEvent, LiveSample, Source } from './types';

const HISTORY_MS = 8000;
const MAX_FLAGS = 50;

interface LiveState {
  source: Source;
  patientOnline: boolean;    // therapist tab: a patient tab is broadcasting
  latest: LiveSample | null;
  fps: number;
  near: boolean;             // target choice; drives the lean check (RPSS near-only rule)
  restCaptured: boolean;
  buzz: BuzzSensitivity;     // F10 runtime setting; read by S3 when it lands
  flags: FlagEvent[];        // newest first
}

export const useLive = create<LiveState>(() => ({
  source: 'none',
  patientOnline: false,
  latest: null,
  fps: 0,
  near: true,
  restCaptured: false,
  buzz: 'medium',
  flags: [],
}));

const history: LiveSample[] = [];
let frameTimes: number[] = [];

/** Append a sample: updates `latest`, the rolling history and the fps estimate. */
export function pushSample(sample: LiveSample): void {
  history.push(sample);
  while (history.length && sample.t - history[0].t > HISTORY_MS) history.shift();
  const now = performance.now();
  frameTimes.push(now);
  frameTimes = frameTimes.filter((t) => now - t < 1000);
  useLive.setState({ latest: sample, fps: frameTimes.length });
}

/** Record a new flag event (newest first, capped). */
export function pushFlag(event: FlagEvent): void {
  useLive.setState((s) => ({ flags: [event, ...s.flags].slice(0, MAX_FLAGS) }));
}

/** Rolling sample history for the last few seconds, oldest first. Not reactive: read it in rAF. */
export function getHistory(): readonly LiveSample[] {
  return history;
}

/** Drop history and flags, e.g. when the source changes. */
export function resetLive(): void {
  history.length = 0;
  frameTimes = [];
  useLive.setState({ latest: null, fps: 0, flags: [] });
}

/** The latest sample, re-rendering at most `hz` times per second. */
export function useThrottledSample(hz = 15): LiveSample | null {
  const [sample, setSample] = useState<LiveSample | null>(() => useLive.getState().latest);
  useEffect(() => {
    const id = window.setInterval(() => setSample(useLive.getState().latest), 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return sample;
}
