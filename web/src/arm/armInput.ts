// Live-data entry points for the arm: sleeve frames pushed in, and a 2D side-view angle estimate from the camera pose.
import * as THREE from 'three';
import { armConfig } from './armConfig';
import type { PoseFrame, Quat, SensorFrame } from '../lib/types';

export type SensorStatus = 'offline' | 'streaming' | 'stale';

export interface VisionAngles {
  confidence: number;
  angles: { upperArm: number; forearm: number; chest: number };
}

type Listener = (frame: SensorFrame) => void;

let latest: SensorFrame | null = null;
let lastAt = 0;
let rate = 0;
let windowStart = 0;
let windowCount = 0;
const listeners = new Set<Listener>();

// STUB(S1): replace when S1 merges
/** Stores the newest sleeve frame and notifies subscribers; S1's serial reader calls this for each `D,` line. */
export function pushSensorFrame(frame: SensorFrame): void {
  const now = performance.now();
  latest = frame;
  lastAt = now;
  windowCount++;
  if (now - windowStart >= 1000) {
    rate = (windowCount * 1000) / (now - windowStart);
    windowCount = 0;
    windowStart = now;
  }
  listeners.forEach((fn) => fn(frame));
}

/** Subscribes to every pushed sleeve frame; returns the unsubscribe function. */
export function onSensorFrame(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Newest sleeve frame, or null if none has arrived. */
export function latestSensor(): SensorFrame | null {
  return latest;
}

/** Sleeve frame rate in Hz, measured over the last full second. */
export function sensorRateHz(): number {
  return sensorStatus() === 'streaming' ? rate : 0;
}

/** Whether the sleeve is absent, streaming, or silent for longer than staleAfterMs. */
export function sensorStatus(): SensorStatus {
  if (!latest) return 'offline';
  return performance.now() - lastAt > armConfig.staleAfterMs ? 'stale' : 'streaming';
}

// STUB(S2): replace when S2 merges
/** Maps a sensor-frame rotation into the arm model's frame; S2's lib/orientation.ts owns the real mapping. */
function remapSensorQuat(q: THREE.Quaternion): THREE.Quaternion {
  return q;
}

/** Converts a [w,x,y,z] sleeve quaternion into a normalized model-frame THREE.Quaternion. */
export function toThreeQuat(q: Quat): THREE.Quaternion {
  return remapSensorQuat(new THREE.Quaternion(q[1], q[2], q[3], q[0]).normalize());
}

/** Image-plane angle (radians, counterclockwise, forward = +x) of the segment a to b, mirrored for the left side. */
function segmentAngle(a: { x: number; y: number }, b: { x: number; y: number }, aspect: number, side: PoseFrame['side']): number {
  const dx = (b.x - a.x) * aspect;
  const dy = -(b.y - a.y);
  return Math.atan2(dy, side === 'left' ? -dx : dx);
}

/** 2D sagittal estimate of upper arm, forearm and chest angles from one pose frame. */
export function visionSegments(pose: PoseFrame, aspect: number): VisionAngles {
  const { shoulder, elbow, wrist, hip, side } = pose;
  return {
    confidence: Math.min(shoulder.vis ?? 1, elbow.vis ?? 1, wrist.vis ?? 1),
    angles: {
      upperArm: segmentAngle(shoulder, elbow, aspect, side),
      forearm: segmentAngle(elbow, wrist, aspect, side),
      chest: segmentAngle(hip, shoulder, aspect, side),
    },
  };
}
