// The white card: the session steps as a checklist, then one calm sentence on what to adjust (Figma instruction card).
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { useActivePatient } from '../db/activePatient';
import { usePhysicianNote, type PhysicianNote } from '../db/physicianNotes';
import { useLive, useThrottledSample } from '../live/store';
import { useTypewriter } from '../physician/patient/useTypewriter';
import { getCue, type CueId, type Tone } from './cues';
import { EASE_OUT } from './motion';
import SessionSteps from './SessionSteps';

const DOT: Record<Tone, string> = { neutral: 'bg-ink-3', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };
const NOTE_CPS = 40;
const CORRECTIONS: ReadonlySet<CueId> = new Set(['rest', 'uncertain', 'lean', 'hike', 'rot']);  // live cues the patient must act on now; they briefly take the slot back from a physician note
const SENTENCE = 'tabular font-serif text-[1.75rem] leading-[1.2] tracking-[-0.01em] text-ink lg:text-[clamp(1.25rem,1.7vw,1.75rem)]';

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

/** The physician's instruction typed out in the cue's place, then Gemini's suggestion typed beneath it; text already typed in `typed` shows at once. */
function NoteBody({ note, typed }: { note: PhysicianNote; typed: Set<string> }) {
  const instructionDone = typed.has(`${note.id}:instruction`);
  const replyDone = typed.has(`${note.id}:reply`);
  const typedInstruction = useTypewriter(instructionDone ? '' : note.instruction, NOTE_CPS);
  const instruction = instructionDone ? note.instruction : typedInstruction;
  const typing = instruction.length < note.instruction.length;
  const typedReply = useTypewriter(typing || replyDone ? '' : note.reply ?? '', NOTE_CPS);
  const reply = replyDone ? note.reply ?? '' : typedReply;
  const replying = !typing && note.reply !== null && reply.length < note.reply.length;

  useEffect(() => {
    if (!typing) typed.add(`${note.id}:instruction`);
    if (note.reply !== null && !typing && !replying) typed.add(`${note.id}:reply`);
  }, [typed, note.id, note.reply, typing, replying]);

  return (
    <div className="flex flex-col gap-5">
      <p className="sr-only">From your physician: {note.instruction}{note.reply ? ` Suggested by Gemini: ${note.reply}` : ''}</p>
      <p aria-hidden className={SENTENCE}>
        {instruction}
        {typing && <Caret />}
      </p>
      {!typing && note.reply && (
        <div aria-hidden className="flex flex-col gap-1.5">
          <span className="eyebrow">Suggested by Gemini</span>
          <p className="font-serif text-[0.95rem] leading-snug text-ink-2">
            {reply}
            {replying && <Caret />}
          </p>
        </div>
      )}
    </div>
  );
}

/** Instruction card; the sentence cross-fades (blur 4px) when the cue changes, not when its number does. The physician's latest note types out in the sentence's place, giving way only to live corrections. */
export default function InstructionCard({ className }: { className?: string }) {
  const sample = useThrottledSample(10);
  const restCaptured = useLive((s) => s.restCaptured);
  const reduced = useReducedMotion();
  const cue = getCue(sample, restCaptured);
  const { patient } = useActivePatient();
  const note = usePhysicianNote(patient?.id ?? null);
  const typed = useRef(new Set<string>()).current;
  const showNote = note !== null && !CORRECTIONS.has(cue.id);
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)' };
  const shown = reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' };

  return (
    <div className={clsx('material-solid flex min-h-[15rem] flex-col gap-5 p-7 lg:p-6', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className={clsx('size-2.5 rounded-full', DOT[cue.tone])}
          style={{ transitionProperty: 'background-color', transitionDuration: '400ms', transitionTimingFunction: 'ease' }}
        />
        <span className="eyebrow !text-ink-2" aria-hidden>{showNote ? 'From your physician' : cue.status}</span>
      </div>
      <SessionSteps />
      <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={showNote ? `note-${note.id}` : cue.id}
            initial={hidden}
            animate={{ ...shown, transition: { duration: 0.3, ease: EASE_OUT } }}
            exit={{ ...hidden, transition: { duration: 0.15, ease: EASE_OUT } }}
          >
            {showNote ? <NoteBody note={note} typed={typed} /> : (
              <p className={SENTENCE}>
                <span className="sr-only">{cue.status}. </span>
                {cue.text}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
