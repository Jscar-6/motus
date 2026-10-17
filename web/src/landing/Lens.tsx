// The landing lens: a slowly spinning dotted ring behind a dot-hand that turns in 3D. Decorative only.
import { forwardRef } from 'react';
import DotHand from './DotHand';
import LensRing from './LensRing';

/** 460px lens (scales down to its container); the ref is the element Session grows from. */
const Lens = forwardRef<HTMLDivElement>(function Lens(_props, ref) {
  return (
    <div ref={ref} aria-hidden className="pointer-events-none relative aspect-square w-[min(460px,100%)] rounded-full bg-paper">
      <LensRing />
      <DotHand />
    </div>
  );
});

export default Lens;
