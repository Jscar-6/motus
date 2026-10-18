// One shared sleeve connection for the whole app (S1–S3 integration). Frames go to arm/armInput's
// pushSensorFrame; the vision model calls captureSleeveRest / withSleeve / buzzOnFlags; PoseFusion reads
// sleeveBodyRotations. Without a sleeve every function here is a no-op, so camera-only mode is unchanged.
import { create } from 'zustand';
import { latestSensor, pushSensorFrame, sensorStatus } from '../arm/armInput';
import { fakeSleeve } from '../lib/fakeSensor';
import {
  bodyRotationsSinceRest, captureRestQuats, mergeSleeveFeatures, sleeveFeatures, sleeveRest, type SleeveRest,
} from '../lib/orientation';
import { SerialLineSource, SleeveLink, type SleeveStatus } from '../lib/serial';
import { createBuzzController, type BuzzController } from '../lib/sleeveBuzz';
import type { CompLabel, FrameFeatures, Mode, Quat } from '../lib/types';
import { useLive } from '../live/store';

export type SleeveConn = 'off' | 'connecting' | 'live' | 'zeroing' | 'error';

interface SleeveState {
  conn: SleeveConn;
  source: 'usb' | 'demo' | null;
  zero: 'none' | 'ok' | 'moved' | 'timeout';
  lostImus: (1 | 2 | 3)[];  // IMU numbers from S,IMU_FAIL (1 upper arm, 2 forearm, 3 chest)
  restReady: boolean;       // a sleeve rest pose exists, so sleeve features are live
  chestUpright: boolean;
  error?: string;
}

export const useSleeve = create<SleeveState>(() => ({
  conn: 'off', source: null, zero: 'none', lostImus: [], restReady: false, chestUpright: true,
}));

let link: SleeveLink | null = null;
let rest: SleeveRest | null = null;
let buzz: BuzzController | null = null;

/** Drop the rest pose (after a reboot or re-zero the filters start over, so the old one no longer applies). */
function clearRest(): void {
  rest = null;
  useSleeve.setState({ restReady: false });
}

/** Track IMU loss/recovery and board restarts from status lines. */
function onStatus(s: SleeveStatus): void {
  if (s === 'ready') {
    clearRest();
    useSleeve.setState({ zero: 'none', lostImus: [] });
  } else if (s.startsWith('imu_fail_')) {
    const n = Number(s.slice(-1)) as 1 | 2 | 3;
    useSleeve.setState((st) => ({ lostImus: st.lostImus.includes(n) ? st.lostImus : [...st.lostImus, n] }));
  } else if (s.startsWith('imu_ok_')) {
    const n = Number(s.slice(-1));
    useSleeve.setState((st) => ({ lostImus: st.lostImus.filter((i) => i !== n) }));
  }
}

/** Forget the connection and reset the state shown in the UI. */
function teardown(): void {
  link = null;
  buzz = null;
  clearRest();
  useSleeve.setState({ conn: 'off', source: null, zero: 'none', lostImus: [] });
}

/** Connect the USB sleeve (call from a click: Chrome shows a port picker) or the demo sleeve. */
export async function connectSleeve(source: 'usb' | 'demo'): Promise<void> {
  if (link) return;
  useSleeve.setState({ conn: 'connecting', source, error: undefined });
  const l = new SleeveLink(source === 'usb' ? new SerialLineSource() : fakeSleeve());
  l.onFrame(pushSensorFrame);
  l.onStatus(onStatus);
  l.onClose(() => {
    if (link === l) teardown();
  });
  try {
    await l.connect();
  } catch (e) {
    const cancelled = e instanceof DOMException && e.name === 'NotFoundError';  // user closed the port picker
    useSleeve.setState({ conn: cancelled ? 'off' : 'error', source: null, error: e instanceof Error ? e.message : String(e) });
    return;
  }
  link = l;
  buzz = createBuzzController((motor, pattern) => void l.buzz(motor, pattern));
  useSleeve.setState({ conn: 'live' });
}

/** Turn the motors off and close the connection. */
export async function disconnectSleeve(): Promise<void> {
  const l = link;
  if (!l) return;
  buzz?.stop();
  teardown();
  await l.disconnect();
}

/** `G` with the sleeve flat and still, X arrows aligned (docs/sleeve.md). Clears the rest pose. */
export async function zeroSleeve(): Promise<void> {
  if (!link) return;
  useSleeve.setState({ conn: 'zeroing' });
  const result = await link.zero();
  clearRest();
  if (link) useSleeve.setState({ conn: 'live', zero: result });
}

/** Store the current sleeve orientation as rest; call when the camera's rest pose is captured. */
export function captureSleeveRest(): void {
  const f = latestSensor();
  if (!link || !f || sensorStatus() !== 'streaming') return clearRest();
  rest = sleeveRest(captureRestQuats(f));
  useSleeve.setState({ restReady: true, chestUpright: rest.chestUpright });
}

/** True when sleeve features can be trusted right now: streaming, a rest pose, and no lost IMU. */
function sleeveUsable(): boolean {
  return !!rest && sensorStatus() === 'streaming' && useSleeve.getState().lostImus.length === 0;
}

/** Camera features with lean, rotation and elbow taken from the sleeve when it's usable (PLAN.md §6.1). */
export function withSleeve(camera: FrameFeatures | null): FrameFeatures | null {
  const f = latestSensor();
  if (!camera || !f || !sleeveUsable()) return camera;
  return mergeSleeveFeatures(camera, sleeveFeatures(f, rest!));
}

/** Current measurement mode, for rep results and badges. */
export function sleeveMode(): Mode {
  return sleeveUsable() ? 'camera+sleeve' : 'camera';
}

/** Buzz the motors for the currently flagged labels (S3), using the therapist's buzz sensitivity (F10). */
export function buzzOnFlags(flags: readonly CompLabel[]): void {
  buzz?.update(flags, useLive.getState().buzz, performance.now());
}

/** Each segment's rotation since the sleeve rest pose in the 3D arm's body frame, or null without one. */
export function sleeveBodyRotations(): { upper: Quat; fore: Quat; chest: Quat } | null {
  const f = latestSensor();
  return f && sleeveUsable() ? bodyRotationsSinceRest(f, rest!) : null;
}
