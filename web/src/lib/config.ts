// Exercise profiles and thresholds. Every number names its source (CLAUDE.md rule 17).
// Thresholds are set only by D3 (TRSP) and E4 (spot check); everyone else reads them.
import type { ExerciseProfile } from './types';

// SOURCE: placeholder until D3 (TRSP healthy frames)
export const PLACEHOLDER_T_LEAN_DEG = 10;
// SOURCE: placeholder until D3 (TRSP healthy frames)
export const PLACEHOLDER_T_HIKE_RATIO = 0.1;
// SOURCE: placeholder until D3 (TRSP healthy frames)
export const PLACEHOLDER_T_ROT_DEG = 10;
// SOURCE: placeholder until D3 (tuned on TRSP healthy frames)
export const PLACEHOLDER_MIN_FLAG_MS = 300;
// SOURCE: placeholder until E4 (hand-tuned during spot check)
export const PLACEHOLDER_VIS_MIN = 0.5;
// SOURCE: placeholder until E4 (hand-tuned during spot check); normalized image units
export const PLACEHOLDER_TOUCH_RADIUS = 0.05;
// SOURCE: placeholder. RPSS gives fixed cm, not arm-length ratios (docs/research.md, D4); replaced once the
// PLAN.md §20 RPSS-placement proposal is accepted.
export const PLACEHOLDER_NEAR_RATIO = 0.8;
// SOURCE: placeholder, same reason as PLACEHOLDER_NEAR_RATIO (docs/research.md, D4).
export const PLACEHOLDER_FAR_RATIO = 1.2;

export const FORWARD_REACH: ExerciseProfile = {
  id: 'forward_reach',
  name: 'Seated forward reach',
  source: 'TRSP',
  validated: true,
  useModel: true,
  goal: { kind: 'touch_target' },
  usesNearFar: true,
  checks: { lean: 'near_only', hike: true, rot: true }, // lean near-only: RPSS
  thresholds: { lean: PLACEHOLDER_T_LEAN_DEG, hike: PLACEHOLDER_T_HIKE_RATIO, rot: PLACEHOLDER_T_ROT_DEG },
  minFlagMs: PLACEHOLDER_MIN_FLAG_MS,
  visMin: PLACEHOLDER_VIS_MIN,
  touchRadius: PLACEHOLDER_TOUCH_RADIUS,
  nearRatio: PLACEHOLDER_NEAR_RATIO,
  farRatio: PLACEHOLDER_FAR_RATIO,
};

export const EXERCISES: ExerciseProfile[] = [FORWARD_REACH];
