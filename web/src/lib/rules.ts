// Compensation rules (PLAN.md §6.2, task C5), generic over ExerciseProfile: which checks run, their thresholds,
// minFlagMs and visMin all come from the profile. Two parts: a per-frame tracker that drives the live red
// highlight and the buzz, and the end-of-rep verdict that turns RepStats (C4) into a RepResult.
// The tracker's interface matches web/src/live/rulesStub.ts (STUB(C5)), so the live pipeline can swap to it.
import type { RepStats } from './reps';
import type { CompLabel, ExerciseProfile, FrameFeatures, RepResult } from './types';

/** How close a check is to its threshold: under WARN_FRACTION ok, under 100% warn, at or over it over. */
export type Level = 'ok' | 'warn' | 'over';
type CheckKey = 'lean' | 'hike' | 'rot';

/** One compensation check (lean / hike / rotation) for the current frame. */
export interface CheckState {
  key: CheckKey;
  label: CompLabel;
  enabled: boolean;
  reason?: string;
  value: number | null;
  threshold: number;
  level: Level;
  overMs: number;
  flagged: boolean;
}

/** Rule state for one frame; flags is empty when clean. */
export interface RuleState { checks: CheckState[]; flags: CompLabel[]; uncertain: boolean; near: boolean }

/** Per-frame rule engine for one session. */
export interface RuleTracker {
  update(f: FrameFeatures | null, near: boolean): RuleState;
  reset(): void;
}

const KEYS: readonly CheckKey[] = ['lean', 'hike', 'rot'];
const LABELS: Record<CheckKey, CompLabel> = { lean: 'trunk_lean', hike: 'shoulder_hike', rot: 'trunk_rotation' };
// SOURCE: UI display choice (PLAN.md §10 amber = approaching threshold), not a detection threshold.
export const WARN_FRACTION = 0.7;

/** Whether a check runs for this profile, target and frame, and why not when it doesn't. */
function gate(profile: ExerciseProfile, key: CheckKey, near: boolean, f: FrameFeatures | null): { enabled: boolean; reason?: string } {
  if (key === 'lean') {
    const mode = profile.checks.lean;
    if (mode === 'always' || (mode === 'near_only' && near)) return { enabled: true };
    return { enabled: false, reason: mode === 'off' ? 'Not checked for this exercise' : 'Far target: lean allowed (RPSS)' };
  }
  if (!profile.checks[key]) return { enabled: false, reason: 'Not checked for this exercise' };
  if (key === 'rot' && (!f || f.rotDeg === null)) return { enabled: false, reason: 'Needs the sleeve' };
  return { enabled: true };
}

/** The signed feature value a check reads, or null when unavailable. */
function valueOf(key: CheckKey, f: FrameFeatures): number | null {
  if (key === 'lean') return f.leanDeg;
  if (key === 'hike') return f.hikeRatio;
  return f.rotDeg;
}

/** Size of a value against its threshold: only a raised shoulder counts for hike; lean and rotation count both ways. */
function magnitude(key: CheckKey, value: number): number {
  return key === 'hike' ? Math.max(0, value) : Math.abs(value);
}

/** Create a rule tracker that flags a check once it stays over its threshold for profile.minFlagMs. */
export function createRuleTracker(profile: ExerciseProfile): RuleTracker {
  const overMs: Record<CheckKey, number> = { lean: 0, hike: 0, rot: 0 };
  let lastT: number | null = null;

  return {
    update(f, near) {
      const dt = f && lastT !== null ? Math.max(0, f.t - lastT) : 0;
      lastT = f ? f.t : null;
      const uncertain = !f || f.vis < profile.visMin;
      const flags: CompLabel[] = [];
      const checks = KEYS.map((key): CheckState => {
        const { enabled, reason } = gate(profile, key, near, f);
        const value = f ? valueOf(key, f) : null;
        const threshold = profile.thresholds[key];
        const size = value === null ? 0 : magnitude(key, value);
        const active = enabled && !uncertain && value !== null;
        const over = active && size >= threshold;
        overMs[key] = over ? overMs[key] + dt : 0;
        const flagged = over && overMs[key] >= profile.minFlagMs;
        if (flagged) flags.push(LABELS[key]);
        const level: Level = !active ? 'ok' : size >= threshold ? 'over' : size >= WARN_FRACTION * threshold ? 'warn' : 'ok';
        return { key, label: LABELS[key], enabled, reason, value, threshold, level, overMs: overMs[key], flagged };
      });
      return { checks, flags, uncertain, near };
    },
    reset() {
      overMs.lean = overMs.hike = overMs.rot = 0;
      lastT = null;
    },
  };
}

/**
 * End-of-rep rule verdict (§6.2): uncertain if any landmark dropped below visMin during the rep; otherwise every
 * label the tracker flagged during the rep, plus incomplete_reach if the goal wasn't met, or clean if none.
 */
export function finishRep(profile: ExerciseProfile, rep: RepStats, flaggedDuringRep: Iterable<CompLabel>): RepResult {
  if (rep.minVis < profile.visMin) return { ...rep, ruleFlags: ['uncertain'] };
  const flags = new Set(flaggedDuringRep);
  if (!rep.reached) flags.add('incomplete_reach');
  return { ...rep, ruleFlags: flags.size ? [...flags] : ['clean'] };
}
