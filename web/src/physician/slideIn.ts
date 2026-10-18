// Physician overview entrance: items slide in leftward from the right edge of the screen, one after another, top to bottom.
import { useReducedMotion } from 'motion/react';

export const SLIDE_STAGGER_S = 0.06;              // gap between items (emil-design-eng: 30–80 ms)
export const SLIDE_DURATION_S = 0.5;              // drawer range (animate skill: 200–500 ms)
export const SLIDE_SETTLED_S = 0.3;               // the drawer curve has covered ~90% of the travel by now
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;  // same curve as --ease-drawer in index.css

/** Seconds before the item at `order` (0 = topmost) starts its slide. */
export function slideDelay(order: number): number {
  return order * SLIDE_STAGGER_S;
}

/** Props for a motion element that slides in from off-screen right as item `order`; reduced motion becomes a staggered 200 ms fade. */
export function useSlideIn(order: number) {
  const reduced = useReducedMotion();
  const delay = slideDelay(order);
  if (reduced) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } };
  }
  return {
    initial: { opacity: 0, transform: 'translateX(100vw)' },
    animate: { opacity: 1, transform: 'translateX(0px)' },
    transition: {
      transform: { duration: SLIDE_DURATION_S, delay, ease: EASE_DRAWER },
      opacity: { duration: SLIDE_SETTLED_S, delay, ease: 'easeOut' },
    },
  };
}
