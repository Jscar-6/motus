// Therapist coach panel: Gemini (or template) notes typed out live, with the therapist's voice lines above.
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import Badge from '../../ui/Badge';
import { useCoachStore, type CoachMessage } from './coachStore';
import { useCoach } from './useCoach';

const MS_PER_CHAR = 24;
const MAX_TYPE_MS = 1400;
const MAX_VISIBLE = 4; // newest plus three older
const OLDER_OPACITY = [1, 0.5, 0.3, 0.16];

/** Number of characters of `text` revealed so far; reveals at ~24 ms/char, at most 1.4 s in total. */
function useTypedCount(text: string, enabled: boolean): number {
  const [count, setCount] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return;
    }
    const duration = Math.min(text.length * MS_PER_CHAR, MAX_TYPE_MS);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.min(text.length, Math.floor((text.length * (now - start)) / duration));
      setCount((prev) => (prev === next ? prev : next));
      if (next < text.length) raf = requestAnimationFrame(tick);
    };
    setCount(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, enabled]);
  return count;
}

/** The newest coach line: revealed character by character; the unrevealed rest stays invisible so wrapping never jumps. */
function TypedLine({ text, reduced }: { text: string; reduced: boolean }) {
  const count = useTypedCount(text, !reduced);
  const typing = count < text.length;
  return (
    <>
      <span>{text.slice(0, count)}</span>
      {typing && (
        <span className="relative inline-block w-0" aria-hidden>
          <motion.span
            className="absolute left-px top-[0.2em] h-[1.05em] w-0.5 rounded-full bg-ink"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </span>
      )}
      <span className="opacity-0">{text.slice(count)}</span>
    </>
  );
}

/** Three quiet dots shown while a request is in flight. */
function Thinking({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      className="flex items-center gap-1"
      role="status"
      aria-label="Coach is thinking"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-ink-3"
          animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </motion.span>
  );
}

/** Wide bottom card of the therapist portal: coach notes and the live voice transcript. */
export default function CoachPanel({ className }: { className?: string }) {
  useCoach();
  const reduced = useReducedMotion() ?? false;
  const messages = useCoachStore((s) => s.messages);
  const interim = useCoachStore((s) => s.interim);
  const pending = useCoachStore((s) => s.pending);

  const visible = messages.slice(-MAX_VISIBLE);
  const newest = messages[messages.length - 1];
  const newestCoach = [...messages].reverse().find((m) => m.role === 'coach');
  const age = (m: CoachMessage) => visible.length - 1 - visible.indexOf(m);

  return (
    <section aria-label="Coach" className={clsx('material relative flex min-h-[190px] flex-col overflow-hidden p-5', className)}>
      <header className="flex items-center gap-3">
        <span className="eyebrow">Coach</span>
        {newestCoach && (
          <Badge tone={newestCoach.source === 'gemini' ? 'ink' : 'neutral'}>{newestCoach.source === 'gemini' ? 'Gemini' : 'Template'}</Badge>
        )}
        <AnimatePresence>{pending > 0 && <Thinking reduced={reduced} />}</AnimatePresence>
      </header>

      <p className="sr-only" aria-live="polite">
        {newest ? `${newest.role === 'therapist' ? 'You said: ' : ''}${newest.text}` : ''}
      </p>

      <div
        aria-hidden
        className="relative mt-2 flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 36px)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 36px)',
        }}
      >
        {!newest && !interim && <p className="text-ink-3">Waiting for the first reach.</p>}
        {visible.map((m) => {
          const isNewest = m === newest;
          const faded = OLDER_OPACITY[age(m)] ?? 0;
          return (
            <motion.p
              key={m.id}
              layout={reduced ? false : 'position'}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: faded, y: 0, filter: 'blur(0px)' }}
              transition={reduced ? { duration: 0.2 } : { type: 'spring', bounce: 0, duration: 0.55 }}
              className={clsx(
                'text-pretty leading-snug',
                m.role === 'therapist' ? 'text-[0.95rem] text-ink-2' : isNewest ? 'text-[1.2rem] text-ink' : 'text-[1.05rem] text-ink',
              )}
            >
              {m.role === 'therapist' ? `You: ${m.text}` : isNewest ? <TypedLine text={m.text} reduced={reduced} /> : m.text}
            </motion.p>
          );
        })}
        {interim && <p className="text-[0.95rem] text-ink-3">{`"${interim}"`}</p>}
      </div>
    </section>
  );
}
