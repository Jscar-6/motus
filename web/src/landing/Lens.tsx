// The landing lens: a slowly spinning dotted ring behind a dot-hand that turns in 3D. Decorative only.
import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import DotHand from './DotHand';
import LensRing from './LensRing';

// On exit the ring and hand fade off the paper disc, so the bare disc matches the veiled panel Session opens from it.
const CLEAR = { opacity: 0, transform: 'scale(0.96)', transition: { duration: 0.25, ease: 'easeOut' } } as const;
const CLEAR_REDUCED = { opacity: 0, transition: { duration: 0.2 } } as const;

/** 460px lens (scales down to its container); the ref is the element Session grows from. */
const Lens = forwardRef<HTMLDivElement>(function Lens(_props, ref) {
  const reduced = useReducedMotion();
  return (
    <div ref={ref} aria-hidden className="pointer-events-none relative aspect-square w-[min(460px,100%)] rounded-full bg-paper">
      <motion.div exit={reduced ? CLEAR_REDUCED : CLEAR} className="absolute inset-0">
        <LensRing />
        <DotHand />
      </motion.div>
    </div>
  );
});

export default Lens;
