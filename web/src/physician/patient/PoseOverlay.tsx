// Green skeleton over a recording, matching the patient's live view (vision/CameraView debug drawing): draws the pose
// that usePlaybackFeed replays into the live store, aligned to the object-cover video.
import { useEffect, useRef } from 'react';
import { coverTransform } from '../../doctor/canvasKit';
import { FORWARD_REACH } from '../../lib/config';
import type { PoseFrame } from '../../lib/types';
import { useLive } from '../../live/store';

const GREEN = '#22c55e';
const RED = '#ef4444';
const BONES: [keyof PoseFrame, keyof PoseFrame][] = [['ear', 'shoulder'], ['shoulder', 'hip'], ['shoulder', 'elbow'], ['elbow', 'wrist']];
const JOINTS = ['ear', 'shoulder', 'elbow', 'wrist', 'hip'] as const;

/** Canvas on top of an object-cover video that draws the current replayed pose each animation frame. */
export default function PoseOverlay({ video }: { video: HTMLVideoElement }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    let w = 0;
    let h = 0;
    let dpr = 1;

    /** Clears and draws the green bones and joints for the latest replayed sample, if it has a pose. */
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pose = useLive.getState().latest?.pose;
      if (!w || !h || !pose || !video.videoWidth) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cover = coverTransform(video.videoWidth, video.videoHeight, w, h);
      const at = (k: keyof PoseFrame) => {
        const p = pose[k] as { x: number; y: number };
        return [cover.ox + p.x * cover.w, cover.oy + p.y * cover.h] as const;
      };
      const lw = Math.min(Math.max(Math.min(w, h) / 160, 2), 4);
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      for (const [a, b] of BONES) {
        ctx.beginPath();
        ctx.moveTo(...at(a));
        ctx.lineTo(...at(b));
        ctx.stroke();
      }
      for (const j of JOINTS) {
        ctx.fillStyle = (pose[j].vis ?? 0) >= FORWARD_REACH.visMin ? GREEN : RED;
        ctx.beginPath();
        ctx.arc(...at(j), lw * 1.75, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /** Matches the backing store to the CSS size. */
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      draw();
    };

    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();
    let raf = requestAnimationFrame(function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [video]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
