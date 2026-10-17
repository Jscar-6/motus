// A 3D dot-hand drawn on a canvas: curls, nods and turns a full 360 degrees every 6 s. Decorative only.
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { buildHand, projectHand, MODEL_CENTER } from './handModel';

const TURN_SECONDS = 9;
/** The hand fills ~half the lens: 460-unit art space scaled up slightly. */
const ART_SIZE = 460;
const ART_ZOOM = 1.15;
const STILL_YAW = -0.5;

/** Reads a CSS custom property off the document root. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Canvas that fills its square parent and animates the projected hand. */
export default function DotHand() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const colors = { ink: cssVar('--color-ink'), accent: cssVar('--color-ok') };
    let size = 0;
    let dpr = 1;
    let raf = 0;
    let start = 0;

    /** Draws the hand at time t (seconds) with the given yaw. */
    const draw = (t: number, yaw: number) => {
      const curl = 0.35 + 0.3 * Math.sin(t * 0.9);
      const pitch = -0.2 + Math.sin(t * 0.5) * 0.08;
      const { points, bones } = projectHand(buildHand(curl), yaw, pitch);
      const scale = (size / ART_SIZE) * ART_ZOOM;
      const mx = (x: number) => size / 2 + (x - MODEL_CENTER.x) * scale;
      const my = (y: number) => size / 2 + (y - MODEL_CENTER.y) * scale;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      bones.forEach((b) => {
        ctx.globalAlpha = b.o;
        ctx.strokeStyle = colors[b.color];
        ctx.lineWidth = b.width * scale;
        ctx.beginPath();
        ctx.moveTo(mx(b.x1), my(b.y1));
        ctx.lineTo(mx(b.x2), my(b.y2));
        ctx.stroke();
      });
      points.forEach((p) => {
        ctx.globalAlpha = p.o;
        ctx.fillStyle = colors[p.color];
        ctx.beginPath();
        ctx.arc(mx(p.x), my(p.y), p.r * scale, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    /** Renders one animation frame from the elapsed time. */
    const frame = (now: number) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      draw(t, t * ((Math.PI * 2) / TURN_SECONDS));
      raf = requestAnimationFrame(frame);
    };

    /** Starts the loop unless the tab is hidden or it is already running. */
    const run = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };

    /** Stops the loop. */
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    /** Pauses while the tab is hidden and resumes (without a time jump) when visible. */
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start = 0;
        run();
      }
    };

    /** Resizes the backing store to the box and device pixel ratio. */
    const resize = () => {
      size = canvas.clientWidth;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      if (reduced) draw(0, STILL_YAW);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reduced) {
      run();
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 size-full" />;
}
