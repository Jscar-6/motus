// Dev-only page (http://localhost:5173/pose-debug.html) to check C1 pose tracking, C2 features, and C3 target
// touch without the app shell.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FORWARD_REACH } from '../lib/config';
import { computeFeatures, RestPoseCapture, type RestCaptureStatus } from '../lib/features';
import type { FrameFeatures, PoseFrame, Side, Target } from '../lib/types';
import CameraView from './CameraView';
import { graspPoint, isTouching, targetFromClick } from './target';

const REJECT_TEXT = { no_person: 'no person in view', hidden: 'a body point is hidden', moving: 'you moved' };

/** Readable text for the rest-pose capture state. */
function captureText(s: RestCaptureStatus | null): string {
  if (!s) return 'not captured: sit upright, arm hanging down, then click Capture';
  if (s.kind === 'holding') return `hold still… ${Math.round(s.progress * 100)}%`;
  if (s.kind === 'rejected') return `restarting: ${REJECT_TEXT[s.reason]}`;
  return 'captured ✓ (features below are relative to it)';
}

/** Shows the webcam with tracked points, a side toggle, rest-pose capture, live §6.1 features, and target touch. */
function PoseDebug() {
  const [side, setSide] = useState<Side>('right');
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [features, setFeatures] = useState<FrameFeatures | null>(null);
  const [capture, setCapture] = useState<RestCaptureStatus | null>(null);
  const [fps, setFps] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);
  const [near, setNear] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [touching, setTouching] = useState(false);
  const times = useRef<number[]>([]);
  const capturing = useRef<RestPoseCapture | null>(null);
  const wantCapture = useRef(false);
  const rest = useRef<PoseFrame | null>(null);

  /** Track frame rate, run the rest capture if active, compute features, and check the target touch. */
  const onPose = (f: PoseFrame | null, aspect: number) => {
    const now = performance.now();
    setAspect(aspect);
    setTouching(!!f && !!target && isTouching(f, target, FORWARD_REACH.touchRadius!, FORWARD_REACH.visMin, aspect));
    times.current = [...times.current.filter((t) => now - t < 1000), now];
    setFps(times.current.length);
    setFrame(f);
    if (wantCapture.current) {
      wantCapture.current = false;
      capturing.current = new RestPoseCapture(FORWARD_REACH.visMin, aspect);
    }
    if (capturing.current) {
      const status = capturing.current.push(f);
      setCapture(status);
      if (status.kind === 'done') {
        rest.current = status.restPose;
        capturing.current = null;
      }
    }
    setFeatures(f && rest.current ? computeFeatures(f, rest.current, aspect) : null);
  };

  /** Pick the tracked side; an old rest pose belongs to the other side, so drop it. */
  const pickSide = (s: Side) => {
    setSide(s);
    rest.current = null;
    capturing.current = null;
    setCapture(null);
  };

  /** Pick near or far; a placed target keeps its point and takes the new choice. */
  const pickNear = (isNear: boolean) => {
    setNear(isNear);
    setTarget((t) => (t ? { ...t, near: isNear } : t));
  };

  const n = (v: number | null | undefined, d = 1) => (v == null ? '—' : v.toFixed(d));
  const r = FORWARD_REACH.touchRadius!;
  const tip = frame ? graspPoint(frame) : null;

  return (
    <main style={{ fontFamily: 'system-ui', padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1>Pose + features check</h1>
      <p>
        Side tracked:{' '}
        {(['left', 'right'] as const).map((s) => (
          <button key={s} onClick={() => pickSide(s)} disabled={s === side} style={{ marginRight: 8 }}>
            {s}
          </button>
        ))}
        · {fps} fps · {frame ? 'person found' : 'no person'}
      </p>
      <p>
        <button onClick={() => (wantCapture.current = true)}>Capture rest pose</button> {captureText(capture)}
      </p>
      <p>
        Target:{' '}
        {([true, false] as const).map((isNear) => (
          <button key={String(isNear)} onClick={() => pickNear(isNear)} disabled={isNear === near} style={{ marginRight: 8 }}>
            {isNear ? 'near' : 'far'}
          </button>
        ))}
        · {target ? 'click the video to move it' : 'click the object on the video'}
      </p>
      <div
        style={{ position: 'relative', cursor: 'crosshair' }}
        onClick={(e) => setTarget(targetFromClick(e.clientX, e.clientY, e.currentTarget.querySelector('video')!, near))}
      >
        <CameraView side={side} onPose={onPose} debug />
        {target && (
          <div
            style={{
              position: 'absolute', pointerEvents: 'none', borderRadius: '50%', border: '3px solid #38bdf8',
              left: `${(target.point[0] - r / aspect) * 100}%`, top: `${(target.point[1] - r) * 100}%`,
              width: `${(2 * r * 100) / aspect}%`, height: `${2 * r * 100}%`,
              background: touching ? 'rgba(56,189,248,0.6)' : 'transparent',
            }}
          />
        )}
        {tip && (
          <div
            style={{
              position: 'absolute', pointerEvents: 'none', width: 10, height: 10, marginLeft: -5, marginTop: -5,
              borderRadius: '50%', background: '#facc15', left: `${tip.x * 100}%`, top: `${tip.y * 100}%`,
            }}
          />
        )}
        <table
          style={{
            position: 'absolute', top: 8, left: 8, zIndex: 1, padding: 8, borderRadius: 6,
            background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 18, fontVariantNumeric: 'tabular-nums',
          }}
        >
          <tbody>
            <tr><td colSpan={2}>{side} side · {captureText(capture)}</td></tr>
            <tr><td>Trunk lean (°, forward +)</td><td>{n(features?.leanDeg)}</td></tr>
            <tr><td>Shoulder hike (ratio, up +)</td><td>{n(features?.hikeRatio, 3)}</td></tr>
            <tr><td>Elbow (°, 180 = straight)</td><td>{n(features?.elbowDeg)}</td></tr>
            <tr><td>Shoulder flexion (°, 0 = arm down)</td><td>{n(features?.shoulderFlexDeg)}</td></tr>
            <tr><td>Lowest visibility</td><td>{n(features?.vis, 2)}</td></tr>
            <tr><td>Target ({target?.near === false ? 'far' : 'near'})</td><td>{!target ? '—' : touching ? 'TOUCH' : 'no'}</td></tr>
          </tbody>
        </table>
      </div>
      <pre>{frame ? JSON.stringify(frame, (_, v) => (typeof v === 'number' ? +v.toFixed(3) : v), 2) : '—'}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PoseDebug />
  </StrictMode>,
);
