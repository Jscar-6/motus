// Live webcam with pose and hand tracking. Pages get each PoseFrame, the video's width/height ratio and the hand
// point (hand.ts) via onPose;
// `debug` draws the tracked points.
import { useEffect, useRef, useState } from 'react';
import { FORWARD_REACH } from '../lib/config';
import type { PoseFrame, Side } from '../lib/types';
import { useCamera } from './camera';
import { HandTracker, type HandPoint } from './hand';
import { PoseTracker, runPoseLoop, startCamera, stopCamera } from './pose';

interface Props {
  side: Side;
  onPose?: (frame: PoseFrame | null, aspect: number, hand: HandPoint | null) => void;
  debug?: boolean;
}

const BONES: [keyof PoseFrame, keyof PoseFrame][] = [
  ['ear', 'shoulder'],
  ['shoulder', 'hip'],
  ['shoulder', 'elbow'],
  ['elbow', 'wrist'],
];
const JOINTS = ['ear', 'shoulder', 'elbow', 'wrist', 'hip'] as const;

/** Draw the five tracked points and the lines between them. */
function drawDebug(canvas: HTMLCanvasElement, frame: PoseFrame | null): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;
  const px = (k: keyof PoseFrame) => {
    const p = frame[k] as { x: number; y: number };
    return [p.x * canvas.width, p.y * canvas.height] as const;
  };
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 4;
  for (const [a, b] of BONES) {
    ctx.beginPath();
    ctx.moveTo(...px(a));
    ctx.lineTo(...px(b));
    ctx.stroke();
  }
  for (const j of JOINTS) {
    const [x, y] = px(j);
    ctx.fillStyle = (frame[j].vis ?? 0) >= FORWARD_REACH.visMin ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Webcam view that tracks the pose of the given side and reports each frame. */
export default function CameraView({ side, onPose, debug = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'running' | 'error'>('loading');
  const [error, setError] = useState('');
  const sideRef = useRef(side);
  const onPoseRef = useRef(onPose);
  const debugRef = useRef(debug);
  const cameraId = useCamera((s) => s.chosen?.deviceId ?? null);  // a new camera choice restarts the stream
  sideRef.current = side;
  onPoseRef.current = onPose;
  debugRef.current = debug;

  useEffect(() => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let tracker: PoseTracker | null = null;
    let hands: HandTracker | null = null;
    let stopLoop = () => {};

    const release = () => {
      stopLoop();
      tracker?.close();
      hands?.close();
      if (stream) stopCamera(stream);
    };

    (async () => {
      try {
        stream = await startCamera(video);
        tracker = await PoseTracker.create();
        // The hand model only sharpens the hand point; without it the pose model's hand points are used.
        hands = await HandTracker.create().catch((e) => (console.warn('Hand model unavailable:', e), null));
        if (cancelled) return release();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const aspect = video.videoWidth / video.videoHeight;
        stopLoop = runPoseLoop(video, tracker, () => sideRef.current, (frame, hand) => {
          onPoseRef.current?.(frame, aspect, hand);
          if (debugRef.current) drawDebug(canvas, frame);
        }, hands);
        setStatus('running');
      } catch (e) {
        if (cancelled) return release();
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      release();
    };
  }, [cameraId]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {status === 'loading' && <p>Starting camera and pose model…</p>}
      {status === 'error' && <p style={{ color: '#ef4444' }}>Camera or pose model failed: {error}</p>}
    </div>
  );
}
