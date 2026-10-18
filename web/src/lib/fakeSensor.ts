// Fake sleeve (A3): emits the same `D,` / `S,` lines as the ESP32 at 100 Hz, so S1/S2/S3 and the 3D arm run
// without hardware. The script is a seated forward reach (demo-only numbers, not data): 3.5 s at rest, then
// 4 s reps that cycle clean → trunk lean → trunk rotation. fakeFrameAt() also returns the true angles, so the
// math in orientation.ts can be checked against them.
import { qFromBasis, qMul, cross, type Vec3 } from './orientation';
import type { LineSource } from './serial';
import type { Quat, Side } from './types';

export interface FakeSleeveOptions {
  side?: Side;
  restMs?: number;
  repMs?: number;
  headingDeg?: number;  // patient's facing in the sensors' shared frame: the math must not depend on it
  noiseDeg?: number;    // random wobble per sensor per frame
  onCommand?: (line: string) => void;  // sees every V / G / P the app sends
}

export interface FakeFrame {
  upper: Quat; fore: Quat; chest: Quat;
  truth: { leanDeg: number; rotDeg: number; elbowDeg: number; shoulderFlexDeg: number };
}

const RAD = Math.PI / 180;
const PERIOD_MS = 10;  // 100 Hz, like the firmware
const ZERO_MS = 2000;  // `G` pauses the stream this long, like the firmware

/** Rotation of angleDeg about a unit axis. */
function axisAngle(axis: Vec3, angleDeg: number): Quat {
  const h = (angleDeg * RAD) / 2;
  const s = Math.sin(h);
  return [Math.cos(h), axis[0] * s, axis[1] * s, axis[2] * s];
}

/**
 * How each sensor sits on the body at rest, as a rotation from sensor axes to body axes
 * (body: x forward, y the patient's left, z up). Arm sensors: face pointing out to the side, arrow toward the
 * hand (down). Chest sensor: face forward, arrow up.
 */
function mounts(side: Side): { upper: Quat; fore: Quat; chest: Quat } {
  const out: Vec3 = side === 'right' ? [0, -1, 0] : [0, 1, 0];
  const down: Vec3 = [0, 0, -1];
  const arm = qFromBasis(cross(down, out), down, out);
  const fwd: Vec3 = [1, 0, 0];
  const up: Vec3 = [0, 0, 1];
  return { upper: arm, fore: arm, chest: qFromBasis(cross(up, fwd), up, fwd) };
}

/** Sensor quaternions and true body angles at time tMs of the script. */
export function fakeFrameAt(tMs: number, opts: FakeSleeveOptions = {}): FakeFrame {
  const { side = 'right', restMs = 3500, repMs = 4000, headingDeg = 37, noiseDeg = 0 } = opts;
  let s = 0;
  let rep = 0;
  if (tMs > restMs) {
    const r = (tMs - restMs) / repMs;
    rep = Math.floor(r);
    s = 0.5 - 0.5 * Math.cos(2 * Math.PI * (r - rep));  // 0 → 1 → 0 within each rep
  }
  const shoulderFlexDeg = 65 * s;
  const elbowFlex = 30 * Math.sin(Math.PI * s);
  const leanDeg = rep % 3 === 1 ? 15 * s : 0;
  const rotDeg = rep % 3 === 2 ? 12 * s : 0;

  const Y: Vec3 = [0, 1, 0];
  const Z: Vec3 = [0, 0, 1];
  const trunk = qMul(axisAngle(Z, rotDeg), axisAngle(Y, leanDeg));
  const upperArm = qMul(trunk, axisAngle(Y, -shoulderFlexDeg));
  const forearm = qMul(upperArm, axisAngle(Y, -elbowFlex));
  const world = axisAngle(Z, headingDeg);
  const m = mounts(side);
  const wobble = (): Quat => axisAngle(unitRandom(), noiseDeg * (Math.random() * 2 - 1));
  const sensor = (body: Quat, mount: Quat) => qMul(wobble(), qMul(world, qMul(body, mount)));
  return {
    upper: sensor(upperArm, m.upper),
    fore: sensor(forearm, m.fore),
    chest: sensor(trunk, m.chest),
    truth: { leanDeg, rotDeg, elbowDeg: 180 - elbowFlex, shoulderFlexDeg },
  };
}

/** Random unit vector, for the wobble axis. */
function unitRandom(): Vec3 {
  const v: Vec3 = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
  const n = Math.hypot(...v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Format a quaternion like the firmware does (4 decimals). */
function fmt(q: Quat): string {
  return q.map((v) => v.toFixed(4)).join(',');
}

/** A fake sleeve as a LineSource: plug it into SleeveLink instead of SerialLineSource. */
export function fakeSleeve(opts: FakeSleeveOptions = {}): LineSource {
  let timer: ReturnType<typeof setInterval> | null = null;
  let t0 = 0;
  let pausedUntil = 0;
  let emit: (line: string) => void = () => undefined;
  return {
    async start(onLine) {
      emit = onLine;
      t0 = performance.now();
      emit('S,READY');
      timer = setInterval(() => {
        const now = performance.now();
        if (now < pausedUntil) return;
        const f = fakeFrameAt(now - t0, { noiseDeg: 0.3, ...opts });
        emit(`D,${Math.round(now - t0)},${fmt(f.upper)},${fmt(f.fore)},${fmt(f.chest)}`);
      }, PERIOD_MS);
    },
    async write(line) {
      opts.onCommand?.(line);
      if (line === 'P') emit('S,PONG');
      if (line === 'G') {
        pausedUntil = performance.now() + ZERO_MS;
        setTimeout(() => emit('S,ZERO_OK'), ZERO_MS);
      }
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
