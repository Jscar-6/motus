// Bone rig for the dotted arm: shoulder, elbow, wrist and fingers, plus the surface sampler that attaches dots to bones.
// Bone local +X runs along the limb, the palm faces -Z, and finger curl is a +Y rotation.
import * as THREE from 'three';
import { armConfig } from './armConfig';
import type { Vec3 } from './textSampler';

/** Rotations since calibration, in the arm model's frame. Missing segments count as identity. */
export interface ArmPose {
  segments: Partial<Record<'chest' | 'upperArm' | 'forearm', THREE.Quaternion>>;
}

/** One dot on the arm: bone-local position and normal, owning bone, fade, and rest-pose world X (for pairing). */
export interface SurfacePoint {
  pos: Vec3;
  nrm: Vec3;
  bone: number;
  fade: number;
  wx: number;
}

interface Tube {
  type: 'tube';
  bone: THREE.Object3D;
  len: number;
  r0: number;
  r1: number;
  sy: number;
  sz: number;
  bulge: number;
  bulgeAt: number;
  fadeIn?: number;
}
interface Sphere {
  type: 'sphere';
  bone: THREE.Object3D;
  r: number;
  sy: number;
  sz: number;
  center: Vec3;
}
type Part = Tube | Sphere;
type TubeOpts = Pick<Tube, 'len' | 'r0' | 'r1'> & Partial<Pick<Tube, 'sy' | 'sz' | 'bulge' | 'bulgeAt' | 'fadeIn'>>;
type SphereOpts = Pick<Sphere, 'r'> & Partial<Pick<Sphere, 'sy' | 'sz' | 'center'>>;

// x is shifted from the reference (-3.45) so the whole arm, shoulder to fingertips, is centered on the origin.
const ROOT_POSITION: Vec3 = [-3.65, -0.35, 0];
const ROOT_REST_EULER: Vec3 = [0, -0.3, 0.06];
const FINGER_GAIN = [1.2, 1.4, 0.9];
const THUMB_GAIN = [0.3, 0.6, 0.7];

export class ArmRig {
  readonly root = new THREE.Object3D();
  readonly bones: THREE.Object3D[] = [];
  readonly byName: Record<string, THREE.Object3D> = {};
  readonly parts: Part[] = [];
  readonly fingers: Record<string, THREE.Object3D[]> = {};
  private readonly rootRest: THREE.Euler;
  private readonly rootRestQ: THREE.Quaternion;
  private readonly restQ: THREE.Quaternion[] = [];
  private readonly restE: THREE.Euler[] = [];
  private readonly tmp = new THREE.Quaternion();

  /** Builds the bone hierarchy and records every bone's rest pose. */
  constructor() {
    this.root.position.set(...ROOT_POSITION);
    this.root.rotation.set(...ROOT_REST_EULER);
    this.rootRest = this.root.rotation.clone();
    this.rootRestQ = this.root.quaternion.clone();
    this.build();
    for (const b of this.bones) {
      this.restQ.push(b.quaternion.clone());
      this.restE.push(b.rotation.clone());
    }
    this.root.updateMatrixWorld(true);
  }

  /** Adds a bone under `parent` and registers it. */
  private bone(name: string, parent: THREE.Object3D, pos: Vec3, rot: Vec3 = [0, 0, 0]): THREE.Object3D {
    const b = new THREE.Object3D();
    b.name = name;
    b.position.set(...pos);
    b.rotation.set(...rot);
    parent.add(b);
    this.bones.push(b);
    this.byName[name] = b;
    return b;
  }

  /** Registers a tapered tube of dots along the bone's +X axis. */
  private tube(bone: THREE.Object3D, o: TubeOpts): void {
    this.parts.push({ type: 'tube', bone, sy: 1, sz: 1, bulge: 0, bulgeAt: 0.4, ...o });
  }

  /** Registers an ellipsoid of dots on the bone. */
  private sphere(bone: THREE.Object3D, o: SphereOpts): void {
    this.parts.push({ type: 'sphere', bone, sy: 1, sz: 1, center: [0, 0, 0], ...o });
  }

