// Canvas sparkline of the last 8 s of one metric with dashed threshold lines; draws from getHistory() in its own rAF loop.
import { useEffect, useRef } from 'react';
import { getHistory, useLive } from '../live/store';
import { levelOf, type Metric } from './metrics';

const HISTORY_MS = 8000; // matches the rolling window kept in live/store.ts
const INK = '43, 26, 18';
const LEVEL_RGB = { ok: '62, 123, 87', warn: '196, 134, 28', over: '181, 56, 43' } as const;

/** Rolling line chart for a metric; pass `paused` to stop drawing while the panel is hidden. */
export default function Sparkline({ metric, paused, className }: { metric: Metric; paused?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || paused) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const { lo, hi, guides, read } = metric;
    const yOf = (v: number) => h - 3 - Math.min(Math.max((v - lo) / (hi - lo), 0), 1) * (h - 6);

    /** Draws guides, the history line with a soft area, and a dot at the newest point. */
    const draw = () => {
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = `rgba(${INK}, 0.3)`;
      ctx.lineWidth = 1;
      for (const g of guides) {
        const y = Math.round(yOf(g)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      const history = getHistory();
      if (history.length < 2) return;
      const tEnd = history[history.length - 1].t;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${INK}, 0.78)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let pen = false;
      let last: { x: number; y: number } | null = null;
      for (const s of history) {
        const v = read(s);
        if (v === null) { pen = false; continue; }
        const x = w - ((tEnd - s.t) / HISTORY_MS) * w;
        const y = yOf(v);
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
        last = { x, y };
      }
      ctx.stroke();
      const latest = useLive.getState().latest;
      if (last && latest) {
        const level = levelOf(metric, latest);
        ctx.fillStyle = `rgb(${level ? LEVEL_RGB[level] : INK})`;
        ctx.beginPath();
        ctx.arc(Math.min(last.x, w - 3), last.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /** Sizes the backing store to the element and redraws at once. */
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
  }, [metric, paused]);

  return <canvas ref={ref} aria-hidden className={className ?? 'block h-10 w-full'} />;
}
