// Which webcam to use, shared by every camera stream on the page (the analysed CameraView and the Session's
// recording video), remembered in this browser. The side camera is usually an external USB webcam, and without a
// choice Chrome may open the laptop's own camera or a Continuity Camera iPhone instead.
import { create } from 'zustand';

const STORAGE_KEY = 'truereach.camera';
// SOURCE: full HD, the native frame of common USB webcams (e.g. Logitech Brio 101). Asking for less can make some
// cameras crop their sensor instead of scaling, which looks zoomed in; the browser picks the closest it supports.
const IDEAL = { width: 1920, height: 1080 };

interface Saved { deviceId: string; label: string }

interface CameraState {
  devices: MediaDeviceInfo[];   // video inputs; labels are empty until camera permission is granted
  chosen: Saved | null;         // null = the browser's default camera
}

/** Read the remembered camera; storage can be blocked, which just means no choice. */
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export const useCamera = create<CameraState>(() => ({ devices: [], chosen: load() }));

/** Store the choice in this browser and the page; every stream restarts on a new one. */
function save(chosen: Saved | null): void {
  try {
    if (chosen) localStorage.setItem(STORAGE_KEY, JSON.stringify(chosen));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the choice still holds for this page
  }
  useCamera.setState({ chosen });
}

/** Remember the camera with this deviceId, or the browser default for null. */
export function chooseCamera(deviceId: string | null): void {
  const d = useCamera.getState().devices.find((x) => x.deviceId === deviceId);
  save(d ? { deviceId: d.deviceId, label: d.label } : null);
}

/** Refresh the camera list; a remembered camera whose id changed is matched again by its label. */
export async function refreshCameras(): Promise<void> {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const { chosen } = useCamera.getState();
  const relabeled = chosen && !devices.some((d) => d.deviceId === chosen.deviceId)
    ? devices.find((d) => d.label && d.label === chosen.label)
    : undefined;
  useCamera.setState({ devices });
  if (relabeled) save({ deviceId: relabeled.deviceId, label: relabeled.label });
}

/** Open the chosen camera at full HD, falling back to the default camera if it's unplugged. */
export async function openCamera(): Promise<MediaStream> {
  const id = useCamera.getState().chosen?.deviceId;
  const video = { width: { ideal: IDEAL.width }, height: { ideal: IDEAL.height } };
  try {
    return await navigator.mediaDevices.getUserMedia({ video: id ? { ...video, deviceId: { exact: id } } : video, audio: false });
  } catch (e) {
    if (!id) throw e;
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  } finally {
    void refreshCameras().catch(() => undefined);
  }
}

if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', () => void refreshCameras().catch(() => undefined));
}
