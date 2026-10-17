// Frosted "Near | Far" segmented control; the pill slides between options with a bounce-free spring.
import { motion } from 'motion/react';
import clsx from 'clsx';
import { useLive } from '../live/store';
import { setNear } from '../live/actions';

const OPTIONS = [{ label: 'Near', near: true }, { label: 'Far', near: false }] as const;

/** Target-distance toggle bound to the live store. */
export default function NearFarControl({ className }: { className?: string }) {
  const near = useLive((s) => s.near);
  return (
    <div role="group" aria-label="Target distance" className={clsx('material !rounded-full flex gap-1 p-1', className)}>
      {OPTIONS.map((o) => {
        const active = near === o.near;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={active}
            onClick={() => setNear(o.near)}
            className={clsx(
              'pressable relative h-10 min-w-24 cursor-pointer rounded-full px-6 font-display text-[0.9rem] tracking-[0.04em]',
              active ? 'text-paper' : 'text-ink-2 [@media(hover:hover)]:hover:text-ink',
            )}
            style={{ transitionProperty: 'transform, color' }}
          >
            {active && (
              <motion.span
                layoutId="near-far-pill"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="absolute inset-0 rounded-full bg-ink shadow-[var(--shadow-card)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
