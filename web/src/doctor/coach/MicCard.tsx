// Therapist mic card: speak an instruction, Gemini (or the template) replies and may change the sleeve buzz sensitivity.
import clsx from 'clsx';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { setBuzz } from '../../live/actions';
import { useLive } from '../../live/store';
import type { BuzzSensitivity } from '../../live/types';
import { sendVoice } from './coachApi';
import { buildCoachContext } from './context';
import { useCoachStore } from './coachStore';
import { isSpeechSupported, startRecognition } from './speech';

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
    <div role="radiogroup" aria-label="Sleeve buzz sensitivity" className="flex rounded-full bg-ink/[0.06] p-0.5">
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
              'pressable relative h-6 flex-1 cursor-pointer rounded-full px-2.5 font-display text-[0.68rem] uppercase tracking-[0.08em]',
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

/** Square bottom-left card of the therapist portal: voice instructions and buzz sensitivity. */
export default function MicCard({ className }: { className?: string }) {
  const reduced = useReducedMotion() ?? false;
  const [supported] = useState(isSpeechSupported);
  const [blocked, setBlocked] = useState(false);
  const listening = useCoachStore((s) => s.listening);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  /** Push the therapist line, ask the coach, show its reply and apply any buzz level it returns. */
  const handleFinal = async (transcript: string) => {
    const store = useCoachStore.getState();
    store.push('therapist', transcript, 'voice');
    store.beginPending();
    try {
      const res = await sendVoice(transcript, buildCoachContext());
      useCoachStore.getState().push('coach', res.reply, res.source);
      // STUB(S3): buzz sensitivity drives V,<motor>,<pattern> once S3 merges
      if (res.buzzSensitivity) setBuzz(res.buzzSensitivity);
    } finally {
      useCoachStore.getState().endPending();
    }
  };

  /** Toggle the microphone: start one utterance, or stop the current one. */
  const toggle = () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    const store = useCoachStore.getState();
    setBlocked(false);
    store.setInterim('');
    store.setListening(true);
    const session = startRecognition({
      onInterim: (text) => useCoachStore.getState().setInterim(text),
      onFinal: (text) => void handleFinal(text),
      onError: (code) => setBlocked(code === 'not-allowed' || code === 'service-not-allowed'),
      onEnd: () => {
        stopRef.current = null;
        useCoachStore.getState().setListening(false);
        useCoachStore.getState().setInterim('');
      },
    });
    stopRef.current = session.stop;
  };

  const status = !supported ? 'Voice needs Chrome' : blocked ? 'Mic blocked' : listening ? 'Listening…' : 'Voice';

  return (
    <section aria-label="Voice instructions" className={clsx('material flex flex-col items-center justify-between p-3.5', className)}>
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
          disabled={!supported}
          onClick={toggle}
          aria-label={listening ? 'Stop listening' : 'Start voice instruction'}
          aria-pressed={listening}
          className={clsx(
            'pressable relative grid size-14 cursor-pointer place-items-center rounded-full disabled:pointer-events-none disabled:opacity-40',
            listening ? 'bg-ink text-paper shadow-[var(--shadow-float)]' : 'bg-white text-ink shadow-[var(--shadow-card)] [@media(hover:hover)]:hover:bg-paper',
          )}
          style={{ transitionProperty: 'transform, background-color, color, box-shadow', transitionDuration: '140ms, 250ms, 250ms, 250ms' }}
        >
          <MicIcon />
        </button>
      </div>

      <div className="flex w-full flex-col items-center gap-1.5">
        <BuzzSegments reduced={reduced} />
        <span className="eyebrow text-[0.62rem]">Sleeve buzz · not connected</span>
      </div>
    </section>
  );
}
