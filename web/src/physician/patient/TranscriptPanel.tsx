// The doctor's voice instruction as text: live transcript, editable box with a check mark, Gemini's typed reply, and a second check to finish.
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import Badge from '../../ui/Badge';
import { useTypewriter } from './useTypewriter';
import type { VoiceNote } from './useVoiceNote';

const LEVEL_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;
const LISTEN_CPS = 80;
const REPLY_CPS = 35;

/** Round action button; `tone` ink for the main action, quiet for the dismiss action. */
function RoundButton({ label, onClick, disabled, quiet, children }: { label: string; onClick: () => void; disabled?: boolean; quiet?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`pressable grid size-10 shrink-0 cursor-pointer place-items-center rounded-full disabled:pointer-events-none disabled:opacity-35 ${quiet ? 'bg-ink/[0.06] text-ink-2' : 'bg-ink text-paper shadow-[var(--shadow-card)]'}`}
      style={{ transitionProperty: 'transform, opacity' }}
    >
      {children}
    </button>
  );
}

const CHECK = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const CROSS = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** Blinking text caret while text is still arriving. */
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

/** Live words while listening, typed out like they are being written. */
function Listening({ text }: { text: string }) {
  const shown = useTypewriter(text, LISTEN_CPS);
  return (
    <p className="font-serif text-[1.125rem] leading-snug text-ink">
      {shown || <span className="text-ink-3">Say an instruction…</span>}
      <Caret />
    </p>
  );
}

/** Gemini's reply, typed out, with a chip when it changed the buzz sensitivity. */
function Reply({ voice }: { voice: VoiceNote }) {
  const reply = voice.reply;
  const typed = useTypewriter(reply?.text ?? '', REPLY_CPS);
  if (!reply) return null;
  const done = typed.length === reply.text.length;
  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <p className="truncate font-serif text-[0.9rem] text-ink-3">&ldquo;{voice.text}&rdquo;</p>
      <p className="font-serif text-[1.125rem] leading-snug text-ink">
        {typed}
        {!done && <Caret />}
      </p>
      {reply.buzz && done && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="self-start">
          <Badge tone="ink" className="!h-6 !px-2.5 text-[0.62rem]">Buzz sensitivity: {LEVEL_LABEL[reply.buzz]}</Badge>
        </motion.span>
      )}
    </div>
  );
}

/** The transcript side of the past-exercises card, for every phase except idle. */
export default function TranscriptPanel({ voice }: { voice: VoiceNote }) {
  const { phase } = voice;
  const label =
    phase === 'listening' ? 'Listening…'
    : phase === 'editing' ? 'Edit if needed, then confirm'
    : phase === 'thinking' ? 'Asking Gemini…'
    : voice.reply?.source === 'gemini' ? 'Gemini' : 'Coach';

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        <span className="eyebrow" aria-live="polite">{label}</span>
        {phase === 'listening' && <Listening text={voice.text} />}
        {(phase === 'editing' || phase === 'thinking') && (
          <textarea
            autoFocus
            value={voice.text}
            readOnly={phase === 'thinking'}
            onChange={(e) => voice.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                voice.submit();
              }
            }}
            aria-label="Instruction text"
            placeholder="Type an instruction, for example: make the buzz gentler"
            rows={3}
            className="min-h-0 w-full flex-1 resize-none rounded-[var(--radius-inner)] bg-white/70 p-3 font-serif text-[1.125rem] leading-snug text-ink outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ink/30"
            style={{ opacity: phase === 'thinking' ? 0.6 : 1, transition: 'opacity 200ms ease-out' }}
          />
        )}
        {phase === 'reply' && <Reply voice={voice} />}
      </div>
      <div className="flex flex-col items-center justify-end gap-2">
        {phase === 'editing' && (
          <>
            <RoundButton label="Discard" quiet onClick={voice.finish}>{CROSS}</RoundButton>
            <RoundButton label="Send to Gemini" disabled={!voice.text.trim()} onClick={voice.submit}>{CHECK}</RoundButton>
          </>
        )}
        {phase === 'reply' && <RoundButton label="Done" onClick={voice.finish}>{CHECK}</RoundButton>}
      </div>
    </div>
  );
}
