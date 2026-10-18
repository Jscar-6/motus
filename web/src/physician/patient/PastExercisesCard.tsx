// Bottom-middle card: the strip of past recordings, which slides down out of the way while the doctor dictates and springs back up afterwards.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { RecordingRow } from '../../db/types';
import { EASE_OUT } from '../../patient/motion';
import RecordingStrip from './RecordingStrip';
import TranscriptPanel from './TranscriptPanel';
import { useTypewriter } from './useTypewriter';
import type { VoiceNote } from './useVoiceNote';

const NOTE_CPS = 40;

interface Props {
  recordings: RecordingRow[];
  selectedId: string | null;
  newIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  voice: VoiceNote;
  note: string | null;
}

/** Two modes in one clipped card: "videos" (title, coach note, strip) and "transcript" (voice instruction flow). */
export default function PastExercisesCard({ recordings, selectedId, newIds, onSelect, voice, note }: Props) {
  const reduced = useReducedMotion();
  const videos = voice.phase === 'idle';
  const typedNote = useTypewriter(videos ? (note ?? '') : '', NOTE_CPS);

  return (
    <section aria-label="Past exercises completed" className="material relative flex h-full flex-col overflow-hidden p-4">
      <header className="flex min-h-6 items-baseline gap-4">
        <h2 className="shrink-0 font-display text-[1.05rem] leading-6 tracking-[0.01em] text-ink">{videos ? 'Past exercises completed' : 'Voice instruction'}</h2>
        {typedNote && (
          <p title={note ?? undefined} className="min-w-0 flex-1 truncate font-serif text-[0.9rem] leading-6 text-ink-2">{typedNote}</p>
        )}
      </header>

      <div className="relative mt-3 min-h-0 flex-1">
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={videos ? { y: '0%', opacity: 1, visibility: 'visible' } : { y: reduced ? '0%' : '100%', opacity: 0, transitionEnd: { visibility: 'hidden' } }}
          transition={videos ? (reduced ? { duration: 0.2 } : { type: 'spring', bounce: 0.2, duration: 0.6 }) : { duration: reduced ? 0.2 : 0.3, ease: EASE_OUT }}
        >
          <RecordingStrip recordings={recordings} selectedId={selectedId} newIds={newIds} onSelect={onSelect} />
        </motion.div>

        <AnimatePresence>
          {!videos && (
            <motion.div
              key="transcript"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <TranscriptPanel voice={voice} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
