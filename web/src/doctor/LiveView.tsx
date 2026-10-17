// Annotated live view: the patient's video (or a warm demo backdrop) with the skeleton and the AI's angle math drawn on top.
// One DPR-aware canvas with its own rAF loop; nothing here re-renders React per frame.
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { subscribeVideo } from '../live/videoBus';
import { useLive } from '../live/store';
import { CANVAS_FONT, coverTransform, drawBackdrop, drawPill, makeDotPattern } from './canvasKit';
import { createTint, drawSkeleton } from './skeleton';

const VIDEO_STALE_MS = 2000;

/** Canvas that mirrors the patient's live session with calculation annotations. */
export default function LiveView({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const frame = document.createElement('canvas');
    const frameCtx = frame.getContext('2d');
    let videoAt = -Infinity;
    const unsubscribe = subscribeVideo((bmp) => {
      if (!frameCtx) return;
      if (frame.width !== bmp.width || frame.height !== bmp.height) {
        frame.width = bmp.width;
        frame.height = bmp.height;
      }
      frameCtx.drawImage(bmp, 0, 0);
      videoAt = performance.now();
    });

    const tint = createTint();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let dots: CanvasPattern | null = null;

    /** Draws one frame: backdrop or video, dim layer, skeleton, status chip. */
    const draw = () => {
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = CANVAS_FONT;
      const sample = useLive.getState().latest;
      const hasVideo = frame.width > 0 && performance.now() - videoAt < VIDEO_STALE_MS;
      const cover = hasVideo ? coverTransform(frame.width, frame.height, w, h) : coverTransform(sample?.aspect ?? 16 / 9, 1, w, h);
      if (hasVideo) ctx.drawImage(frame, cover.ox, cover.oy, cover.w, cover.h);
      else drawBackdrop(ctx, w, h, dots);

      const unclear = sample !== null && (!sample.pose || sample.rules?.uncertain === true);
      if (unclear) {
        ctx.fillStyle = 'rgba(20, 12, 8, 0.42)';
        ctx.fillRect(0, 0, w, h);
      }
      if (sample?.pose) {
        ctx.globalAlpha = unclear ? 0.45 : 1;
        drawSkeleton(ctx, sample, cover, { w, h }, tint);
        ctx.globalAlpha = 1;
      }
      if (!sample) drawPill(ctx, 'Waiting for the patient', w / 2, h - 36, { w, h });
      else if (unclear) drawPill(ctx, "Can't see the arm", w / 2, h - 36, { w, h }, '#F2B84B');
    };

    /** Syncs the backing store to the CSS size and redraws immediately so resizes never flash blank. */
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      dots = makeDotPattern(ctx, dpr);
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
      unsubscribe();
    };
  }, []);

  return <canvas ref={ref} role="img" aria-label="Live patient video with posture annotations" className={clsx('block h-full w-full', className)} />;
}
