// Per-frame features for camera-only mode (PLAN.md §6.1, task C2) and the rest-pose capture (§9.2 step C3).
// Same definitions as ml/features.py; if one changes, the other must change too (CLAUDE.md rule 18).
// Angles and distances are computed in pixel-proportional space: x is scaled by the video aspect ratio
// (width / height), because PoseFrame points are normalized separately on each axis.
import type { FrameFeatures, Point2, PoseFrame, Side } from './types';

// SOURCE: PLAN.md §9.2 step C3 ("hold still 3 s")
export const REST_CAPTURE_MS = 3000;
// SOURCE: placeholder, hand-tuned on the pose check page until E4. Max drift of any landmark from its
// average during the capture, as a fraction of trunk length (shoulder→hip).
export const PLACEHOLDER_REST_STILL_RATIO = 0.06;

const JOINTS = ['ear', 'shoulder', 'elbow', 'wrist', 'hip'] as const;
type Joint = (typeof JOINTS)[number];
type Vec = { x: number; y: number };

/** Point in pixel-proportional units (x scaled by aspect, y unchanged). */
function px(p: Point2, aspect: number): Vec {
  return { x: p.x * aspect, y: p.y };
}

/** Vector from a to b. */
function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** Euclidean distance between two points. */
function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Unsigned angle between two vectors, in degrees (0–180). */
function angleBetween(u: Vec, v: Vec): number {
  const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/**
 * +1 if the patient faces image-right, -1 if image-left. The webcam frame is not mirrored and the camera
 * sits on the affected side (§9.1 S2): with the right side toward the camera, forward is image-right.
 */
function forwardSign(side: Side): number {
  return side === 'right' ? 1 : -1;
}

/** Trunk tilt from image vertical in degrees, forward = + (hip→shoulder line). */
function trunkTiltDeg(f: PoseFrame, aspect: number): number {
  const v = sub(px(f.shoulder, aspect), px(f.hip, aspect));
  return (Math.atan2(forwardSign(f.side) * v.x, -v.y) * 180) / Math.PI;
}

/** Lowest MediaPipe visibility of the five tracked points. */
export function minVisibility(f: PoseFrame): number {
  return Math.min(...JOINTS.map((j) => f[j].vis ?? 0));
}

/** §6.1 features for one frame, relative to the rest pose (rotDeg is null in camera-only mode). */
export function computeFeatures(f: PoseFrame, rest: PoseFrame, aspect: number): FrameFeatures {
  const p = (j: Joint) => px(f[j], aspect);
  const r = (j: Joint) => px(rest[j], aspect);
  const restTrunk = dist(r('shoulder'), r('hip'));
  return {
    t: f.t,
    leanDeg: trunkTiltDeg(f, aspect) - trunkTiltDeg(rest, aspect),
    hikeRatio: (dist(r('ear'), r('shoulder')) - dist(p('ear'), p('shoulder'))) / restTrunk,
    rotDeg: null,
    elbowDeg: angleBetween(sub(p('shoulder'), p('elbow')), sub(p('wrist'), p('elbow'))),
    shoulderFlexDeg: angleBetween(sub(p('hip'), p('shoulder')), sub(p('wrist'), p('shoulder'))),
    vis: minVisibility(f),
  };
}

export type RestCaptureStatus =
  | { kind: 'holding'; progress: number }
  | { kind: 'rejected'; reason: 'no_person' | 'hidden' | 'moving' }
  | { kind: 'done'; restPose: PoseFrame };

/** Average of a list of frames, landmark by landmark (visibility = the lowest seen). */
function averagePose(frames: PoseFrame[]): PoseFrame {
  const last = frames[frames.length - 1];
  const avg = (j: Joint): Point2 => ({
    x: frames.reduce((s, f) => s + f[j].x, 0) / frames.length,
    y: frames.reduce((s, f) => s + f[j].y, 0) / frames.length,
    vis: Math.min(...frames.map((f) => f[j].vis ?? 0)),
  });
  return { t: last.t, side: last.side, ear: avg('ear'), shoulder: avg('shoulder'), elbow: avg('elbow'), wrist: avg('wrist'), hip: avg('hip') };
}

/** Collects REST_CAPTURE_MS of still, visible frames and returns their average as the rest pose. */
export class RestPoseCapture {
  private frames: PoseFrame[] = [];

  constructor(
    private readonly visMin: number,
    private readonly aspect: number,
  ) {}

  /** Feed one frame; a rejection clears the window so the next frame starts a fresh attempt. */
  push(f: PoseFrame | null): RestCaptureStatus {
    const reject = (reason: 'no_person' | 'hidden' | 'moving'): RestCaptureStatus => {
      this.frames = [];
      return { kind: 'rejected', reason };
    };
    if (!f) return reject('no_person');
    if (minVisibility(f) < this.visMin) return reject('hidden');
    this.frames.push(f);
    const avg = averagePose(this.frames);
    const trunk = dist(px(avg.shoulder, this.aspect), px(avg.hip, this.aspect));
    const moved = JOINTS.some((j) => dist(px(f[j], this.aspect), px(avg[j], this.aspect)) > PLACEHOLDER_REST_STILL_RATIO * trunk);
    if (moved) return reject('moving');
    const elapsed = f.t - this.frames[0].t;
    if (elapsed < REST_CAPTURE_MS) return { kind: 'holding', progress: elapsed / REST_CAPTURE_MS };
    const restPose = averagePose(this.frames);
    this.frames = [];
    return { kind: 'done', restPose };
  }
}
