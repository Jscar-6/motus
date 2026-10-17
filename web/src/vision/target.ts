// Reach target and touch detection (PLAN.md §9.2 step C4, task C3). The patient picks Near or Far, then clicks
// the object once on the video; a rep's touch is the estimated grasp point coming within touchRadius of that point.
// Distances use pixel-proportional units (x scaled by the video aspect ratio), so touchRadius is a fraction of
// the image height.
import type { PoseFrame, Target } from '../lib/types';

// SOURCE: Winter, Biomechanics and Motor Control of Human Movement (segment lengths after Drillis & Contini):
// hand 0.108 × height, forearm 0.146 × height. MediaPipe's wrist stops short of the object being grasped.
export const HAND_TO_FOREARM_RATIO = 0.108 / 0.146;
// SOURCE: placeholder, hand-tuned during the C3 check: a grasped object sits mid-hand, and the fingertip
// estimate (fraction 1.0) overshot it.
export const PLACEHOLDER_GRASP_HAND_FRACTION = 0.5;

/** Target from a click on the video element; near is the tape mark the patient chose. */
export function targetFromClick(clientX: number, clientY: number, video: HTMLElement, near: boolean): Target {
  const r = video.getBoundingClientRect();
  return { point: [(clientX - r.left) / r.width, (clientY - r.top) / r.height], near };
}

/** Estimated grasp point (mid-hand) in normalized image coordinates: the elbow→wrist line extended into the hand. */
export function graspPoint(f: PoseFrame): { x: number; y: number } {
  const k = HAND_TO_FOREARM_RATIO * PLACEHOLDER_GRASP_HAND_FRACTION;
  return { x: f.wrist.x + (f.wrist.x - f.elbow.x) * k, y: f.wrist.y + (f.wrist.y - f.elbow.y) * k };
}

/** True when the elbow and wrist are visible and the estimated grasp point is within radius of the target. */
export function isTouching(f: PoseFrame, target: Target, radius: number, visMin: number, aspect: number): boolean {
  if ((f.elbow.vis ?? 0) < visMin || (f.wrist.vis ?? 0) < visMin) return false;
  const tip = graspPoint(f);
  return Math.hypot((tip.x - target.point[0]) * aspect, tip.y - target.point[1]) <= radius;
}
