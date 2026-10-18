// Exercise profiles and thresholds. Every number names its source (CLAUDE.md rule 17).
// Thresholds are set only by D3 (TRSP) and E4 (spot check); everyone else reads them.
import type { ExerciseProfile } from './types';

// Thresholds below: D3, `python ml/thresholds.py` (docs/results.md "Thresholds (D3)", plots in docs/thresholds/).
// SOURCE: TRSP healthy frames (H01–H10), Youden-J cutoff of |leanDeg|, clean vs lean_forward (sens 0.92, spec 0.92).
export const T_LEAN_DEG = 8.3;
// SOURCE: TRSP healthy frames (H01–H10), Youden-J cutoff of raised hikeRatio, clean vs shoulder_elevation (sens 0.67, spec 0.89).
export const T_HIKE_RATIO = 0.047;
// SOURCE: TRSP healthy frames (H01–H10), Youden-J cutoff of |rotDeg|, clean vs trunk_rotation (sens 0.85, spec 0.85).
export const T_ROT_DEG = 9.2;
// SOURCE: hand-tuned for the webcam (E4), picked from the D3 hold sweep on TRSP healthy frames (docs/results.md):
// 300 ms halves clean-frame false alarms vs the J-optimal 67 ms (mean J 0.66 vs 0.70). 67 ms buzzed constantly
// on live webcam noise. Not yet confirmed by the spot check.
export const MIN_FLAG_MS = 300;
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
  thresholds: { lean: T_LEAN_DEG, hike: T_HIKE_RATIO, rot: T_ROT_DEG },
  minFlagMs: MIN_FLAG_MS,
  visMin: PLACEHOLDER_VIS_MIN,
  touchRadius: PLACEHOLDER_TOUCH_RADIUS,
};

export const EXERCISES: ExerciseProfile[] = [FORWARD_REACH];
