// Smooths the camera's side-view arm angles so the 3D arm can copy the video directly (camera-only, no calibration).
import { armConfig } from './armConfig';
import { visionSegments } from './armInput';
import type { Point2, PoseFrame } from '../lib/types';

/** Whether a normalized landmark lies inside the video frame. */
function inFrame(p: Point2): boolean {
  return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

/** Shortest signed difference between two angles in radians. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class VisionFollow {
  upper = 0;
  fore = 0;
  mirrored = false;
  ready = false;                                 // true once the arm has been seen; the last pose is held after that

  /** Folds in the newest pose; returns true when the shoulder, elbow and wrist are in frame and visible enough to follow. */
  update(dt: number, pose: PoseFrame | null, aspect: number): boolean {
    if (!pose || !inFrame(pose.shoulder) || !inFrame(pose.elbow) || !inFrame(pose.wrist)) return false;
    const vision = visionSegments(pose, aspect);
    if (vision.confidence < armConfig.visionMinConfidence) return false;
    const { upperArm, forearm } = vision.angles;
    const k = this.ready ? 1 - Math.exp(-dt * armConfig.poseSmoothing) : 1;
    this.upper += angleDelta(this.upper, upperArm) * k;
    this.fore += angleDelta(this.fore, forearm) * k;
    this.mirrored = pose.side === 'left';
    this.ready = true;
    return true;
  }
}
