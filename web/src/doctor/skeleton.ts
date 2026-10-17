// Draws the annotated skeleton and calculation overlays (lean arc, elbow arc, flag pills) onto the live canvas.
import type { Point2 } from '../lib/types';
import type { CheckState, LiveSample } from '../live/types';
import { PALETTE, drawAngleArc, drawPill, pillWidth, sweep, type Cover } from './canvasKit';

type RGB = [number, number, number];

/** Smoothed colours for the two bones that can turn red, eased frame by frame so level changes feel calm. */
export interface Tint { neck: RGB; trunk: RGB }

interface Pt { x: number; y: number }

/** Parses a #RRGGBB colour. */
function rgbOf(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** CSS colour string for an RGB triple with alpha. */
function css(c: RGB, a = 1): string {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;
}

/** Fresh tint state starting neutral. */
export function createTint(): Tint {
  return { neck: rgbOf(PALETTE.neutral), trunk: rgbOf(PALETTE.neutral) };
}

/** Target colour for a check: neutral without rules, green when skipped or fine, amber near, red over. */
function targetColor(check: CheckState | undefined, hasRules: boolean): RGB {
  if (!hasRules) return rgbOf(PALETTE.neutral);
  if (!check || !check.enabled || check.level === 'ok') return rgbOf(PALETTE.ok);
  return rgbOf(check.level === 'warn' ? PALETTE.warn : PALETTE.bad);
}

/** Moves `cur` a fraction of the way towards `to`. */
function ease(cur: RGB, to: RGB, k = 0.2): void {
  for (let i = 0; i < 3; i++) cur[i] += (to[i] - cur[i]) * k;
}

/** Strokes a polyline with a wide translucent glow under a crisp round-capped line. */
function bone(ctx: CanvasRenderingContext2D, pts: Pt[], color: RGB, lw: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = css(color, 0.22);
  ctx.lineWidth = lw * 3;
  ctx.stroke();
  ctx.strokeStyle = css(color, 1);
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** Joint dot: white fill with a soft dark ring so it reads on any background. */
function joint(ctx: CanvasRenderingContext2D, p: Pt, r: number): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(24, 14, 9, 0.38)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

/** Flag pill beside an anchor, on the side away from the arm, joined to the body by a thin leader line. */
function flagPill(ctx: CanvasRenderingContext2D, text: string, anchor: Pt, dir: number, bounds: { w: number; h: number }): void {
  const w = pillWidth(ctx, text, true);
  const x = anchor.x + dir * (w / 2 + 26);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(anchor.x + dir * 26, anchor.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawPill(ctx, text, x, anchor.y, bounds, PALETTE.bad);
}

/** Draws bones, joints, the lean and elbow angle annotations and any flag pills for one sample. */
export function drawSkeleton(ctx: CanvasRenderingContext2D, sample: LiveSample, cover: Cover, view: { w: number; h: number }, tint: Tint): void {
  const pose = sample.pose;
  if (!pose) return;
  const map = (p: Point2): Pt => ({ x: cover.ox + p.x * cover.w, y: cover.oy + p.y * cover.h });
  const ear = map(pose.ear);
  const shoulder = map(pose.shoulder);
  const elbow = map(pose.elbow);
  const wrist = map(pose.wrist);
  const hip = map(pose.hip);

  const checks = sample.rules?.checks ?? [];
  const check = (key: CheckState['key']) => checks.find((c) => c.key === key);
  ease(tint.neck, targetColor(check('hike'), Boolean(sample.rules)));
  ease(tint.trunk, targetColor(check('lean'), Boolean(sample.rules)));

  const lw = Math.min(Math.max(Math.min(view.w, view.h) / 110, 3), 7);
  bone(ctx, [ear, shoulder], tint.neck, lw);
  bone(ctx, [shoulder, hip], tint.trunk, lw);
  bone(ctx, [shoulder, elbow, wrist], rgbOf(PALETTE.neutral), lw);

  const trunkLen = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
  const dir = Math.sign((shoulder.x + hip.x) / 2 - elbow.x) || -1;
  const f = sample.features;
  if (f && trunkLen > 40) drawLean(ctx, hip, shoulder, trunkLen, f.leanDeg, dir, view);
  const upperLen = Math.hypot(shoulder.x - elbow.x, shoulder.y - elbow.y);
  if (f && upperLen > 30) drawElbow(ctx, shoulder, elbow, wrist, upperLen, f.elbowDeg, view);

  [ear, shoulder, elbow, wrist, hip].forEach((p) => joint(ctx, p, lw * 0.9));

  for (const c of checks) {
    if (!c.flagged || !c.enabled) continue;
    if (c.key === 'lean') flagPill(ctx, `Trunk lean ${Math.abs(c.value ?? 0).toFixed(0)}°`, { x: (shoulder.x + hip.x) / 2, y: (shoulder.y + hip.y) / 2 }, dir, view);
    else if (c.key === 'hike') flagPill(ctx, 'Shoulder hike', { x: (ear.x + shoulder.x) / 2, y: (ear.y + shoulder.y) / 2 - lw * 2 }, dir, view);
    else flagPill(ctx, `Trunk rotation ${Math.abs(c.value ?? 0).toFixed(0)}°`, { x: shoulder.x, y: shoulder.y + trunkLen * 0.2 }, dir, view);
  }
}

/** Dashed vertical reference at the hip, an arc to the trunk, and the lean value beside the line (on the side away from the arm). */
function drawLean(ctx: CanvasRenderingContext2D, hip: Pt, shoulder: Pt, trunkLen: number, leanDeg: number, side: number, view: { w: number; h: number }): void {
  const up = -Math.PI / 2;
  const trunk = Math.atan2(shoulder.y - hip.y, shoulder.x - hip.x);
  const delta = sweep(up, trunk);
  const r = trunkLen * 0.42;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(hip.x, hip.y - trunkLen * 1.2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawAngleArc(ctx, hip.x, hip.y, r, up, delta, 'rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.14)');
  const label = `${leanDeg.toFixed(1)}°`;
  drawPill(ctx, label, hip.x + side * (pillWidth(ctx, label, false) / 2 + 14), hip.y - r * 0.8, view);
}

/** Arc between upper arm and forearm at the elbow with the elbow angle. */
function drawElbow(ctx: CanvasRenderingContext2D, shoulder: Pt, elbow: Pt, wrist: Pt, upperLen: number, elbowDeg: number, view: { w: number; h: number }): void {
  const a0 = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
  const a1 = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
  const delta = sweep(a0, a1);
  const r = Math.min(Math.max(upperLen * 0.3, 20), 56);
  drawAngleArc(ctx, elbow.x, elbow.y, r, a0, delta, 'rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.14)');
  const mid = a0 + delta / 2;
  drawPill(ctx, `${Math.round(elbowDeg)}°`, elbow.x + Math.cos(mid) * (r + 26), elbow.y + Math.sin(mid) * (r + 26), view);
}
