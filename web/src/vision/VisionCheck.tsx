// The camera-only vision model (C1–C5) as one component: webcam pose tracking, rest-pose capture, live §6.1
// features, near/far target touch, reps and rule verdicts. Used by the pose check page and the Session page.
import { FORWARD_REACH } from '../lib/config';
import type { RestCaptureStatus } from '../lib/features';
import CameraView from './CameraView';
import { graspPoint, targetFromClick } from './target';
import { useVisionModel } from './useVisionModel';

const REJECT_TEXT = { no_person: 'no person in view', hidden: 'a body point is hidden', moving: 'you moved' };

/** Readable text for the rest-pose capture state. */
function captureText(s: RestCaptureStatus | null): string {
  if (!s) return 'not captured: sit upright, arm hanging down, then click Capture';
  if (s.kind === 'holding') return `hold still… ${Math.round(s.progress * 100)}%`;
  if (s.kind === 'rejected') return `restarting: ${REJECT_TEXT[s.reason]}`;
  return 'captured ✓ (features below are relative to it)';
}

/** Shows the webcam with tracked points, a side toggle, rest-pose capture, live §6.1 features, target touch, reps and rules. */
export default function VisionCheck() {
  const {
    side, frame, features, capture, fps, aspect, near, target, touching, inRep, reps, rules,
    onPose, pickSide, pickNear, requestCapture, setTarget,
  } = useVisionModel();

  const n = (v: number | null | undefined, d = 1) => (v == null ? '—' : v.toFixed(d));
  const r = FORWARD_REACH.touchRadius!;
  const tip = frame ? graspPoint(frame) : null;

  return (
    <div style={{ fontFamily: 'system-ui', padding: 16, maxWidth: 960, margin: '0 auto' }}>
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
        <button onClick={requestCapture}>Capture rest pose</button> {captureText(capture)}
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
            <tr><td>Reps</td><td>{reps.length}{inRep ? ' · IN REP' : ''}</td></tr>
            {rules?.checks.map((c) => (
              <tr key={c.key} style={{ color: !c.enabled ? '#9ca3af' : c.flagged ? '#f87171' : c.level === 'warn' ? '#fbbf24' : '#4ade80' }}>
                <td>Rule: {c.label}</td>
                <td>{!c.enabled ? `off (${c.reason})` : c.flagged ? 'FLAG' : c.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table style={{ fontVariantNumeric: 'tabular-nums', margin: '12px 0', borderSpacing: '12px 2px' }}>
        <thead>
          <tr><th>Rep</th><th>Time (s)</th><th>Reached</th><th>Max lean °</th><th>Max hike</th><th>Min elbow °</th><th>Max flex °</th><th>Min vis</th><th>Rule verdict</th></tr>
        </thead>
        <tbody>
          {reps.map((r) => (
            <tr key={r.repId}>
              <td>{r.repId}</td><td>{n((r.tEnd - r.tStart) / 1000)}</td><td>{r.reached ? 'yes' : 'NO'}</td>
              <td>{n(r.maxLeanDeg)}</td><td>{n(r.maxHikeRatio, 3)}</td><td>{n(r.minElbowDeg)}</td>
              <td>{n(r.maxShoulderFlexDeg)}</td><td>{n(r.minVis, 2)}</td><td>{r.ruleFlags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <pre>{frame ? JSON.stringify(frame, (_, v) => (typeof v === 'number' ? +v.toFixed(3) : v), 2) : '—'}</pre>
    </div>
  );
}
