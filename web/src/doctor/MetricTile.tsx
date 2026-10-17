// One metric in the math panel: big value, formula, threshold track, 8 s sparkline and the hold-time progress for checks.
import clsx from 'clsx';
import { FORWARD_REACH } from '../lib/config';
import type { Level, LiveSample } from '../live/types';
import { fillOf, levelOf, tickOf, type Metric } from './metrics';
import Sparkline from './Sparkline';

const FILL: Record<Level, string> = { ok: 'bg-ok', warn: 'bg-warn', over: 'bg-bad' };
const TRACK_TRANSITION = { transition: 'transform 140ms linear, background-color 250ms ease' } as const;

interface Props { metric: Metric; sample: LiveSample | null; paused?: boolean }

/** Live tile for one metric; reads the throttled sample passed by the panel. */
export default function MetricTile({ metric, sample, paused }: Props) {
  const check = metric.check ? sample?.rules?.checks.find((c) => c.key === metric.check) : undefined;
  const skipped = Boolean(check && !check.enabled);
  const value = sample && !skipped ? metric.read(sample) : null;
  const level = sample && !skipped ? levelOf(metric, sample) : null;
  const tick = tickOf(metric);
  const held = check && !skipped ? Math.min(check.overMs / FORWARD_REACH.minFlagMs, 1) : 0;

  return (
    <section
      aria-label={metric.label}
      className={clsx('rounded-[var(--radius-inner)] bg-white/70 p-3.5 shadow-[0_1px_2px_rgb(92_48_24/0.06)]', skipped && 'opacity-60')}
      style={{ transition: 'opacity 250ms ease' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{metric.label}</p>
          <p className="mt-1.5 text-[0.8rem] leading-tight text-ink-2">{skipped ? (check?.reason ?? 'Skipped') : metric.formula}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {check?.flagged && <span className="inline-flex h-5 items-center rounded-full bg-bad/12 px-2 font-display text-[0.6rem] tracking-[0.08em] text-bad uppercase">Flagged</span>}
          <p className={clsx('font-display text-[1.9rem] leading-none tabular', level === 'over' ? 'text-bad' : 'text-ink')} style={{ transition: 'color 250ms ease' }}>
            {value === null ? '—' : value.toFixed(metric.digits)}
            {value !== null && metric.unit && <span className="ml-0.5 text-[1rem] text-ink-3">{metric.unit}</span>}
          </p>
        </div>
      </div>

      {!skipped && (
        <>
          <div className="relative mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
              <div
                className={clsx('h-full origin-left rounded-full', level ? FILL[level] : 'bg-ink/35')}
                style={{ transform: `scaleX(${fillOf(metric, value)})`, ...TRACK_TRANSITION }}
              />
            </div>
            {tick !== null && <span aria-hidden className="absolute -top-[3px] h-3 w-px bg-ink/55" style={{ left: `${tick * 100}%` }} />}
          </div>
          <Sparkline metric={metric} paused={paused} className="mt-2 block h-10 w-full" />
          {check && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <div
                  className={clsx('h-full origin-left rounded-full', check.flagged ? 'bg-bad' : 'bg-warn')}
                  style={{ transform: `scaleX(${held})`, ...TRACK_TRANSITION }}
                />
              </div>
              <p className="text-[0.72rem] text-ink-3 tabular">held {Math.round(check.overMs)}/{FORWARD_REACH.minFlagMs} ms</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
