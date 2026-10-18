// Right-hand panel (F9): the AI's live per-frame math against the config.ts thresholds, the rule verdict, the flag log and raw landmarks.
// Collapsible to a slim rail; content keeps a fixed width so only the clip edge moves while the column animates.
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { FORWARD_REACH } from '../lib/config';
import { requestRecaptureRest } from '../live/actions';
import { useLive, useThrottledSample } from '../live/store';
import type { LiveSample } from '../live/types';
import Badge from '../ui/Badge';
import FlagLog from './FlagLog';
import LandmarksTable from './LandmarksTable';
import { METRICS } from './metrics';
import MetricTile from './MetricTile';
import NearFarToggle from './NearFarToggle';

const FLAG_NAMES = { trunk_lean: 'Trunk lean', shoulder_hike: 'Shoulder hike', trunk_rotation: 'Trunk rotation' } as const;
const SOURCE_NAMES = { none: 'No source', camera: 'Camera', demo: 'Demo data', remote: 'Patient tab' } as const;

interface Props { open: boolean; onToggle: () => void; collapsible: boolean; className?: string }

/** Chevron icon; `left` points to the left. */
function Chevron({ left }: { left: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={left ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
    </svg>
  );
}

/** The verdict chips for the current rule state. */
function Verdict({ sample }: { sample: LiveSample | null }) {
  const rules = sample?.rules;
  let key = 'none';
  let chips: { text: string; tone: 'bad' | 'ok' | 'neutral' }[] = [{ text: 'No data', tone: 'neutral' }];
  if (rules?.uncertain) {
    key = 'uncertain';
    chips = [{ text: 'Uncertain', tone: 'neutral' }];
  } else if (rules && rules.flags.length > 0) {
    key = rules.flags.join();
    chips = rules.flags.map((f) => ({ text: f in FLAG_NAMES ? FLAG_NAMES[f as keyof typeof FLAG_NAMES] : f, tone: 'bad' as const }));
  } else if (rules) {
    key = 'clean';
    chips = [{ text: 'Clean', tone: 'ok' }];
  }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-wrap gap-2"
      >
        {chips.map((c) => <Badge key={c.text} tone={c.tone} dot>{c.text}</Badge>)}
      </motion.div>
    </AnimatePresence>
  );
}

/** Full-height frosted panel with the live calculations. */
export default function LiveMathPanel({ open, onToggle, collapsible, className }: Props) {
  const sample = useThrottledSample(15);
  const fps = useLive((s) => s.fps);
  const source = useLive((s) => s.source);
  const restCaptured = useLive((s) => s.restCaptured);
  const { minFlagMs, visMin } = FORWARD_REACH;

  return (
    <aside aria-label="Live math" className={clsx('material relative h-full overflow-hidden', className)}>
      {collapsible && (
        <div className="absolute inset-y-0 left-0 flex w-14 flex-col items-center gap-4 pt-4" style={{ opacity: open ? 0 : 1, visibility: open ? 'hidden' : 'visible', transition: `opacity 200ms ease, visibility 0s linear ${open ? '200ms' : '0s'}` }}>
          <button type="button" aria-label="Open live math panel" onClick={onToggle} className="pressable grid size-9 cursor-pointer place-items-center rounded-full bg-white/70 text-ink-2">
            <Chevron left />
          </button>
          <span className="eyebrow [writing-mode:vertical-rl]">Live signal</span>
        </div>
      )}

      <div
        className="flex h-full w-full flex-col lg:w-[340px]"
        style={{ opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transition: `opacity 220ms ease, visibility 0s linear ${open ? '0s' : '220ms'}` }}
        aria-hidden={!open}
      >
        <header className="flex items-start justify-between px-5 pb-3 pt-5">
          <div>
            <p className="eyebrow">Live signal</p>
            <p className="mt-1.5 text-[0.9rem] text-ink-2 tabular">{fps} fps · {SOURCE_NAMES[source]}</p>
          </div>
          {collapsible && (
            <button type="button" aria-label="Collapse live math panel" onClick={onToggle} className="pressable grid size-9 cursor-pointer place-items-center rounded-full bg-white/70 text-ink-2">
              <Chevron left={false} />
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-5 [scrollbar-width:thin]">
          <div className="flex items-center gap-3">
            <NearFarToggle className="flex-1" />
            <button type="button" onClick={requestRecaptureRest} className="pressable h-10 shrink-0 cursor-pointer rounded-full bg-white/70 px-4 font-display text-[0.72rem] tracking-[0.08em] text-ink-2 uppercase [@media(hover:hover)]:hover:bg-white" style={{ transitionProperty: 'transform, background-color' }}>
              Recapture rest
            </button>
          </div>
          <p className="flex items-center gap-2 px-1 text-[0.85rem] text-ink-2">
            <span aria-hidden className={clsx('size-1.5 rounded-full', restCaptured ? 'bg-ok' : 'animate-pulse bg-warn motion-reduce:animate-none')} />
            {restCaptured ? 'Rest pose captured' : 'Waiting for stillness…'}
          </p>

          {METRICS.map((m) => <MetricTile key={m.key} metric={m} sample={sample} paused={!open} />)}

          <section className="rounded-[var(--radius-inner)] bg-white/70 p-3.5 shadow-[0_1px_2px_rgb(92_48_24/0.06)]" aria-label="Rule verdict">
            <p className="eyebrow">Rule verdict</p>
            <div className="mt-2.5 min-h-7"><Verdict sample={sample} /></div>
            <p className="mt-3 text-[0.8rem] leading-snug text-ink-3">
              Flags after {minFlagMs} ms over threshold; uncertain below {visMin} visibility.
            </p>
            <p className="mt-1 text-[0.8rem] leading-snug text-ink-3">Thresholds: fitted on TRSP healthy participants (D3). Patient test pending (E2).</p>
          </section>

          <section className="rounded-[var(--radius-inner)] bg-white/70 p-3.5 shadow-[0_1px_2px_rgb(92_48_24/0.06)]">
            <FlagLog />
          </section>

          <section className="rounded-[var(--radius-inner)] bg-white/70 px-3.5 py-2.5 shadow-[0_1px_2px_rgb(92_48_24/0.06)]">
            <LandmarksTable pose={sample?.pose ?? null} />
          </section>
        </div>
      </div>
    </aside>
  );
}
