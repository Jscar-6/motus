// STUB(C2): replace when C2 merges (lib/features.ts)
// Camera-only §6.1 features. Points are converted to square units first (X = x * aspect, Y = y; y grows down)
// so angles and distances are not distorted by the 16:9 frame.
import type { FrameFeatures, Point2, PoseFrame } from '../lib/types';

/** The pose captured at rest, plus the video aspect it was captured at. */
export interface RestPose { pose: PoseFrame; aspect: number }

const RAD_TO_DEG = 180 / Math.PI;

/** Distance between two points in square units. */
function dist(a: Point2, b: Point2, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/** Trunk angle in degrees: shoulder relative to hip against the image vertical, + toward image-right. */
function trunkAngleDeg(p: PoseFrame, aspect: number): number {
  return Math.atan2((p.shoulder.x - p.hip.x) * aspect, -(p.shoulder.y - p.hip.y)) * RAD_TO_DEG;
}

/** Unsigned angle in degrees at `vertex` between the rays to `a` and `b` (0 to 180). */
function angleDeg(vertex: Point2, a: Point2, b: Point2, aspect: number): number {
  const ax = (a.x - vertex.x) * aspect;
  const ay = a.y - vertex.y;
  const bx = (b.x - vertex.x) * aspect;
  const by = b.y - vertex.y;
  return Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by) * RAD_TO_DEG;
}

/** Lowest MediaPipe visibility of the five tracked points (a missing value counts as 0). */
function minVisibility(p: PoseFrame): number {
  return Math.min(p.ear.vis ?? 0, p.shoulder.vis ?? 0, p.elbow.vis ?? 0, p.wrist.vis ?? 0, p.hip.vis ?? 0);
}

/** Camera-only per-frame features of `pose`, measured against the rest pose. */
export function computeFeatures(pose: PoseFrame, rest: RestPose, aspect: number): FrameFeatures {
  // Assumption: the camera sits on the patient's affected side and the image is the raw, un-mirrored webcam
  // frame, so a right-side view faces image-right (forward = +x) and a left-side view faces image-left.
  const forwardSign = pose.side === 'right' ? 1 : -1;
  const leanDeg = forwardSign * (trunkAngleDeg(pose, aspect) - trunkAngleDeg(rest.pose, rest.aspect));
  const restTrunk = dist(rest.pose.shoulder, rest.pose.hip, rest.aspect);
  const hikeRatio =
    (dist(rest.pose.ear, rest.pose.shoulder, rest.aspect) - dist(pose.ear, pose.shoulder, aspect)) / restTrunk;
  return {
    t: pose.t,
    leanDeg,
    hikeRatio,
    rotDeg: null, // needs the chest IMU
    elbowDeg: angleDeg(pose.elbow, pose.shoulder, pose.wrist, aspect),
    // PLAN §6.1 ("angle between hip→shoulder and shoulder→wrist") is ambiguous about the vertex; C2 decides.
    // Here: angle at the shoulder between shoulder→hip and shoulder→wrist (about 0 hanging, about 90 at shoulder height).
    shoulderFlexDeg: angleDeg(pose.shoulder, pose.hip, pose.wrist, aspect),
    vis: minVisibility(pose),
  };
}
