// Deterministic fake pose generator for demos without a webcam: a seated, side-on forward reach.
// DEMO-ONLY numbers: body proportions, timings, lean/hike sizes and the visibility dip are chosen to look
// plausible on screen. They are not clinical values and not thresholds (those live in lib/config.ts).
import type { Point2, PoseFrame, Side } from '../lib/types';

export const FAKE_ASPECT = 16 / 9;

// Phase lengths of one 5 s rep (ms). The remainder of the cycle is rest, so rest lasts 1.7 s across a cycle boundary.
const REST_MS = 1200;
const REACH_MS = 1500;
const HOLD_MS = 500;
const RETURN_MS = 1300;
const CYCLE_MS = 5000;

// Body proportions in square units (frame height = 1). The figure faces +x for a right-side view.
const HIP = { x: 0.6, y: 0.72 };
const TRUNK = 0.34;
const NECK = 0.13;
const UPPER_ARM = 0.17;
const FOREARM = 0.16;

const MAX_FLEX_DEG = 85;
const REST_ELBOW_BEND_DEG = 12;
const REACH_ELBOW_BEND_DEG = 5;
const LEAN_DEG = 16;
const HIKE_FRACTION = 0.3; // of the ear-to-shoulder distance
const JITTER = 0.002;
const DIP_EVERY_REPS = 7;
const DIP_START_MS = 2800; // inside the hold, so the dip is easy to see
const DIP_MS = 300;
const DEG_TO_RAD = Math.PI / 180;

/** Cosine ease-in-out from 0 to 1. */
function ease(x: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

/** How far through the reach the arm is (0 = rest, 1 = fully reached) at `phaseMs` into the rep. */
function reachProgress(phaseMs: number): number {
  if (phaseMs < REST_MS) return 0;
  if (phaseMs < REST_MS + REACH_MS) return ease((phaseMs - REST_MS) / REACH_MS);
  if (phaseMs < REST_MS + REACH_MS + HOLD_MS) return 1;
  if (phaseMs < REST_MS + REACH_MS + HOLD_MS + RETURN_MS) {
    return 1 - ease((phaseMs - REST_MS - REACH_MS - HOLD_MS) / RETURN_MS);
  }
  return 0;
}

/** Small smooth deterministic wobble in [-JITTER, JITTER] for coordinate number `k`. */
function jitter(ms: number, k: number): number {
  return JITTER * Math.sin(ms * 0.0123 * (1 + k * 0.37) + k * 7.3);
}

/** Create a pose source for the given side: call it with performance.now() to get the pose at that moment. */
export function createFakePoseSource(side: Side): (t: number) => PoseFrame {
  let t0: number | null = null;

  /** Build a Point2 from square-unit coordinates, mirroring for a left-side view and adding jitter. */
  const point = (X: number, Y: number, k: number, ms: number, vis: number): Point2 => {
    const sx = side === 'left' ? FAKE_ASPECT - X : X;
    return { x: (sx + jitter(ms, 2 * k)) / FAKE_ASPECT, y: Y + jitter(ms, 2 * k + 1), vis };
  };

  return (t) => {
    t0 ??= t;
    const ms = t - t0;
    const rep = Math.floor(ms / CYCLE_MS);
    const phase = ms - rep * CYCLE_MS;
    const p = reachProgress(phase);
    const kind = rep % 4; // 0 and 2 clean, 1 trunk lean, 3 shoulder hike

    const lean = (kind === 1 ? LEAN_DEG * p : 0) * DEG_TO_RAD;
    const hikeY = kind === 3 ? HIKE_FRACTION * NECK * p : 0;

    const shoulderX = HIP.x + TRUNK * Math.sin(lean);
    const shoulderBaseY = HIP.y - TRUNK * Math.cos(lean);
    const earX = shoulderX;
    const earY = shoulderBaseY - NECK; // the head stays put, so a hike shortens ear-to-shoulder
    const shoulderY = shoulderBaseY - hikeY;

    // Arm angles are measured from straight down, + toward the front. Flexion is relative to the trunk.
    const upperAngle = -lean + MAX_FLEX_DEG * p * DEG_TO_RAD;
    const bend = (REST_ELBOW_BEND_DEG + (REACH_ELBOW_BEND_DEG - REST_ELBOW_BEND_DEG) * p) * DEG_TO_RAD;
    const elbowX = shoulderX + UPPER_ARM * Math.sin(upperAngle);
    const elbowY = shoulderY + UPPER_ARM * Math.cos(upperAngle);
    const wristX = elbowX + FOREARM * Math.sin(upperAngle + bend);
    const wristY = elbowY + FOREARM * Math.cos(upperAngle + bend);

    const dipping =
      rep % DIP_EVERY_REPS === DIP_EVERY_REPS - 1 && phase >= DIP_START_MS && phase < DIP_START_MS + DIP_MS;
    const vis = (k: number) => (dipping ? 0.3 : 0.94 + 0.04 * Math.sin(ms * 0.003 + k));

    return {
      t,
      side,
      ear: point(earX, earY, 0, ms, vis(0)),
      shoulder: point(shoulderX, shoulderY, 1, ms, vis(1)),
      elbow: point(elbowX, elbowY, 2, ms, vis(2)),
      wrist: point(wristX, wristY, 3, ms, vis(3)),
      hip: point(HIP.x, HIP.y, 4, ms, vis(4)),
    };
  };
}
