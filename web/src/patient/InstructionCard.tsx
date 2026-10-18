// The white card that tells the patient what to adjust, in one calm sentence (Figma instruction card).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { useActivePatient } from '../db/activePatient';
import { usePhysicianNote, type PhysicianNote } from '../db/physicianNotes';
import { useLive, useThrottledSample } from '../live/store';
import { useTypewriter } from '../physician/patient/useTypewriter';
import { getCue, type Tone } from './cues';
import { EASE_OUT } from './motion';

const DOT: Record<Tone, string> = { neutral: 'bg-ink-3', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };
const NOTE_CPS = 40;

/** Blinking caret while a note is still being typed out. */
function Caret() {
  const reduced = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-[0.15em] bg-ink"
      animate={reduced ? undefined : { opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/** The physician's latest instruction typed out, then Gemini's suggestion typed out beneath it once the instruction is done. */
function NoteBody({ note }: { note: PhysicianNote }) {
  const instruction = useTypewriter(note.instruction, NOTE_CPS);
  const typing = instruction.length < note.instruction.length;
  const reply = useTypewriter(typing ? '' : note.reply ?? '', NOTE_CPS);
  const replying = !typing && note.reply !== null && reply.length < note.reply.length;
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow !text-ink-2">From your physician</span>
      <p className="font-serif text-[1.125rem] leading-snug text-ink">
        {instruction}
        {typing && <Caret />}
      </p>
      {!typing && note.reply && (
        <>
          <span className="eyebrow mt-1">Suggested by Gemini</span>
          <p className="font-serif text-[0.95rem] leading-snug text-ink-2">
            {reply}
            {replying && <Caret />}
          </p>
        </>
      )}
    </div>
  );
}

/** The latest physician note under the cue, entering with the house materialize when a new one arrives. */
function PhysicianNoteSection() {
  const { patient } = useActivePatient();
  const note = usePhysicianNote(patient?.id ?? null);
  const reduced = useReducedMotion();
  return (
    <div aria-live="polite" className="min-h-0 overflow-y-auto">
      <AnimatePresence mode="wait" initial={false}>
        {note && (
          <motion.div
            key={note.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)', transform: 'translateY(6px)' }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="border-t border-hairline pt-4"
          >
            <NoteBody note={note} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Instruction card; the sentence cross-fades (blur 4px) when the cue changes, not when its number does, and the physician's latest note types out below it. */
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
      <PhysicianNoteSection />
    </div>
  );
}
