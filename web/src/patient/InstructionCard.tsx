// The white card that tells the patient what to adjust, in one calm sentence (Figma instruction card).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { useLive, useThrottledSample } from '../live/store';
import { getCue, type Tone } from './cues';
import { EASE_OUT } from './motion';

const DOT: Record<Tone, string> = { neutral: 'bg-ink-3', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };

/** Instruction card; the sentence cross-fades (blur 4px) when the cue changes, not when its number does. */
export default function InstructionCard({ className }: { className?: string }) {
  const sample = useThrottledSample(10);
  const restCaptured = useLive((s) => s.restCaptured);
  const reduced = useReducedMotion();
  const cue = getCue(sample, restCaptured);
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)' };
  const shown = reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' };

  return (
    <div className={clsx('material-solid flex min-h-[15rem] flex-col gap-5 p-7 lg:p-6', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className={clsx('size-2.5 rounded-full', DOT[cue.tone])}
          style={{ transitionProperty: 'background-color', transitionDuration: '400ms', transitionTimingFunction: 'ease' }}
        />
        <span className="eyebrow !text-ink-2" aria-hidden>{cue.status}</span>
      </div>
      <div aria-live="polite" className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={cue.id}
            initial={hidden}
            animate={{ ...shown, transition: { duration: 0.3, ease: EASE_OUT } }}
            exit={{ ...hidden, transition: { duration: 0.15, ease: EASE_OUT } }}
            className="tabular font-serif text-[1.75rem] leading-[1.2] tracking-[-0.01em] text-ink lg:text-[clamp(1.25rem,1.7vw,1.75rem)]"
          >
            <span className="sr-only">{cue.status}. </span>
            {cue.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
