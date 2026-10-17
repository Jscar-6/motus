// Shared entrance recipes: the "materialize" (fade + blur + small slide) used on first views.
import { useReducedMotion } from 'motion/react';

/** The house ease-out (emil-design-eng): strong start, long settle. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface MaterializeOptions { delay?: number; x?: number; y?: number; blur?: number; duration?: number }

/** Props for a motion element that materializes on mount; reduced motion becomes a 200 ms fade. */
export function useMaterialize({ delay = 0, x = 0, y = 16, blur = 8, duration = 0.6 }: MaterializeOptions = {}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } };
  }
  return {
    initial: { opacity: 0, filter: `blur(${blur}px)`, transform: `translate(${x}px, ${y}px)` },
    animate: { opacity: 1, filter: 'blur(0px)', transform: 'translate(0px, 0px)' },
    transition: { duration, delay, ease: EASE_OUT },
  };
}
