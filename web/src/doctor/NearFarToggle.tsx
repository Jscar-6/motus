// Segmented Near | Far control for the target distance; the white pill slides between options.
import { motion } from 'motion/react';
import clsx from 'clsx';
import { useLive } from '../live/store';
import { setNear } from '../live/actions';

const OPTIONS = [{ near: true, label: 'Near' }, { near: false, label: 'Far' }] as const;

/** Near/Far target selector wired to the live store. */
export default function NearFarToggle({ className }: { className?: string }) {
  const near = useLive((s) => s.near);
  return (
    <div role="radiogroup" aria-label="Target distance" className={clsx('grid grid-cols-2 rounded-full bg-ink/[0.07] p-1', className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={near === o.near}
          onClick={() => setNear(o.near)}
          className={clsx('pressable relative isolate h-8 cursor-pointer rounded-full font-display text-[0.78rem] tracking-[0.08em] uppercase', near === o.near ? 'text-ink' : 'text-ink-3')}
          style={{ transitionProperty: 'transform, color' }}
        >
          {near === o.near && (
            <motion.span layoutId="near-far-pill" aria-hidden className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_1px_2px_rgb(92_48_24/0.14),0_4px_10px_-4px_rgb(92_48_24/0.2)]" transition={{ type: 'spring', bounce: 0, duration: 0.4 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
