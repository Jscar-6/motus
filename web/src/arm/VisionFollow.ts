// Smooths the camera's side-view arm angles so the 3D arm can copy the video directly (camera-only, no calibration).
import { armConfig } from './armConfig';
import { visionSegments } from './armInput';
import type { PoseFrame } from '../lib/types';

/** Shortest signed difference between two angles in radians. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class VisionFollow {
  upper = 0;
  fore = 0;
  mirrored = false;
  ready = false;                                 // true once the arm has been seen; the last pose is held after that

  /** Folds in the newest pose; returns true when the arm is visible enough to follow this frame. */
  update(dt: number, pose: PoseFrame | null, aspect: number): boolean {
    if (!pose) return false;
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
