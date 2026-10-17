// Simulated sleeve for testing the arm without hardware: 50 Hz frames of upper arm, forearm and chest quaternions.
// STUB(A3): replace when A3 merges
import * as THREE from 'three';
import { pushSensorFrame } from './armInput';
import type { Quat } from '../lib/types';

const PERIOD_MS = 20;

/** Starts feeding simulated SensorFrames to pushSensorFrame; returns the stop function. */
export function startSimSensor(): () => void {
  const t0 = performance.now();
  const E = new THREE.Euler();
  const qC = new THREE.Quaternion();
  const qU = new THREE.Quaternion();
  const qF = new THREE.Quaternion();
  const d = new THREE.Quaternion();
  const arr = (q: THREE.Quaternion): Quat => [q.w, q.x, q.y, q.z];
  const timer = setInterval(() => {
    const now = performance.now();
    const t = (now - t0) / 1000;
    qC.setFromEuler(E.set(0, Math.sin(t * 0.3) * 0.05, Math.sin(t * 0.4) * 0.04));
    qU.setFromEuler(E.set(Math.sin(t * 0.7) * 0.25, Math.sin(t * 0.5) * 0.35, Math.sin(t * 0.6) * 0.3));
    qF.copy(qU).multiply(d.setFromEuler(E.set(Math.sin(t * 1.1) * 0.4, 0, 0.35 + 0.35 * Math.sin(t * 0.9))));
    pushSensorFrame({ t: now, upper: arr(qU), fore: arr(qF), chest: arr(qC) });
  }, PERIOD_MS);
  return () => clearInterval(timer);
}
