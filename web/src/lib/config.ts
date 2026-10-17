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
// Target setup (PLAN.md §9.1). All distances are cm from the table's front edge, on the trunk midline.
// SOURCE: RPSS, Levin et al. 2004 p. 11 (docs/research.md). The chair is moved until the fully extended arm's
// distal wrist crease sits over this mark, which scales both targets to the patient's arm length.
export const RPSS_WRIST_MARK_CM = 4;
// SOURCE: RPSS, Levin et al. 2004 p. 11: near (close) target, reachable with no trunk movement.
export const RPSS_NEAR_CM = 1;
// SOURCE: RPSS, Levin et al. 2004 p. 11: far target, needs about 25% of the reach from the trunk.
export const RPSS_FAR_CM = 30;

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
};

export const EXERCISES: ExerciseProfile[] = [FORWARD_REACH];
