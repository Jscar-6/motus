// Live-session types shared by the patient view, the therapist portal (F9) and the coach (F10).
// Internal to web/: not a §16 contract. Built on the §16 types in lib/types.ts.
import type { CompLabel, FrameFeatures, PoseFrame } from '../lib/types';

/** How close a check is to its threshold: under 70% ok, under 100% warn, at or over it over. */
export type Level = 'ok' | 'warn' | 'over';

/** One compensation check (lean / hike / rotation) for the current frame. */
export interface CheckState {
  key: 'lean' | 'hike' | 'rot';
  label: CompLabel;
  enabled: boolean;          // false when the profile or mode skips it (e.g. lean on a far target, rot without sleeve)
  reason?: string;           // why it's skipped, shown in the UI ("Far target: lean allowed (RPSS)")
  value: number | null;      // signed value in the feature's unit (deg or ratio)
  threshold: number;         // from the ExerciseProfile (config.ts)
  level: Level;
  overMs: number;            // how long the value has been continuously over the threshold
  flagged: boolean;          // overMs >= profile.minFlagMs
}

/** Rule-engine state for one frame. */
export interface RuleState {
  checks: CheckState[];
  flags: CompLabel[];        // currently flagged labels; empty means clean
  uncertain: boolean;        // vis below profile.visMin
  near: boolean;
}

/** Everything the UI needs for one camera frame. */
export interface LiveSample {
  t: number;                 // performance.now() of the patient tab
  pose: PoseFrame | null;
  features: FrameFeatures | null;
  rules: RuleState | null;
  aspect: number;            // video width / height, needed to draw and to measure angles
}

/** A flag that just started (rising edge). */
export interface FlagEvent { id: string; t: number; label: CompLabel; value: number }

/** Where the samples come from: the local webcam, the fake pose generator, or the patient tab. */
export type Source = 'none' | 'camera' | 'demo' | 'remote';

export type BuzzSensitivity = 'low' | 'medium' | 'high';

/** Messages on the 'truereach-live' BroadcastChannel between the patient tab and the therapist tab. */
export type LiveMessage =
  | { type: 'sample'; sample: LiveSample }
  | { type: 'video'; frame: Blob; w: number; h: number }
  | { type: 'presence'; role: 'patient' | 'doctor'; source: Source }
  | { type: 'flag'; event: FlagEvent }
  | { type: 'target'; near: boolean }
  | { type: 'recaptureRest' }
  | { type: 'buzz'; level: BuzzSensitivity };
