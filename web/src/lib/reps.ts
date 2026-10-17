// Rep segmentation (PLAN.md §6.2, task C4), generic over ExerciseProfile.goal. A rep starts when shoulder flexion
// rises above its recent resting level and ends when it comes back down; the goal is touching the target
// (touch_target) or reaching profile.goal.targetDeg (shoulder_flex). Rule flags are added by rules.ts (C5).
import type { ExerciseProfile, FrameFeatures, Mode, RepResult } from './types';

// SOURCE: placeholder, hand-tuned on the pose check page. Flexion rise above the resting level that starts a rep.
export const PLACEHOLDER_REP_START_DEG = 15;
// SOURCE: placeholder, hand-tuned on the pose check page. A rep ends once flexion is back within this of rest.
export const PLACEHOLDER_REP_END_DEG = 8;
// SOURCE: placeholder, hand-tuned on the pose check page. The resting level is the lowest flexion over this window.
export const PLACEHOLDER_REP_BASELINE_MS = 3000;
// SOURCE: placeholder, hand-tuned on the pose check page. Shorter movements are ignored as twitches.
export const PLACEHOLDER_REP_MIN_MS = 500;

/** A finished rep's measurements; rules.ts adds ruleFlags to make a full RepResult. */
export type RepStats = Omit<RepResult, 'ruleFlags' | 'modelFlags' | 'modelProbs' | 'recordedLabel'>;

/** What happened on this frame. */
export type RepEvent = { kind: 'idle' } | { kind: 'started' } | { kind: 'in_rep' } | { kind: 'ended'; rep: RepStats };

/** Per-frame input: the features (null when no person) and whether the hand is touching the target. */
export interface RepInput { features: FrameFeatures | null; touching: boolean; near?: boolean }

/** Running stats for the rep in progress. */
interface Open {
  tStart: number; tLast: number; reached: boolean; near?: boolean;
  maxLeanDeg: number; maxHikeRatio: number; maxRotDeg: number | null;
  minElbowDeg: number; maxShoulderFlexDeg: number; minVis: number;
}

/** True when this frame meets the profile's goal. */
function goalMet(profile: ExerciseProfile, input: RepInput): boolean {
  if (profile.goal.kind === 'touch_target') return input.touching;
  return !!input.features && input.features.shoulderFlexDeg >= profile.goal.targetDeg;
}

/** Splits a stream of frames into reps for one exercise profile. */
export class RepTracker {
  private history: { t: number; flex: number }[] = [];
  private open: Open | null = null;
  private count = 0;

  constructor(
    private readonly profile: ExerciseProfile,
    private readonly mode: Mode,
  ) {}

  /** Feed one frame; returns whether a rep started, is running, or just ended (with its stats). */
  update(input: RepInput): RepEvent {
    const f = input.features;
    if (!this.open) {
      if (!f) return { kind: 'idle' };
      this.history = [...this.history.filter((h) => f.t - h.t <= PLACEHOLDER_REP_BASELINE_MS), { t: f.t, flex: f.shoulderFlexDeg }];
      if (f.shoulderFlexDeg - this.restLevel() < PLACEHOLDER_REP_START_DEG) return { kind: 'idle' };
      this.open = {
        tStart: f.t, tLast: f.t, reached: false, near: input.near,
        maxLeanDeg: 0, maxHikeRatio: 0, maxRotDeg: null, minElbowDeg: 180, maxShoulderFlexDeg: 0, minVis: 1,
      };
      this.accumulate(input);
      return { kind: 'started' };
    }
    this.accumulate(input);
    const back = !!f && f.shoulderFlexDeg - this.restLevel() <= PLACEHOLDER_REP_END_DEG;
    if (!back) return { kind: 'in_rep' };
    const rep = this.close();
    return rep ? { kind: 'ended', rep } : { kind: 'idle' };
  }

  /** Drop any rep in progress and the resting level, e.g. after a rest re-capture or a target change. */
  reset(): void {
    this.history = [];
    this.open = null;
  }

  /** Lowest flexion seen over the baseline window (frozen while a rep is open). */
  private restLevel(): number {
    return Math.min(...this.history.map((h) => h.flex));
  }

  /** Fold one frame into the open rep's running stats; a missing pose counts as visibility 0. */
  private accumulate(input: RepInput): void {
    const o = this.open!;
    const f = input.features;
    o.reached ||= goalMet(this.profile, input);
    if (!f) {
      o.minVis = 0;
      return;
    }
    o.tLast = f.t;
    o.maxLeanDeg = Math.max(o.maxLeanDeg, Math.abs(f.leanDeg));
    o.maxHikeRatio = Math.max(o.maxHikeRatio, f.hikeRatio);
    if (f.rotDeg !== null) o.maxRotDeg = Math.max(o.maxRotDeg ?? 0, Math.abs(f.rotDeg));
    o.minElbowDeg = Math.min(o.minElbowDeg, f.elbowDeg);
    o.maxShoulderFlexDeg = Math.max(o.maxShoulderFlexDeg, f.shoulderFlexDeg);
    o.minVis = Math.min(o.minVis, f.vis);
  }

  /** Close the open rep; too-short movements are discarded and return null. */
  private close(): RepStats | null {
    const o = this.open!;
    this.open = null;
    if (o.tLast - o.tStart < PLACEHOLDER_REP_MIN_MS) return null;
    this.count += 1;
    const { tLast, ...stats } = o;
    return { ...stats, repId: `${this.profile.id}-${this.count}`, exerciseId: this.profile.id, tEnd: tLast, mode: this.mode };
  }
}
