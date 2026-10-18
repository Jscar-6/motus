// FLIP helper: animate an element from another page's rectangle to where it naturally sits.
import { useLayoutEffect, type RefObject } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../patient/motion';

export interface FlipRect { x: number; y: number; width: number; height: number }
export interface FlipOrigin { from: 'landing'; at: number; lensRect: FlipRect; wordmarkRect: FlipRect }

const MAX_AGE_MS = 10_000;
const DURATION = 0.7;
const SHADOW_ROOM = 64; // px the final clip reaches past the panel so its box-shadow is never cut off

/** Plain-object copy of an element's rectangle (safe to put in router state). */
export function rectOf(el: Element): FlipRect {
  const { x, y, width, height } = el.getBoundingClientRect();
  return { x, y, width, height };
}

/** The landing hand-off from router state, or undefined for a direct visit or a stale reload. */
export function readFlipOrigin(state: unknown): FlipOrigin | undefined {
  const s = state as Partial<FlipOrigin> | null;
  if (s?.from !== 'landing' || !s.lensRect || !s.wordmarkRect || typeof s.at !== 'number') return undefined;
  return Date.now() - s.at < MAX_AGE_MS ? (s as FlipOrigin) : undefined;
}

/** Clamp `v` into [lo, hi]. */
function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

/** Open a circular clip-path window at `origin` into the full panel; returns a cancel function. */
function revealPanel(el: HTMLElement, origin: FlipRect) {
  const to = el.getBoundingClientRect();
  const k = Math.max(1, origin.width / to.width, origin.height / to.height);
  const w = origin.width / k;
  const h = origin.height / k;
  const left = clamp((origin.x - to.x) / k, 0, to.width - w);
  const top = clamp((origin.y - to.y) / k, 0, to.height - h);
  const dx = origin.x - to.x - k * left;
  const dy = origin.y - to.y - k * top;
  const corner = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const round = corner + SHADOW_ROOM;
  const from: Keyframe = { clipPath: `inset(${top}px ${to.width - left - w}px ${to.height - top - h}px ${left}px round ${w / 2}px / ${h / 2}px)` };
  const end: Keyframe = { clipPath: `inset(${-SHADOW_ROOM}px round ${round}px / ${round}px)` };
  if (k !== 1 || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    Object.assign(from, { transform: `translate(${dx}px, ${dy}px) scale(${k})`, transformOrigin: '0 0' });
    Object.assign(end, { transform: 'translate(0px, 0px) scale(1)', transformOrigin: '0 0' });
  }
  const anim = el.animate([from, end], { duration: DURATION * 1000, easing: `cubic-bezier(${EASE_OUT.join(', ')})` });
  return () => anim.cancel();
}

/** Scale and move `el` uniformly from `origin` to its own rect; returns a cancel function. */
function flipText(el: HTMLElement, origin: FlipRect) {
  const clear = () => { el.style.transform = ''; el.style.transformOrigin = ''; };
  clear();
  const to = el.getBoundingClientRect();
  const s = origin.width / to.width;
  el.style.transformOrigin = '0 0';
  const controls = animate(
    el,
    { transform: [`translate(${origin.x - to.x}px, ${origin.y - to.y}px) scale(${s})`, 'translate(0px, 0px) scale(1)'] },
    { duration: DURATION, ease: EASE_OUT, onComplete: clear },
  );
  return () => { controls.cancel(); clear(); };
}

/** On mount, animate `ref` from `origin`: 'panel' opens a circle into the panel via clip-path, 'text' scales uniformly. */
export function useFlipFrom(ref: RefObject<HTMLElement>, origin: FlipRect | undefined, shape: 'panel' | 'text') {
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !origin || reduced) return undefined;
    return shape === 'panel' ? revealPanel(el, origin) : flipText(el, origin);
  }, [ref, origin, reduced, shape]);
}
