// Fuses the sleeve IMUs (fast, smooth, drifts) with the camera's 2D angles (absolute, drift-free) into one ArmPose.
// Frame: every output is a rotation since calibration, in the model frame. IMU = cal^-1 * q. Camera angles are
// absolute, so they become Rz(angle - restAngle) about model +Z (the side-view plane), which is the same "since
// calibration" quantity for rotations about that axis.
import * as THREE from 'three';
import { armConfig } from './armConfig';
import { latestSensor, sensorStatus, toThreeQuat, visionSegments } from './armInput';
import type { VisionAngles } from './armInput';
import type { ArmPose } from './ArmRig';
import type { PoseFrame } from '../lib/types';

type Seg = 'chest' | 'upperArm' | 'forearm';
const SEGS: Seg[] = ['chest', 'upperArm', 'forearm'];
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Pulls the segment's sleeve quaternion out of a frame. */
function imuQuat(seg: Seg): THREE.Quaternion | null {
  const f = latestSensor();
  if (!f) return null;
  return toThreeQuat(seg === 'chest' ? f.chest : seg === 'upperArm' ? f.upper : f.fore);
}

export class PoseFusion {
  private cal: Partial<Record<Seg, THREE.Quaternion>> = {};
  private restAngles: VisionAngles['angles'] | null = null;
  private lastVision: VisionAngles | null = null;
  private readonly out: Record<Seg, THREE.Quaternion> = {
    chest: new THREE.Quaternion(),
    upperArm: new THREE.Quaternion(),
    forearm: new THREE.Quaternion(),
  };
  private readonly active: Record<Seg, boolean> = { chest: false, upperArm: false, forearm: false };
  private readonly vRel = new THREE.Quaternion();

  /** Makes the current sleeve orientation and camera angles the rest pose; true if either source was captured. */
  calibrate(): boolean {
    this.cal = {};
    this.restAngles = null;
    let captured = false;
    if (sensorStatus() === 'streaming') {
      for (const seg of SEGS) {
        const q = imuQuat(seg);
        if (q) this.cal[seg] = q.invert();
      }
      captured = true;
    }
    if (this.lastVision && this.lastVision.confidence >= armConfig.visionMinConfidence) {
      this.restAngles = { ...this.lastVision.angles };
      captured = true;
    }
    return captured;
  }

  /** Returns the smoothed pose since calibration, or null when neither the sleeve nor the camera has data. */
  update(dt: number, pose: PoseFrame | null, aspect: number): ArmPose | null {
    const imuOn = sensorStatus() === 'streaming';
    const vision = pose ? visionSegments(pose, aspect) : null;
    this.lastVision = vision;
    const rest = this.restAngles;
    const visionOn = vision !== null && rest !== null && vision.confidence >= armConfig.visionMinConfidence;
    const kVis = 1 - Math.exp(-dt * armConfig.visionWeight);
    const kSmooth = 1 - Math.exp(-dt * armConfig.poseSmoothing);

    const segments: ArmPose['segments'] = {};
    for (const seg of SEGS) {
      let rel: THREE.Quaternion | null = null;
      if (imuOn) {
        rel = imuQuat(seg);
        const cal = this.cal[seg];
        if (rel && cal) rel.premultiply(cal);
      }
      if (visionOn) {
        this.vRel.setFromAxisAngle(Z_AXIS, vision.angles[seg] - rest[seg]);
        if (rel) rel.slerp(this.vRel, kVis);
        else rel = this.vRel.clone();
      }
      if (!rel) {
        this.active[seg] = false;
        continue;
      }
      if (this.active[seg]) this.out[seg].slerp(rel, kSmooth);
      else this.out[seg].copy(rel);
      this.active[seg] = true;
      segments[seg] = this.out[seg];
    }
    return Object.keys(segments).length ? { segments } : null;
  }
}
