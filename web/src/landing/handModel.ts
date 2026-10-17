// Point-cloud hand model and its per-frame 3D projection, ported from the Hand.dc.html prototype.
export type Vec3 = [number, number, number];

export interface HandPoint {
  p: Vec3;
  joint: boolean;
  tip: boolean;
}

export interface HandModel {
  pts: HandPoint[];
  joints: Vec3[];
  bones: [number, number][];
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
  r: number;
  o: number;
  tip: boolean;
  joint: boolean;
  color: 'ink' | 'accent';
}

export interface ProjectedBone {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  o: number;
  color: 'ink';
}

export interface ProjectedHand {
  points: ProjectedPoint[];
  bones: ProjectedBone[];
}

/** Side of the square model space the projection lands in. */
export const MODEL_SIZE = 400;
/** Model-space point that sits at the hand's visual centre. */
export const MODEL_CENTER = { x: 200, y: 205 };

const SCALE = 15;
const CAMERA_DISTANCE = 38;
const TIP_JOINTS = [4, 8, 12, 16, 20];
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
const FINGERS = [
  { base: [-2.0, 1.0, 0.6], dir: [-0.62, 0.78, 0.1], lens: [1.9, 1.6, 1.4], k: 0.55 },
  { base: [-2.0, 6.6, 0], dir: [-0.08, 1, 0], lens: [2.8, 1.8, 1.4], k: 1 },
  { base: [0, 6.9, 0], dir: [0, 1, 0], lens: [3.1, 2.0, 1.5], k: 1 },
  { base: [1.8, 6.5, 0], dir: [0.06, 1, 0], lens: [2.8, 1.8, 1.3], k: 1 },
  { base: [3.4, 5.8, 0], dir: [0.15, 1, 0], lens: [2.1, 1.4, 1.1], k: 1 },
] as const;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Returns the 21 joint positions for a given finger curl. */
function jointsFor(curl: number): Vec3[] {
  const joints: Vec3[] = [[0, 0, 0]];
  FINGERS.forEach((f) => {
    const d = norm([...f.dir] as Vec3);
    let p: Vec3 = [...f.base] as Vec3;
    joints.push(p);
    let ang = 0;
    f.lens.forEach((len, j) => {
      ang += curl * f.k * (0.35 + j * 0.15);
      const step = add(mul(d, Math.cos(ang)), mul([0, 0, 1], Math.sin(ang)));
      p = add(p, mul(step, len));
      joints.push(p);
    });
  });
  return joints;
}

/** Builds the dotted hand (bone sleeves, palm grid, joints) for a finger curl. */
export function buildHand(curl: number): HandModel {
  const joints = jointsFor(curl);
  const pts: HandPoint[] = [];
  BONES.forEach(([i, k], bi) => {
    const a = joints[i];
    const b = joints[k];
    const d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let u = cross(d, [0, 0, 1]);
    if (Math.hypot(u[0], u[1], u[2]) < 0.1) u = cross(d, [1, 0, 0]);
    u = norm(u);
    const v = cross(d, u);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(2, Math.round(len / 0.75));
    const rad = k >= 17 || k <= 4 ? 0.5 : 0.6;
    for (let s = 0; s < n; s++) {
      const q = s / n;
      const c = [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
      for (let m = 0; m < 3; m++) {
        const phi = (m / 3) * Math.PI * 2 + s * 0.9 + bi;
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        pts.push({
          p: [c[0] + rad * (cp * u[0] + sp * v[0]), c[1] + rad * (cp * u[1] + sp * v[1]), c[2] + rad * (cp * u[2] + sp * v[2])],
          joint: false,
          tip: false,
        });
      }
    }
  });
  for (let gx = -2.6; gx <= 3.6; gx += 1.1) {
    for (let gy = 1.2; gy <= 6.2; gy += 1.1) {
      const w = 2.6 + (gy / 6.2) * 1.4;
      if (gx < -w + 0.4 || gx > w * 0.9 + 0.2) continue;
      pts.push({ p: [gx, gy, 0.55], joint: false, tip: false });
      pts.push({ p: [gx + 0.4, gy + 0.5, -0.55], joint: false, tip: false });
    }
  }
  joints.forEach((p, i) => pts.push({ p, joint: true, tip: TIP_JOINTS.includes(i) }));
  return { pts, joints, bones: BONES };
}

/** Rotates the model by yaw and pitch, applies perspective, and sorts dots back to front. */
export function projectHand(model: HandModel, yaw: number, pitch: number): ProjectedHand {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const proj = (p: Vec3) => {
    const x0 = p[0] - 0.4;
    const y0 = p[1] - 6.6;
    const z0 = p[2];
    const x1 = x0 * cy + z0 * sy;
    const z1 = -x0 * sy + z0 * cy;
    const y1 = y0 * cp - z1 * sp;
    const z2 = y0 * sp + z1 * cp;
    const k = CAMERA_DISTANCE / (CAMERA_DISTANCE - z2);
    return { x: 200 + x1 * SCALE * k, y: 205 - y1 * SCALE * k, z: z2 };
  };
  const points = model.pts.map(({ p, joint, tip }): ProjectedPoint => {
    const q = proj(p);
    const depth = Math.min(1, Math.max(0, (q.z + 4) / 8));
    return {
      x: q.x,
      y: q.y,
      z: q.z,
      r: joint ? 3.6 : 1.5 + depth * 1.1,
      o: joint ? 1 : 0.22 + depth * 0.6,
      tip,
      joint,
      color: joint && tip ? 'accent' : 'ink',
    };
  });
  points.sort((a, b) => a.z - b.z);
  const bones = model.bones.map(([i, k]): ProjectedBone => {
    const a = proj(model.joints[i]);
    const b = proj(model.joints[k]);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: 1, o: 0.12, color: 'ink' };
  });
  return { points, bones };
}
