// Webcam + MediaPipe PoseLandmarker (lite) → PoseFrame for the patient's affected side (PLAN.md §6.1, task C1).
// Model and WASM are served locally (web/public), so pose tracking needs no internet during the demo.
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Point2, PoseFrame, Side } from '../lib/types';

const WASM_PATH = '/mediapipe-wasm';
const MODEL_PATH = '/models/pose_landmarker_lite.task';

// BlazePose landmark indices from the MediaPipe pose model card. left/right is the person's own side.
const LANDMARKS: Record<Side, Record<'ear' | 'shoulder' | 'elbow' | 'wrist' | 'hip', number>> = {
  left: { ear: 7, shoulder: 11, elbow: 13, wrist: 15, hip: 23 },
  right: { ear: 8, shoulder: 12, elbow: 14, wrist: 16, hip: 24 },
};

/** Start the laptop webcam and play it in the given video element. */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

/** Stop every track of a camera stream. */
export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

/** Convert one MediaPipe landmark to a normalized Point2. */
function toPoint(lm: NormalizedLandmark): Point2 {
  return { x: lm.x, y: lm.y, vis: lm.visibility ?? 0 };
}

/** Wraps a MediaPipe PoseLandmarker and turns its output into PoseFrames. */
export class PoseTracker {
  private constructor(private readonly landmarker: PoseLandmarker) {}

  /** Load the pose model, on the GPU if available and the CPU otherwise. */
  static async create(): Promise<PoseTracker> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const load = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    try {
      return new PoseTracker(await load('GPU'));
    } catch {
      return new PoseTracker(await load('CPU'));
    }
  }

  /** Run pose detection on the current video frame; null when no person is found. */
  detect(video: HTMLVideoElement, side: Side, t: number): PoseFrame | null {
    const pose = this.landmarker.detectForVideo(video, t).landmarks[0];
    if (!pose) return null;
    const idx = LANDMARKS[side];
    return {
      t,
      side,
      ear: toPoint(pose[idx.ear]),
      shoulder: toPoint(pose[idx.shoulder]),
      elbow: toPoint(pose[idx.elbow]),
      wrist: toPoint(pose[idx.wrist]),
      hip: toPoint(pose[idx.hip]),
    };
  }

  /** Free the model's memory. */
  close(): void {
    this.landmarker.close();
  }
}

/** Run detection on every new video frame until the returned stop function is called. */
export function runPoseLoop(
  video: HTMLVideoElement,
  tracker: PoseTracker,
  getSide: () => Side,
  onFrame: (frame: PoseFrame | null) => void,
): () => void {
  let rafId = 0;
  let lastVideoTime = -1;
  const tick = () => {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      onFrame(tracker.detect(video, getSide(), performance.now()));
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
