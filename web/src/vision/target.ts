// Reach target and touch detection (PLAN.md §9.2 step C4, task C3). The patient picks Near or Far, then clicks
// the object once on the video; a rep's touch is the estimated fingertip coming within touchRadius of that point.
// Distances use pixel-proportional units (x scaled by the video aspect ratio), so touchRadius is a fraction of
// the image height.
import type { PoseFrame, Target } from '../lib/types';

// SOURCE: Winter, Biomechanics and Motor Control of Human Movement (segment lengths after Drillis & Contini):
// hand 0.108 × height, forearm 0.146 × height. MediaPipe's wrist stops about a hand-length short of a touch.
export const HAND_TO_FOREARM_RATIO = 0.108 / 0.146;

/** Target from a click on the video element; near is the tape mark the patient chose. */
export function targetFromClick(clientX: number, clientY: number, video: HTMLElement, near: boolean): Target {
  const r = video.getBoundingClientRect();
  return { point: [(clientX - r.left) / r.width, (clientY - r.top) / r.height], near };
}

/** Estimated fingertip in normalized image coordinates: the elbow→wrist line extended by one hand length. */
export function handTip(f: PoseFrame): { x: number; y: number } {
  return {
    x: f.wrist.x + (f.wrist.x - f.elbow.x) * HAND_TO_FOREARM_RATIO,
    y: f.wrist.y + (f.wrist.y - f.elbow.y) * HAND_TO_FOREARM_RATIO,
  };
}

/** True when the elbow and wrist are visible and the estimated fingertip is within radius of the target. */
export function isTouching(f: PoseFrame, target: Target, radius: number, visMin: number, aspect: number): boolean {
  if ((f.elbow.vis ?? 0) < visMin || (f.wrist.vis ?? 0) < visMin) return false;
  const tip = handTip(f);
  return Math.hypot((tip.x - target.point[0]) * aspect, tip.y - target.point[1]) <= radius;
}
