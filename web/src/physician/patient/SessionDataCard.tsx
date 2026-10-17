// Bottom-left card: the numbers tracked during the selected recording.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { CompLabel } from '../../lib/types';
import type { RecordingRow } from '../../db/types';
import Badge from '../../ui/Badge';
import { duration, pct } from '../format';
import { levelOf, type SeverityLevel } from '../severity';

const LABELS: Record<CompLabel, string> = {
  clean: 'Clean',
  trunk_lean: 'Trunk lean',
  shoulder_hike: 'Shoulder hike',
  trunk_rotation: 'Trunk rotation',
  incomplete_reach: 'Incomplete reach',
  uncertain: 'Low confidence',
};
const TONE: Record<SeverityLevel, string> = { none: 'text-ink-3', ok: 'text-ok', watch: 'text-warn', attention: 'text-bad' };
const MAX_FLAGS = 3;

/** Number that swaps with a quick blur and fade instead of counting. */
function Swap({ id, className, children }: { id: string; className?: string; children: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className={className}
        initial={reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)' }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/** Time compensating, flags by label, peaks, length and mode for one recording. */
export default function SessionDataCard({ recording }: { recording: RecordingRow | null }) {
  const ready = recording?.status === 'ready';
  const counts = (Object.entries(recording?.flag_counts ?? {}) as [CompLabel, number][]).filter(([l, n]) => l !== 'clean' && n > 0).sort((a, b) => b[1] - a[1]);
  const { maxLeanDeg, minElbowDeg } = recording?.peaks ?? {};
  const peaks = [maxLeanDeg !== undefined && `Max lean ${Math.round(maxLeanDeg)}°`, minElbowDeg !== undefined && `Min elbow ${Math.round(minElbowDeg)}°`].filter(Boolean).join(' · ');
  const value = ready ? pct(recording.pct_compensating) : '—';

  return (
    <section aria-label="Session data" className="material flex h-full flex-col gap-1.5 overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Time compensating</span>
        {recording && <Badge className="!h-6 !px-2.5 text-[0.62rem]">{recording.mode === 'camera' ? 'Camera' : 'Camera + Sleeve'}</Badge>}
      </div>
      <div className="relative h-12">
        <Swap id={value} className={`display-lg absolute inset-y-0 left-0 ${TONE[levelOf(ready ? recording.pct_compensating : null)]}`}>{value}</Swap>
      </div>
      <ul className="flex min-h-0 flex-wrap content-start gap-1.5" aria-label="Flags">
        {ready && counts.length === 0 && <li className="font-serif text-[0.9rem] text-ink-2">No flags</li>}
        {counts.slice(0, MAX_FLAGS).map(([label, n]) => (
          <li key={label} className="tabular inline-flex h-6 items-center rounded-full bg-ink/[0.06] px-2.5 font-display text-[0.65rem] tracking-[0.06em] text-ink-2 uppercase">
            {LABELS[label]} ×{n}
          </li>
        ))}
        {counts.length > MAX_FLAGS && <li className="inline-flex h-6 items-center font-display text-[0.65rem] text-ink-3">+{counts.length - MAX_FLAGS}</li>}
      </ul>
      <p className="tabular mt-auto truncate font-display text-[0.65rem] tracking-[0.06em] text-ink-3 uppercase">
        {[peaks, ready ? duration(recording.duration_ms) : ''].filter(Boolean).join(' · ') || ' '}
      </p>
    </section>
  );
}
