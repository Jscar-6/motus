// Entrance wrapper: opacity + blur + small translate, ease-out. Clears filter/transform afterwards so backdrop-filter children keep working.
import { motion, useReducedMotion, type MotionStyle } from 'motion/react';
import type { ReactNode } from 'react';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface Props { delay?: number; x?: number; y?: number; className?: string; style?: MotionStyle; children: ReactNode }

/** Fades, de-blurs and slides its children in once on mount; reduced motion becomes a plain fade. */
export default function Materialize({ delay = 0, x = 0, y = 16, className, style, children }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)', transform: `translate3d(${x}px, ${y}px, 0px)` }}
      animate={
        reduce
          ? { opacity: 1 }
          : { opacity: 1, filter: 'blur(0px)', transform: 'translate3d(0px, 0px, 0px)', transitionEnd: { filter: 'none', transform: 'none' } }
      }
      transition={{ duration: reduce ? 0.2 : 0.6, ease: EASE_OUT, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}
