// Physician overview (F11, Figma 21:2): every patient ranked by how much they compensate, with a trend graph.
// Nothing shows until the data is in; then each item slides in from the right, top to bottom.
import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { hasDatabase } from '../db/supabase';
import { usePatients, useRecordings } from '../db/hooks';
import { rectOf, type FlipOrigin } from '../landing/useFlipFrom';
import { buildEntries } from '../physician/overview/model';
import PatientList from '../physician/overview/PatientList';
import { EmptyCard, ErrorCard, SetupCard } from '../physician/overview/States';
import TrendChart from '../physician/overview/TrendChart';
import { SLIDE_SETTLED_S, slideDelay, useSlideIn } from '../physician/slideIn';
import Wordmark from '../ui/Wordmark';

const COLLAPSE_AT = 24;   // scrollTop (px) past which the graph slides out
const EXPAND_AT = 4;      // scrollTop (px) below which it slides back in; the gap stops flicker
const MIN_OVERFLOW = 32;  // list must still scroll by this much after the graph is gone, or collapsing would bounce back
const MAX_WASH = 0.12;    // strongest red tint of the canvas, when everyone needs attention
const COLUMN = 'mx-auto w-full max-w-[64rem]';  // one content column shared by the graph and the patient rows so their edges line up
const GUTTER = { scrollbarWidth: 'thin', scrollbarGutter: 'stable both-edges' } as const;  // reserve the scrollbar's space on both sides so the graph and list columns stay equal
const SLOW_MS = 700;      // still loading after this long: show a quiet loading line instead of an empty canvas

/** The /physician page. */
export default function Physician() {
  const patients = usePatients();
  const recordings = useRecordings();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const brandRef = useRef<HTMLAnchorElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const graphHeight = useRef(0);
  const [collapsed, setCollapsed] = useState(false);
  const [slow, setSlow] = useState(false);
  const brand = useSlideIn(0);
  const card = useSlideIn(1);

  const entries = useMemo(() => buildEntries(patients.data, recordings.data), [patients.data, recordings.data]);
  const attention = entries.filter((e) => e.severity.level === 'attention').length;
  const wash = entries.length ? Math.min(attention / entries.length, 1) * MAX_WASH : 0;
  const loading = patients.loading || recordings.loading;
  const error = patients.error ?? recordings.error;
  const ready = !hasDatabase() || !loading;

  useEffect(() => {
    if (ready) return undefined;
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    if (!collapsed && graphRef.current) graphHeight.current = graphRef.current.offsetHeight;
  });

  /** Slide the graph away once the list is scrolled, and back when it returns to the top. */
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (collapsed) {
      if (el.scrollTop < EXPAND_AT) setCollapsed(false);
    } else if (el.scrollTop > COLLAPSE_AT && el.scrollHeight - el.clientHeight - graphHeight.current > MIN_OVERFLOW) {
      setCollapsed(true);
    }
  };

  /** Open a patient, handing the row and wordmark rectangles to the next page for its entrance. */
  const open = (id: string, row: HTMLElement) => {
    const handoff: FlipOrigin = { from: 'landing', at: Date.now(), lensRect: rectOf(row), wordmarkRect: rectOf(brandRef.current ?? row) };
    navigate(`/physician/${id}`, { state: handoff });
  };

  const slide = reduced ? '' : 'calc(100% + 2rem)';
  const body = !hasDatabase() ? <SetupCard />
    : error ? <ErrorCard message={error} />
    : !loading && !entries.length ? <EmptyCard />
    : null;

  return (
    <motion.main
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.2 : 0.25, ease: 'easeOut' } }}
      className="relative flex min-h-dvh flex-col overflow-x-clip p-4 sm:p-6 lg:h-dvh lg:overflow-hidden"
      style={{ backgroundColor: `rgb(181 56 43 / ${wash})`, transition: 'background-color 600ms ease-out' }}
    >
      <AnimatePresence>
        {!ready && slow && (
          <motion.p
            key="loading"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
            className="eyebrow pointer-events-none absolute inset-0 grid place-items-center"
          >
            Loading patients…
          </motion.p>
        )}
      </AnimatePresence>

      {ready && (
        <motion.div {...brand} className="mb-4 flex shrink-0 justify-center">
          <Link ref={brandRef} to="/" aria-label="TrueReach, back to start" className="pressable inline-block" style={{ transitionProperty: 'transform' }}>
            <Wordmark size="md" />
          </Link>
        </motion.div>
      )}

      {!ready ? null : body ? <div className="flex flex-1 flex-col">{body}</div> : (
        <>
          <div
            className="grid shrink-0"
            style={{ gridTemplateRows: collapsed ? '0fr' : '1fr', transition: `grid-template-rows ${reduced ? 200 : 450}ms var(--ease-drawer)` }}
          >
            <div className="pointer-events-none -mx-4 -mb-8 -mt-2 min-h-0 overflow-hidden px-4 pb-12 pt-2 lg:-mx-8 lg:px-8" style={GUTTER}>
              <motion.div {...card} className={`${COLUMN} pointer-events-auto`}>
              <section
                ref={graphRef}
                aria-label="Trend of time compensating"
                aria-hidden={collapsed}
                className="material-solid flex h-[clamp(13rem,32dvh,19rem)] flex-col gap-2 p-5"
                style={{
                  boxShadow: 'var(--shadow-card), inset 0 1px 0 rgb(255 255 255 / 1)',
                  transform: collapsed ? `translateX(${slide})` : 'translateX(0)',
                  opacity: collapsed ? 0 : 1,
                  visibility: collapsed ? 'hidden' : 'visible',
                  transition: `transform 450ms var(--ease-drawer), opacity ${reduced ? 200 : 300}ms ease-out, visibility 0s linear ${collapsed ? 450 : 0}ms`,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="eyebrow">Time compensating, by session</p>
                  <p aria-live="polite" className={`font-display text-[0.8rem] uppercase tracking-[0.08em] ${attention ? 'text-bad' : 'text-ok'}`}>
                    {attention ? `${attention} ${attention === 1 ? 'patient needs' : 'patients need'} attention` : 'Nobody needs attention'}
                  </p>
                </div>
                <div className="min-h-0 flex-1"><TrendChart entries={entries} drawAfter={slideDelay(1) + SLIDE_SETTLED_S} /></div>
                <p className="text-[0.75rem] leading-tight text-ink-3">The attention line is a display setting, not a clinically validated cutoff.</p>
              </section>
              </motion.div>
            </div>
          </div>

          <motion.div layoutScroll onScroll={onScroll} className="-mx-4 min-h-0 flex-1 overscroll-contain px-4 pt-1 lg:overflow-y-auto lg:overflow-x-hidden" style={{ ...GUTTER, scrollbarColor: 'var(--color-ink-3) transparent' }}>
            <div className={COLUMN}>
              <PatientList entries={entries} onOpen={open} firstOrder={2} />
            </div>
          </motion.div>
        </>
      )}
    </motion.main>
  );
}
