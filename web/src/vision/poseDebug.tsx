// Dev-only page (http://localhost:5173/pose-debug.html) to check C1 pose tracking without the app shell.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PoseFrame, Side } from '../lib/types';
import CameraView from './CameraView';

/** Shows the webcam with tracked points, a side toggle, the frame rate, and the raw PoseFrame. */
function PoseDebug() {
  const [side, setSide] = useState<Side>('right');
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [fps, setFps] = useState(0);
  const times = useRef<number[]>([]);

  /** Keep the latest frame and a rolling one-second frame rate. */
  const onPose = (f: PoseFrame | null) => {
    const now = performance.now();
    times.current = [...times.current.filter((t) => now - t < 1000), now];
    setFps(times.current.length);
    setFrame(f);
  };

  return (
    <main style={{ fontFamily: 'system-ui', padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1>C1 pose check</h1>
      <p>
        Side tracked:{' '}
        {(['left', 'right'] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)} disabled={s === side} style={{ marginRight: 8 }}>
            {s}
          </button>
        ))}
        · {fps} fps · {frame ? 'person found' : 'no person'}
      </p>
      <CameraView side={side} onPose={onPose} debug />
      <pre>{frame ? JSON.stringify(frame, (_, v) => (typeof v === 'number' ? +v.toFixed(3) : v), 2) : '—'}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PoseDebug />
  </StrictMode>,
);
