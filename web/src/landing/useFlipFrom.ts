// FLIP helper: animate an element from another page's rectangle to where it naturally sits.
import { useLayoutEffect, type RefObject } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../patient/motion';

export interface FlipRect { x: number; y: number; width: number; height: number }
export interface FlipOrigin { from: 'landing'; at: number; lensRect: FlipRect; wordmarkRect: FlipRect }

const MAX_AGE_MS = 10_000;
const DURATION = 0.7;

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

/** On mount, animate `ref` from `origin` to its own rect; 'panel' also morphs a circle into its corners, 'text' scales uniformly. */
export function useFlipFrom(ref: RefObject<HTMLElement>, origin: FlipRect | undefined, shape: 'panel' | 'text') {
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !origin || reduced) return undefined;
    const clear = () => { el.style.transform = ''; el.style.transformOrigin = ''; el.style.borderRadius = ''; };
    clear();
    const to = el.getBoundingClientRect();
    const sx = origin.width / to.width;
    const sy = shape === 'panel' ? origin.height / to.height : sx;
    const from = `translate(${origin.x - to.x}px, ${origin.y - to.y}px) scale(${sx}, ${sy})`;
    const target: Record<string, string[]> = { transform: [from, 'translate(0px, 0px) scale(1, 1)'] };
    if (shape === 'panel') {
      const corner = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      target.borderRadius = [`${to.width / 2}px / ${to.height / 2}px`, `${corner}px / ${corner}px`];
    }
    el.style.transformOrigin = '0 0';
    const controls = animate(el, target, {
      duration: DURATION,
      ease: EASE_OUT,
      onComplete: clear,
    });
    return () => { controls.cancel(); clear(); };
  }, [ref, origin, reduced, shape]);
}
