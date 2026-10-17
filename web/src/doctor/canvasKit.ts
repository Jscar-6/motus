// Canvas helpers shared by the annotated live view: cover-fit math, backdrop, label pills, angle arcs.

/** Where a source frame lands inside the canvas after object-fit: cover. */
export interface Cover { ox: number; oy: number; w: number; h: number }

/** On-video status palette (brighter than the card tokens so it reads over a camera image). */
export const PALETTE = { ok: '#7BD39A', warn: '#F2B84B', bad: '#FF6B57', neutral: '#FFFFFF' } as const;

/** Label font; Erode is loaded from Fontshare in index.html. */
export const CANVAS_FONT = '13px Erode, ui-serif, Georgia, serif';

/** object-fit: cover math for a source of sw x sh drawn into a cw x ch box. */
export function coverTransform(sw: number, sh: number, cw: number, ch: number): Cover {
  const s = Math.max(cw / sw, ch / sh);
  const w = sw * s;
  const h = sh * s;
  return { ox: (cw - w) / 2, oy: (ch - h) / 2, w, h };
}

/** Warm gradient backdrop with a faint dot grid, used when no video frame is available. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, dots: CanvasPattern | null): void {
  const g = ctx.createLinearGradient(0, 0, w * 0.35, h);
  g.addColorStop(0, '#2b1a12');
  g.addColorStop(1, '#4a2a1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (dots) {
    ctx.fillStyle = dots;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Builds the repeating dot tile for the backdrop at the given device pixel ratio. */
export function makeDotPattern(ctx: CanvasRenderingContext2D, dpr: number): CanvasPattern | null {
  const tile = document.createElement('canvas');
  const size = Math.round(26 * dpr);
  tile.width = size;
  tile.height = size;
  const t = tile.getContext('2d');
  if (!t) return null;
  t.fillStyle = 'rgba(255, 235, 220, 0.09)';
  t.beginPath();
  t.arc(size / 2, size / 2, 1.3 * dpr, 0, Math.PI * 2);
  t.fill();
  const pattern = ctx.createPattern(tile, 'repeat');
  pattern?.setTransform(new DOMMatrix().scale(1 / dpr));
  return pattern;
}

/** Signed shortest sweep from angle `from` to angle `to`, in (-PI, PI]. */
export function sweep(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Width of a label pill for this text. */
export function pillWidth(ctx: CanvasRenderingContext2D, text: string, dot: boolean): number {
  ctx.font = CANVAS_FONT;
  return ctx.measureText(text).width + 20 + (dot ? 14 : 0);
}

/** Dark translucent pill with white text, centred on (x, y) and kept inside the canvas. */
export function drawPill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bounds: { w: number; h: number }, dot?: string): void {
  const height = 26;
  const width = pillWidth(ctx, text, Boolean(dot));
  const left = Math.min(Math.max(x - width / 2, 8), bounds.w - width - 8);
  const top = Math.min(Math.max(y - height / 2, 8), bounds.h - height - 8);
  ctx.fillStyle = 'rgba(24, 14, 9, 0.74)';
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, height / 2);
  ctx.fill();
  if (dot) {
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(left + 14, top + height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + 10 + (dot ? 14 : 0), top + height / 2 + 0.5);
}

/** Filled wedge plus crisp arc from angle a0 sweeping by `delta` around (cx, cy). */
export function drawAngleArc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, delta: number, stroke: string, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, a0, a0 + delta, delta < 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + delta, delta < 0);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}
