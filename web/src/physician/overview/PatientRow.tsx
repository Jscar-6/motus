// One pill row of the physician list: avatar, name, last session, trend and share of time compensating.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Badge from '../../ui/Badge';
import { EASE_OUT, useMaterialize } from '../../patient/motion';
import { useSlideIn } from '../slideIn';
import { initials, pct, relative } from '../format';
import type { SeverityLevel } from '../severity';
import { tintOf, type Entry } from './model';
import Sparkline from './Sparkline';

const LEVEL_LABEL: Record<SeverityLevel, string> = { none: 'No data', ok: 'OK', watch: 'Watch', attention: 'Needs attention' };
const LEVEL_TEXT: Record<SeverityLevel, string> = { none: 'text-ink-3', ok: 'text-ok', watch: 'text-[#8a5c0f]', attention: 'text-bad' };
const WARN = '196 134 28';
const GLOW_MS = 1400;

/** Counter that ticks up when the signature changes (not on first render) and resets to 0 once the glow ends. */
function useJustChanged(signature: string): number {
  const previous = useRef(signature);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (previous.current === signature) return undefined;
    previous.current = signature;
    setPulse((n) => n + 1);
    const id = window.setTimeout(() => setPulse(0), GLOW_MS);
    return () => window.clearTimeout(id);
  }, [signature]);
  return pulse;
}

/** A patient row; slides in as page item `order` (or fades in when null, for rows added later), moves smoothly when the ranking changes and turns amber when the patient needs attention. */
export default function PatientRow({ entry, order, onOpen }: { entry: Entry; order: number | null; onOpen: (id: string, el: HTMLElement) => void }) {
  const { patient, severity, series } = entry;
  const attention = severity.level === 'attention';
  const reduced = useReducedMotion();
  const [firstOrder] = useState(order);
  const slide = useSlideIn(firstOrder ?? 0);
  const fade = useMaterialize({ y: 12, blur: 6, duration: 0.5 });
  const enter = firstOrder === null ? fade : slide;
  const pulse = useJustChanged(entry.signature);
  const label = `${patient.name}, ${LEVEL_LABEL[severity.level].toLowerCase()}${severity.pct === null ? '' : `, ${pct(severity.pct)} of time compensating`}. Open recordings`;

  return (
    <motion.li
      layout="position"
      exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
      transition={{ layout: { type: 'spring', bounce: 0, duration: reduced ? 0.01 : 0.5 } }}
    >
      <motion.div {...enter} className="relative">
        <button
          type="button"
          aria-label={label}
          onClick={(e) => onOpen(patient.id, e.currentTarget)}
          className="material relative flex h-16 w-full items-center gap-3 px-3 text-left hover:-translate-y-px active:scale-[0.98] focus-visible:outline-offset-2"
          style={{
            borderRadius: 9999,
            background: attention ? 'color-mix(in oklab, var(--color-warn) 20%, white)' : 'rgb(255 255 255 / 0.62)',
            boxShadow: `var(--shadow-card), inset 0 1px 0 rgb(255 255 255 / 0.75), inset 0 0 0 1.5px rgb(${WARN} / ${attention ? 0.55 : 0})`,
            transition: 'background-color 400ms ease-out, box-shadow 400ms ease-out, transform 160ms var(--ease-out)',
          }}
        >
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full font-display text-[1rem] tracking-[0.02em] text-ink"
            style={{ background: tintOf(patient.name) }}
          >
            {initials(patient.name)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-display text-[1.125rem] leading-tight text-ink">{patient.name}</span>
              {patient.is_sample && <Badge className="hidden !h-5 !px-2 !text-[0.6rem] sm:inline-flex">Sample</Badge>}
            </span>
            <span className="flex items-center gap-2 text-[0.875rem] leading-snug text-ink-2">
              <span className="truncate">{relative(severity.lastAt)}{severity.recordings > 0 && ` · ${severity.recordings} ${severity.recordings === 1 ? 'session' : 'sessions'}`}</span>
              {severity.recordingNow && (
                <Badge tone="bad" dot className="!h-5 !px-2 !text-[0.6rem] motion-safe:animate-pulse">Recording now</Badge>
              )}
            </span>
          </span>

          <Sparkline
            values={series.slice(-7).map((r) => r.pct_compensating ?? 0)}
            stroke={attention ? 'var(--color-bad)' : 'var(--color-ink-3)'}
            className="hidden shrink-0 sm:block"
          />

          <span className="flex w-[7.5rem] shrink-0 flex-col items-end pr-3 text-right">
            <span className={`tabular font-display text-[1.5rem] leading-none ${severity.pct === null ? 'text-ink-3' : 'text-ink'}`}>{pct(severity.pct)}</span>
            <span className={`mt-1 font-display text-[0.65rem] uppercase leading-none tracking-[0.08em] ${LEVEL_TEXT[severity.level]}`}>{LEVEL_LABEL[severity.level]}</span>
          </span>
        </button>

        {pulse > 0 && !reduced && (
          <motion.span
            key={pulse}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: 9999, boxShadow: `0 0 0 3px rgb(${WARN} / 0.55), 0 0 24px 2px rgb(${WARN} / 0.4)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: GLOW_MS / 1000, ease: EASE_OUT, times: [0, 0.2, 1] }}
          />
        )}
      </motion.div>
    </motion.li>
  );
}