  /** Lays out upper arm, forearm, hand and five fingers. */
  private build(): void {
    const upper = this.bone('upperArm', this.root, [0, 0, 0], [0, 0, 0.12]);
    this.tube(upper, { len: 2.7, r0: 0.5, r1: 0.38, bulge: 0.07, bulgeAt: 0.45, sz: 0.95, fadeIn: 0.9 });

    const fore = this.bone('forearm', upper, [2.7, 0, 0], [0, 0.15, -0.22]);
    this.sphere(fore, { r: 0.38, sz: 0.95 });
    this.tube(fore, { len: 2.5, r0: 0.41, r1: 0.25, bulge: 0.06, bulgeAt: 0.22, sz: 0.74 });

    const hand = this.bone('hand', fore, [2.5, 0, 0], [0, 0.05, 0.04]);
    this.sphere(hand, { r: 0.25, sy: 1.1, sz: 0.65 });
    this.tube(hand, { len: 0.95, r0: 0.3, r1: 0.33, sy: 1.25, sz: 0.42 });

    // [name, y-offset on palm, splay, segment lengths, radius]
    const fingers: [string, number, number, number[], number][] = [
      ['index', 0.27, 0.06, [0.48, 0.3, 0.22], 0.088],
      ['middle', 0.09, 0, [0.52, 0.33, 0.24], 0.09],
      ['ring', -0.09, -0.05, [0.48, 0.31, 0.22], 0.085],
      ['pinky', -0.26, -0.12, [0.38, 0.25, 0.2], 0.075],
    ];
    for (const [name, y, splay, lens, r] of fingers) this.finger(name, hand, [0.95, y, 0], [0, 0.15, splay], lens, r);
    this.finger('thumb', hand, [0.15, 0.3, -0.06], [0, 0.45, 0.95], [0.42, 0.32, 0.26], 0.12);
  }

  /** Builds a three-joint finger chain with a fingertip cap. */
  private finger(name: string, parent: THREE.Object3D, pos: Vec3, rot: Vec3, lens: number[], r: number): void {
    const chain: THREE.Object3D[] = [];
    let p = parent;
    let at = pos;
    let rt = rot;
    lens.forEach((len, i) => {
      const r0 = r * (1 - 0.1 * i);
      const r1 = r * (1 - 0.1 * (i + 1));
      const b = this.bone(`${name}${i}`, p, at, rt);
      this.sphere(b, { r: r0 * 1.04, sz: 0.9 });
      this.tube(b, { len, r0, r1, sz: 0.88 });
      chain.push(b);
      p = b;
      at = [len, 0, 0];
      rt = [0, 0.14, 0];
    });
    this.sphere(chain[chain.length - 1], { r: r * 0.68, center: [lens[lens.length - 1], 0, 0], sz: 0.88 });
    this.fingers[name] = chain;
  }

