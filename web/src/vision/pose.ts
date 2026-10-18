// Webcam + MediaPipe PoseLandmarker (lite) → PoseFrame for the patient's affected side (PLAN.md §6.1, task C1).
// Model and WASM are served locally (web/public), so pose tracking needs no internet during the demo.
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Point2, PoseFrame, Side } from '../lib/types';
import { pickHandPoint, type HandPoint, type HandTracker } from './hand';

const WASM_PATH = '/mediapipe-wasm';
const MODEL_PATH = '/models/pose_landmarker_lite.task';

// BlazePose landmark indices from the MediaPipe pose model card. left/right is the person's own side.
const LANDMARKS: Record<Side, Record<'ear' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'pinky' | 'index', number>> = {
  left: { ear: 7, shoulder: 11, elbow: 13, wrist: 15, hip: 23, pinky: 17, index: 19 },
  right: { ear: 8, shoulder: 12, elbow: 14, wrist: 16, hip: 24, pinky: 18, index: 20 },
};

/** One detection: the PoseFrame plus the pose model's own hand points (fallback for the hand point, hand.ts). */
export interface PoseDetection { frame: PoseFrame; poseHand: { index: Point2; pinky: Point2 } }

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
  detect(video: HTMLVideoElement, side: Side, t: number): PoseDetection | null {
    const pose = this.landmarker.detectForVideo(video, t).landmarks[0];
    if (!pose) return null;
    const idx = LANDMARKS[side];
    return {
      frame: {
        t,
        side,
        ear: toPoint(pose[idx.ear]),
        shoulder: toPoint(pose[idx.shoulder]),
        elbow: toPoint(pose[idx.elbow]),
        wrist: toPoint(pose[idx.wrist]),
        hip: toPoint(pose[idx.hip]),
      },
      poseHand: { index: toPoint(pose[idx.index]), pinky: toPoint(pose[idx.pinky]) },
    };
  }

  /** Free the model's memory. */
  close(): void {
    this.landmarker.close();
  }
}

// SOURCE: One Euro filter (Casiez, Roussel & Vogel, CHI 2012); parameters are placeholders hand-tuned on the
// pose check page. Cutoffs in Hz; beta raises the cutoff with speed (normalized image units per second), so
// the points are smoothed hard when still and follow quickly during a reach.
export const PLACEHOLDER_SMOOTH_MIN_CUTOFF_HZ = 1.0;
export const PLACEHOLDER_SMOOTH_BETA = 5.0;
const SMOOTH_D_CUTOFF_HZ = 1.0; // derivative cutoff; the paper's recommended default

/** Smoothing factor for a low-pass filter with the given cutoff at time step dt (seconds). */
function alpha(cutoffHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}

/** One Euro filter for a single coordinate. */
class OneEuro {
  private x: number | null = null;
  private dx = 0;

  /** Filter value v at time step dt (seconds). */
  filter(v: number, dt: number): number {
    if (this.x === null || dt <= 0) return (this.x = v);
    const aD = alpha(SMOOTH_D_CUTOFF_HZ, dt);
    this.dx = aD * ((v - this.x) / dt) + (1 - aD) * this.dx;
    const a = alpha(PLACEHOLDER_SMOOTH_MIN_CUTOFF_HZ + PLACEHOLDER_SMOOTH_BETA * Math.abs(this.dx), dt);
    return (this.x = a * v + (1 - a) * this.x);
  }
}

const JOINTS = ['ear', 'shoulder', 'elbow', 'wrist', 'hip'] as const;

/** Smooths PoseFrame points over time; restarts when the person is lost or the tracked side changes. */
class PoseSmoother {
  private filters = JOINTS.map(() => [new OneEuro(), new OneEuro()]);
  private last: PoseFrame | null = null;

  /** Smoothed copy of the frame (visibility is passed through unchanged). */
  push(f: PoseFrame | null): PoseFrame | null {
    if (!f || (this.last && this.last.side !== f.side)) this.filters = JOINTS.map(() => [new OneEuro(), new OneEuro()]);
    if (!f) return (this.last = null);
    const dt = this.last ? (f.t - this.last.t) / 1000 : 0;
    const out = { ...f };
    JOINTS.forEach((j, i) => {
      const [fx, fy] = this.filters[i];
      out[j] = { ...f[j], x: fx.filter(f[j].x, dt), y: fy.filter(f[j].y, dt) };
    });
    return (this.last = out);
  }
}

/** Smooths the hand point with the same One Euro settings as the joints; restarts when the hand is lost. */
class HandSmoother {
  private fx = new OneEuro();
  private fy = new OneEuro();
  private lastT: number | null = null;

  /** Smoothed copy of the hand point at time t (ms). */
  push(h: HandPoint | null, t: number): HandPoint | null {
    if (!h) {
      [this.fx, this.fy, this.lastT] = [new OneEuro(), new OneEuro(), null];
      return null;
    }
    const dt = this.lastT === null ? 0 : (t - this.lastT) / 1000;
    this.lastT = t;
    return { ...h, x: this.fx.filter(h.x, dt), y: this.fy.filter(h.y, dt) };
  }
}

/**
 * Run detection on every new video frame (smoothed) until the returned stop function is called. With a hand
 * tracker, each frame also gets a hand point (hand.ts); without one, the hand point uses the pose model only.
 */
export function runPoseLoop(
  video: HTMLVideoElement,
  tracker: PoseTracker,
  getSide: () => Side,
  onFrame: (frame: PoseFrame | null, hand: HandPoint | null) => void,
  hands: HandTracker | null = null,
): () => void {
  let rafId = 0;
  let lastVideoTime = -1;
  const smoother = new PoseSmoother();
  const handSmoother = new HandSmoother();
  const tick = () => {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const t = performance.now();
      const det = tracker.detect(video, getSide(), t);
      const frame = smoother.push(det?.frame ?? null);
      const palms = frame && hands ? hands.detect(video, t) : [];
      const aspect = video.videoWidth / video.videoHeight;
      const hand = frame && det ? pickHandPoint(frame, palms, det.poseHand, aspect) : null;
      onFrame(frame, handSmoother.push(hand, t));
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
