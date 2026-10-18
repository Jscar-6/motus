// Hand point for the yellow dot and touch detection. MediaPipe's HandLandmarker sees the hand itself (21 points),
// which is far more precise than the pose model's arm: the dot is the palm centre of the detected hand nearest the
// tracked wrist. Fallbacks, in order: the pose model's own hand points, then the elbow→wrist line extended (target.ts).
// Kept inside vision/ so PoseFrame (lib/types.ts, a §16 contract) is unchanged.
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FORWARD_REACH } from '../lib/config';
import type { Point2, PoseFrame } from '../lib/types';
import { graspPoint } from './target';

const WASM_PATH = '/mediapipe-wasm';
const MODEL_PATH = '/models/hand_landmarker.task';
// SOURCE: MediaPipe hand landmark model card: 0 wrist, 5 / 9 / 13 / 17 the index, middle, ring and pinky knuckles.
// Their mean is the palm centre, where a grasped object sits (the same mid-hand point target.ts aims for).
const PALM = [0, 5, 9, 13, 17];

/** Where the hand point came from: the hand model, the pose model's hand points, or the forearm line. */
export type HandSource = 'hand' | 'pose' | 'forearm';
export interface HandPoint { x: number; y: number; source: HandSource }

/** Wraps a MediaPipe HandLandmarker; returns the palm centre of every hand in the frame. */
export class HandTracker {
  private constructor(private readonly landmarker: HandLandmarker) {}

  /** Load the hand model, on the GPU if available and the CPU otherwise. */
  static async create(): Promise<HandTracker> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const load = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      });
    try {
      return new HandTracker(await load('GPU'));
    } catch {
      return new HandTracker(await load('CPU'));
    }
  }

  /** Palm centres (normalized 0–1) of the hands in the current video frame. */
  detect(video: HTMLVideoElement, t: number): { x: number; y: number }[] {
    return this.landmarker.detectForVideo(video, t).landmarks.map((hand: NormalizedLandmark[]) => ({
      x: PALM.reduce((s, i) => s + hand[i].x, 0) / PALM.length,
      y: PALM.reduce((s, i) => s + hand[i].y, 0) / PALM.length,
    }));
  }

  /** Free the model's memory. */
  close(): void {
    this.landmarker.close();
  }
}

/** Distance between two normalized points in pixel-proportional units (x scaled by the aspect ratio). */
function dist(a: { x: number; y: number }, b: { x: number; y: number }, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/** Visible enough to trust, with the same cut the rules use. */
function seen(p: Point2): boolean {
  return (p.vis ?? 0) >= FORWARD_REACH.visMin;
}

/**
 * Best hand point for the tracked arm: the hand-model palm nearest the pose wrist, accepted only within one forearm
 * length of it (so it can't jump to the other hand); else the pose model's wrist / index / pinky centroid; else the
 * forearm line extended into the hand.
 */
export function pickHandPoint(
  f: PoseFrame,
  palms: { x: number; y: number }[],
  poseHand: { index: Point2; pinky: Point2 } | null,
  aspect: number,
): HandPoint {
  const forearm = dist(f.elbow, f.wrist, aspect);
  let best: { x: number; y: number } | null = null;
  for (const p of palms) {
    if (dist(p, f.wrist, aspect) <= forearm && (!best || dist(p, f.wrist, aspect) < dist(best, f.wrist, aspect))) best = p;
  }
  if (best) return { ...best, source: 'hand' };
  if (poseHand && seen(f.wrist) && seen(poseHand.index) && seen(poseHand.pinky)) {
    const pts = [f.wrist, poseHand.index, poseHand.pinky];
    return { x: pts.reduce((s, p) => s + p.x, 0) / 3, y: pts.reduce((s, p) => s + p.y, 0) / 3, source: 'pose' };
  }
  return { ...graspPoint(f), source: 'forearm' };
}
