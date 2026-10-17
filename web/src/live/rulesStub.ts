// STUB(C5): replace when C5 merges (lib/rules.ts)
// Per-frame rule state, generic over ExerciseProfile (no exercise is hard-coded here).
import type { CompLabel, ExerciseProfile, FrameFeatures } from '../lib/types';
import type { CheckState, Level, RuleState } from './types';

type CheckKey = CheckState['key'];

const KEYS: readonly CheckKey[] = ['lean', 'hike', 'rot'];
const LABELS: Record<CheckKey, CompLabel> = { lean: 'trunk_lean', hike: 'shoulder_hike', rot: 'trunk_rotation' };
// UI display choice only (the amber band starts at 70% of the threshold); not a detection threshold.
const WARN_FRACTION = 0.7;

/** Rule engine for one session: feed it one frame at a time. */
export interface RuleTracker {
  update(f: FrameFeatures | null, near: boolean): RuleState;
  reset(): void;
}

/** Whether a check applies right now, and why not when it does not. */
function gate(
  profile: ExerciseProfile,
  key: CheckKey,
  near: boolean,
  f: FrameFeatures | null,
): { enabled: boolean; reason?: string } {
  if (key === 'lean') {
    const mode = profile.checks.lean;
    if (mode === 'always' || (mode === 'near_only' && near)) return { enabled: true };
    return { enabled: false, reason: mode === 'off' ? 'Not checked for this exercise' : 'Far target: lean allowed (RPSS)' };
  }
  if (!profile.checks[key]) return { enabled: false, reason: 'Not checked for this exercise' };
  if (key === 'rot' && (!f || f.rotDeg === null)) return { enabled: false, reason: 'Needs the sleeve' };
  return { enabled: true };
}

/** The signed feature value a check reads, or null when the feature is unavailable. */
function readValue(key: CheckKey, f: FrameFeatures): number | null {
  if (key === 'lean') return f.leanDeg;
  if (key === 'hike') return f.hikeRatio;
  return f.rotDeg;
}

/** Bucket |value| / threshold into ok, warn or over. */
function levelOf(magnitude: number, threshold: number): Level {
  const ratio = magnitude / threshold;
  if (ratio >= 1) return 'over';
  return ratio >= WARN_FRACTION ? 'warn' : 'ok';
}

/** Create a rule tracker that times how long each check stays over its threshold. */
export function createRuleTracker(profile: ExerciseProfile): RuleTracker {
  const overMs: Record<CheckKey, number> = { lean: 0, hike: 0, rot: 0 };
  let lastT: number | null = null;

  /** Forget all timers, e.g. after a rest re-capture or a lost pose. */
  const reset = () => {
    overMs.lean = 0;
    overMs.hike = 0;
    overMs.rot = 0;
    lastT = null;
  };

  /** Evaluate one frame (null = no pose) and return the rule state. */
  const update = (f: FrameFeatures | null, near: boolean): RuleState => {
    const dt = f && lastT !== null ? Math.max(0, f.t - lastT) : 0;
    lastT = f ? f.t : null;
    const uncertain = f === null || f.vis < profile.visMin;
    const flags: CompLabel[] = [];
    const checks = KEYS.map((key): CheckState => {
      const { enabled, reason } = gate(profile, key, near, f);
      const value = f ? readValue(key, f) : null;
      const threshold = profile.thresholds[key];
      // Only a positive hikeRatio (shoulder raised) counts; lean and rotation count in both directions.
      const magnitude = value === null ? 0 : key === 'hike' ? Math.max(0, value) : Math.abs(value);
      const active = enabled && !uncertain && value !== null;
      const over = active && magnitude >= threshold;
      overMs[key] = over ? overMs[key] + dt : 0;
      const flagged = over && overMs[key] >= profile.minFlagMs;
      if (flagged) flags.push(LABELS[key]);
      return {
        key,
        label: LABELS[key],
        enabled,
        reason,
        value,
        threshold,
        level: active ? levelOf(magnitude, threshold) : 'ok',
        overMs: overMs[key],
        flagged,
      };
    });
    return { checks, flags, uncertain, near };
  };

  return { update, reset };
}
