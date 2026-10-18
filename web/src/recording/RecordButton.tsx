// Glass pill in the video panel: Record, then elapsed time and Stop, then upload progress and a sent confirmation (F11).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE_OUT } from '../patient/motion';
import type { RecorderState } from './useRecorder';

interface Props {
  state: RecorderState;
  elapsedMs: number;
  available: boolean;
  reason: string | null;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const;
const ANNOUNCE: Record<RecorderState, string> = {
  idle: '',
  starting: 'Starting recording',
  recording: 'Recording',
  uploading: 'Uploading recording',
  sent: 'Recording sent to your physician',
  error: 'Upload failed. Press to retry.',
};

/** Elapsed time as m:ss. */
function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Red recording dot; pulses in opacity only while recording. */
function Dot({ pulse }: { pulse: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-bad"
      animate={pulse ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
      transition={pulse ? { duration: 1.6, ease: 'easeInOut', repeat: Infinity } : { duration: 0.2 }}
    />
  );
}

/** Small spinner that inherits the text colour. */
function Spinner() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="animate-spin motion-reduce:animate-none">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/** Check mark glyph. */
function Check() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Record, Stop, upload and retry control with a width that follows its content. */
export default function RecordButton({ state, elapsedMs, available, reason, onStart, onStop, onRetry }: Props) {
  const reduced = useReducedMotion();
  const busy = state === 'starting' || state === 'uploading' || state === 'sent';
  const onClick = state === 'recording' ? onStop : state === 'error' ? onRetry : onStart;
  const disabled = busy || (state === 'idle' && !available);
  const label = state === 'recording' ? 'Stop recording' : state === 'error' ? 'Retry upload' : 'Record';

  let content: ReactNode;
  if (state === 'recording') {
    content = <><Dot pulse={!reduced} /><span className="tabular">{clock(elapsedMs)}</span><span className="size-2 rounded-[2px] bg-ink" aria-hidden />Stop</>;
  } else if (state === 'starting') {
    content = <><Spinner />Starting…</>;
  } else if (state === 'uploading') {
    content = <><Spinner />Uploading…</>;
  } else if (state === 'sent') {
    content = <><span className="text-ok"><Check /></span>Sent to your physician</>;
  } else if (state === 'error') {
    content = <><Dot pulse={false} />Upload failed · Retry</>;
  } else {
    content = <><Dot pulse={false} />Record</>;
  }
  const enter = reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)' };
  const rest = reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' };

  return (
    <>
      <motion.button
        type="button"
        layout={!reduced}
        transition={SPRING}
        style={{ borderRadius: 9999 }}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={state === 'idle' && !available ? reason ?? undefined : undefined}
        className="pressable material inline-flex !h-10 cursor-pointer select-none items-center overflow-hidden px-3.5 font-display text-[0.8rem] uppercase tracking-[0.08em] text-ink backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40 [@media(hover:hover)]:hover:bg-white/80"
      >
        <motion.span layout={reduced ? false : 'position'} transition={SPRING} className="inline-flex items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={state}
              initial={enter}
              animate={{ ...rest, transition: { duration: 0.2, ease: EASE_OUT } }}
              exit={{ ...enter, transition: { duration: 0.12, ease: EASE_OUT } }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {content}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </motion.button>
      <span role="status" aria-live="polite" className="sr-only">{ANNOUNCE[state]}</span>
    </>
  );
}
