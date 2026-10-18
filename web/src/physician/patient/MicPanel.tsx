// Bottom-right card: the mic button that starts a voice instruction, and the sleeve buzz sensitivity control.
import clsx from 'clsx';
import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { setBuzz } from '../../live/actions';
import { useLive } from '../../live/store';
import type { BuzzSensitivity } from '../../live/types';
import type { VoiceNote } from './useVoiceNote';

const LEVELS: { id: BuzzSensitivity; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Med' },
  { id: 'high', label: 'High' },
];

/** Inline microphone icon, 1.75 px stroke. */
function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/** Low / Med / High control with a sliding pill, bound to the store's buzz level. */
function BuzzSegments({ reduced }: { reduced: boolean }) {
  const id = useId();
  const buzz = useLive((s) => s.buzz);
  return (
    <div role="radiogroup" aria-label="Sleeve buzz sensitivity" className="flex w-full rounded-full bg-ink/[0.06] p-0.5">
      {LEVELS.map(({ id: level, label }) => {
        const active = buzz === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setBuzz(level)}
            className={clsx(
              'pressable relative h-6 flex-1 cursor-pointer rounded-full px-2 font-display text-[0.68rem] uppercase tracking-[0.08em]',
              active ? 'text-ink' : 'text-ink-3 [@media(hover:hover)]:hover:text-ink-2',
            )}
            style={{ transitionProperty: 'transform, color' }}
          >
            {active && (
              <motion.span
                layoutId={`buzz-pill-${id}`}
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgb(92_48_24/0.14)]"
                transition={reduced ? { duration: 0.2 } : { type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Voice card: mic button (idle, listening ring, thinking) driving the transcript box, plus buzz sensitivity. */
export default function MicPanel({ voice }: { voice: VoiceNote }) {
  const reduced = useReducedMotion() ?? false;
  const listening = voice.phase === 'listening';
  const busy = voice.phase === 'thinking';
  const status = !voice.supported ? 'Type instead' : voice.blocked ? 'Mic blocked' : listening ? 'Listening…' : busy ? 'Thinking…' : 'Voice';

  return (
    <section aria-label="Voice instructions" className="material flex h-full flex-col items-center justify-between gap-2 p-3.5">
      <span className="eyebrow" aria-live="polite">{status}</span>

      <div className="relative grid size-14 place-items-center">
        {listening && !reduced && [0, 0.9].map((delay) => (
          <motion.span
            key={delay}
            aria-hidden
            className="absolute inset-0 rounded-full bg-ink/15"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, delay, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={voice.toggleMic}
          aria-label={listening ? 'Stop listening' : voice.supported ? 'Start voice instruction' : 'Type an instruction'}
          aria-pressed={listening}
          className={clsx(
            'pressable relative grid size-14 cursor-pointer place-items-center rounded-full disabled:pointer-events-none disabled:opacity-60',
            listening ? 'bg-ink text-paper shadow-[var(--shadow-float)]' : 'bg-white text-ink shadow-[var(--shadow-card)] [@media(hover:hover)]:hover:bg-paper',
          )}
          style={{ transitionProperty: 'transform, background-color, color, box-shadow', transitionDuration: '140ms, 250ms, 250ms, 250ms' }}
        >
          <MicIcon />
        </button>
      </div>

      <div className="flex w-full flex-col items-center gap-1.5">
        <BuzzSegments reduced={reduced} />
        <span className="eyebrow text-[0.62rem]">Sleeve buzz</span>
      </div>
    </section>
  );
}