  /** Distributes `count` dots over all part surfaces, weighted by area. */
  sampleSurface(count: number): SurfacePoint[] {
    const area = (p: Part): number =>
      p.type === 'tube'
        ? (p.len * 2 * Math.PI * ((p.r0 + p.r1) / 2 + p.bulge * 0.5) * (p.sy + p.sz)) / 2
        : 0.5 * 4 * Math.PI * p.r * p.r * ((p.sy + p.sz) / 2) ** 2; // spheres are half hidden in tubes
    const areas = this.parts.map(area);
    const total = areas.reduce((a, b) => a + b, 0);
    const counts = areas.map((a) => Math.floor((count * a) / total));
    counts[0] += count - counts.reduce((a, b) => a + b, 0);

    const out: SurfacePoint[] = [];
    const v = new THREE.Vector3();
    this.parts.forEach((p, pi) => {
      for (let k = 0; k < counts[pi]; k++) {
        let pos: Vec3;
        let nrm: Vec3;
        let fade = 1;
        if (p.type === 'tube') {
          const t = Math.random();
          const th = Math.random() * Math.PI * 2;
          const r = p.r0 + (p.r1 - p.r0) * t + p.bulge * Math.exp(-(((t - p.bulgeAt) / 0.28) ** 2));
          const c = Math.cos(th);
          const s = Math.sin(th);
          const inset = 1 - Math.random() * 0.04;
          pos = [t * p.len, r * c * p.sy * inset, r * s * p.sz * inset];
          v.set(0, c / p.sy, s / p.sz).normalize();
          nrm = [v.x, v.y, v.z];
          if (p.fadeIn) fade = Math.min(1, (t * p.len) / p.fadeIn) ** 1.5;
        } else {
          const z = Math.random() * 2 - 1;
          const ph = Math.random() * Math.PI * 2;
          const q = Math.sqrt(1 - z * z);
          const ux = q * Math.cos(ph);
          const uy = q * Math.sin(ph);
          pos = [p.center[0] + ux * p.r, p.center[1] + uy * p.r * p.sy, p.center[2] + z * p.r * p.sz];
          v.set(ux, uy / p.sy, z / p.sz).normalize();
          nrm = [v.x, v.y, v.z];
        }
        const world = new THREE.Vector3(...pos).applyMatrix4(p.bone.matrixWorld);
        out.push({ pos, nrm, bone: this.bones.indexOf(p.bone), fade, wx: world.x });
      }
    });
    return out;
  }

  /** Copies current bone world matrices into the shader uniform array. */
  syncTo(mats: THREE.Matrix4[]): void {
    this.root.updateMatrixWorld(true);
    this.bones.forEach((b, i) => mats[i].copy(b.matrixWorld));
  }

  /** Returns every bone and the root to the rest pose. */
  resetPose(): void {
    this.bones.forEach((b, i) => b.quaternion.copy(this.restQ[i]));
    this.root.rotation.copy(this.rootRest);
  }

  /** Curls a finger: 0 = open hand, 1 = fist. */
  setCurl(name: string, amount: number): void {
    const chain = this.fingers[name];
    if (!chain) return;
    const gain = name === 'thumb' ? THUMB_GAIN : FINGER_GAIN;
    chain.forEach((b, i) => {
      b.rotation.copy(this.restE[this.bones.indexOf(b)]);
      b.rotation.y += amount * gain[i];
    });
  }

  /** Gentle "alive" motion while no sensor data drives the arm; amplitude 0 holds a still pose. */
  idle(t: number, amplitude: number): void {
    this.resetPose();
    this.root.rotation.y = this.rootRest.y + Math.sin(t * 0.35) * 0.2 * amplitude;
    this.root.rotation.x = this.rootRest.x + Math.sin(t * 0.27) * 0.07 * amplitude;
    Object.keys(this.fingers).forEach((n, k) => this.setCurl(n, 0.12 + 0.1 * Math.sin(t * 0.9 + k * 0.6) * amplitude));
  }

  /**
   * Applies a fused pose (rotations since calibration, model frame; C = chest, U = upper arm, F = forearm):
   * root = rootRest * C, upperArm = rest * (C^-1 * U), forearm = rest * (U^-1 * F). The hand stays at rest.
   */
  applyPose(pose: ArmPose): void {
    const { chest, upperArm, forearm } = pose.segments;
    const C = chest ?? new THREE.Quaternion();
    const U = upperArm ?? new THREE.Quaternion();
    const F = forearm ?? new THREE.Quaternion();
    this.resetPose();
    this.root.quaternion.copy(this.rootRestQ).multiply(C);
    const upper = this.byName.upperArm;
    const fore = this.byName.forearm;
    upper.quaternion.copy(this.restQ[this.bones.indexOf(upper)]).multiply(this.tmp.copy(C).invert().multiply(U));
    fore.quaternion.copy(this.restQ[this.bones.indexOf(fore)]).multiply(this.tmp.copy(U).invert().multiply(F));
    for (const name of Object.keys(this.fingers)) this.setCurl(name, armConfig.relaxedCurl);
  }
}
