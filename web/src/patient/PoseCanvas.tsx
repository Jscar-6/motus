// Live stick figure drawn on a canvas in our own rAF loop (never through React state). Colors follow the rule levels.
import { useEffect, useRef } from 'react';
import { getHistory, useLive } from '../live/store';
import type { CheckState, LiveSample } from '../live/types';

const COLOR = { ok: '#7BD39A', warn: '#F2B84B', bad: '#FF6B57', neutral: '#FFFFFF' } as const; // on-video colors, spec §1
const TRAIL_MS = 1200;

/** On-video color for one check: neutral when the check is skipped or the arm is uncertain. */
function levelColor(sample: LiveSample, key: CheckState['key']): string {
  const c = sample.rules?.checks.find((x) => x.key === key && x.enabled);
  if (!c || sample.rules?.uncertain) return COLOR.neutral;
  if (c.level === 'over') return COLOR.bad;
  return c.level === 'warn' ? COLOR.warn : COLOR.ok;
}

interface Props { fit: 'cover' | 'contain'; className?: string }

/** Canvas overlay for the pose: `cover` matches an object-cover video, `contain` shows the whole figure on the demo backdrop. */
export default function PoseCanvas({ fit, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0;
    let h = 0;
    let raf = 0;

    /** Match the backing store to the CSS size at device pixel ratio. */
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    /** Draw one frame of the figure and the wrist trail. */
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, w, h);
      const sample = useLive.getState().latest;
      if (!sample?.pose) return;
      const { pose, aspect } = sample;
      const fill = (fit === 'cover') === (w / h > aspect);
      const vw = fill ? w : h * aspect;
      const vh = fill ? w / aspect : h;
      const ox = (w - vw) / 2;
      const oy = (h - vh) / 2;
      const px = (p: { x: number; y: number }) => [ox + p.x * vw, oy + p.y * vh] as const;
      const unsure = sample.rules?.uncertain === true;
      const width = Math.max(8, Math.min(w, h) * 0.02);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = unsure ? 0.5 : 1;
      ctx.lineWidth = width;
      const seg = (a: { x: number; y: number }, b: { x: number; y: number }, color: string) => {
        const [ax, ay] = px(a);
        const [bx, by] = px(b);
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = width * 1.2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      };
      seg(pose.hip, pose.shoulder, levelColor(sample, 'lean'));
      seg(pose.shoulder, pose.ear, levelColor(sample, 'hike'));
      ctx.lineWidth = width * 0.8;
      seg(pose.shoulder, pose.elbow, COLOR.neutral);
      seg(pose.elbow, pose.wrist, COLOR.neutral);

      ctx.shadowBlur = 0;
      ctx.fillStyle = COLOR.neutral;
      for (const joint of [pose.hip, pose.shoulder, pose.elbow, pose.wrist]) {
        const [jx, jy] = px(joint);
        ctx.beginPath();
        ctx.arc(jx, jy, width * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const past of getHistory()) {
        const age = sample.t - past.t;
        if (!past.pose || age > TRAIL_MS || age < 60) continue;
        const [tx, ty] = px(past.pose.wrist);
        ctx.globalAlpha = (1 - age / TRAIL_MS) * 0.5;
        ctx.beginPath();
        ctx.arc(tx, ty, width * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [fit]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
