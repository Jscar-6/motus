// Sleeve math (S2): turns the three IMU quaternions into body angles. See docs/sleeve.md for the full picture.
//
// Each firmware quaternion q rotates that sensor's own axes into a shared earth frame (z up). The heading is
// shared because `G` resets all three filters together while the sensors lie flat with their X arrows aligned.
// Two poses tie the sensors to the body:
//   1. `G` (sleeve flat on the table): one common heading for all sensors.
//   2. Rest capture (§9.2 C3, sitting upright, arm hanging straight): each segment's long axis is "straight down"
//      (arm) or "straight up" (trunk) at that moment, so we read it from gravity, whatever angle the sensor sits
//      at on the sleeve. The chest sensor's face (component side out on the sternum) gives the forward direction.
// After that, every frame rotates those axes into the earth frame and measures angles between them.
import type { Calibration, FrameFeatures, Quat, SensorFrame } from './types';

export type Vec3 = [number, number, number];
type RestQuats = NonNullable<Calibration['restQuats']>;

// The chest sensor sits on the sternum with its component side facing out, so its +Z axis points forward.
const CHEST_FACE_AXIS: Vec3 = [0, 0, 1];
const UP: Vec3 = [0, 0, 1];
const DOWN: Vec3 = [0, 0, -1];
const DEG = 180 / Math.PI;

/** Hamilton product a * b. */
export function qMul(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

/** Inverse of a unit quaternion. */
export function qConj(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]];
}

/** Rotate vector v by unit quaternion q (q v q*). */
export function qRotate(q: Quat, v: Vec3): Vec3 {
  const r = qMul(qMul(q, [0, v[0], v[1], v[2]]), qConj(q));
  return [r[1], r[2], r[3]];
}

/** Unit quaternion of the rotation whose matrix has columns c0, c1, c2. */
export function qFromBasis(c0: Vec3, c1: Vec3, c2: Vec3): Quat {
  const [m00, m10, m20] = c0;
  const [m01, m11, m21] = c1;
  const [m02, m12, m22] = c2;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4];
}

/** Dot product. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Cross product a × b. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** v scaled to length 1. */
function unit(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Unsigned angle between two vectors, in degrees (0–180). */
function angleDeg(a: Vec3, b: Vec3): number {
  const c = dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.min(1, Math.max(-1, c))) * DEG;
}

/** Everything the rest pose tells us about how the sleeve sits on this body. */
export interface SleeveRest {
  quats: RestQuats;
  upperAxis: Vec3;     // shoulder → elbow, in the upper-arm sensor's frame
  foreAxis: Vec3;      // elbow → wrist, in the forearm sensor's frame
  chestUp: Vec3;       // hip → shoulder, in the chest sensor's frame
  chestForward: Vec3;  // the patient's forward direction, in the chest sensor's frame
  forward: Vec3;       // the patient's forward direction in the earth frame (horizontal)
  chestUpright: boolean;  // false if the chest sensor's face isn't roughly forward: lean sign and rotation unreliable
}

// SOURCE: geometry, hand-set. The chest sensor's face must be within 60° of horizontal (cos 60° = 0.5) for
// its horizontal part to give a trustworthy forward direction.
const MIN_FACE_HORIZONTAL = 0.5;

/** Copy the latest sensor quaternions as the rest orientation (call at the moment the rest pose is captured). */
export function captureRestQuats(frame: SensorFrame): RestQuats {
  return { upper: frame.upper, fore: frame.fore, chest: frame.chest };
}

/** Derive the segment axes and the forward direction from the rest quaternions. */
export function sleeveRest(quats: RestQuats): SleeveRest {
  const face = qRotate(quats.chest, CHEST_FACE_AXIS);
  const forward = unit([face[0], face[1], 0]);
  const chestUpright = Math.hypot(face[0], face[1]) >= MIN_FACE_HORIZONTAL;
  return {
    quats,
    upperAxis: qRotate(qConj(quats.upper), DOWN),
    foreAxis: qRotate(qConj(quats.fore), DOWN),
    chestUp: qRotate(qConj(quats.chest), UP),
    chestForward: qRotate(qConj(quats.chest), forward),
    forward,
    chestUpright,
  };
}

/** The three angles the sleeve measures better than the camera (PLAN.md §6.1, "With sleeve" column). */
export interface SleeveFeatures { leanDeg: number; rotDeg: number; elbowDeg: number }

/** Lean, trunk rotation and elbow angle for one frame, relative to the rest pose. */
export function sleeveFeatures(frame: SensorFrame, rest: SleeveRest): SleeveFeatures {
  const trunkUp = qRotate(frame.chest, rest.chestUp);
  const leanDeg = Math.atan2(dot(trunkUp, rest.forward), trunkUp[2]) * DEG;

  const fwdNow = qRotate(frame.chest, rest.chestForward);
  const rotDeg = Math.atan2(rest.forward[0] * fwdNow[1] - rest.forward[1] * fwdNow[0],
    rest.forward[0] * fwdNow[0] + rest.forward[1] * fwdNow[1]) * DEG;

  const upperArm = qRotate(frame.upper, rest.upperAxis);
  const forearm = qRotate(frame.fore, rest.foreAxis);
  const elbowDeg = angleDeg([-upperArm[0], -upperArm[1], -upperArm[2]], forearm);
  return { leanDeg, rotDeg, elbowDeg };
}

/**
 * Camera + sleeve features (§6.1): lean, rotation and elbow come from the sleeve; shoulder hike, shoulder
 * flexion and visibility stay with the camera.
 */
export function mergeSleeveFeatures(camera: FrameFeatures, sleeve: SleeveFeatures): FrameFeatures {
  return { ...camera, leanDeg: sleeve.leanDeg, rotDeg: sleeve.rotDeg, elbowDeg: sleeve.elbowDeg };
}

/**
 * Each segment's rotation since the rest pose, expressed in the body frame the 3D arm uses
 * (x forward, y up, z = x × y). This is what web/src/arm's `remapSensorQuat` / PoseFusion needs.
 */
export function bodyRotationsSinceRest(frame: SensorFrame, rest: SleeveRest): { upper: Quat; fore: Quat; chest: Quat } {
  const b = qFromBasis(rest.forward, UP, cross(rest.forward, UP));
  const toBody = (now: Quat, atRest: Quat) => qMul(qMul(qConj(b), qMul(now, qConj(atRest))), b);
  return {
    upper: toBody(frame.upper, rest.quats.upper),
    fore: toBody(frame.fore, rest.quats.fore),
    chest: toBody(frame.chest, rest.quats.chest),
  };
}
