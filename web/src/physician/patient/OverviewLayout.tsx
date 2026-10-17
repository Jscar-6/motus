// Page frame for the patient overview: desktop grid with slide-out cards and the focus view, or a stacked layout on narrow screens.
import { motion, useReducedMotion } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Materialize from '../../doctor/Materialize';
import VideoStage from '../../doctor/VideoStage';
import { useFlipFrom, type FlipRect } from '../../landing/useFlipFrom';
import AlertTint from '../../patient/AlertTint';
import Wordmark from '../../ui/Wordmark';

const BOTTOM_ROW = 216;
const SLIDE_OUT = {
  left: 'translate3d(calc(-100% - 6px), 0, 0)',
  right: 'translate3d(calc(100% + 6px), 0, 0)',
  bottom: 'translate3d(0, 100%, 0)',
} as const;

interface Slots { arm: ReactNode; data: ReactNode; past: ReactNode; mic: ReactNode; surface: ReactNode; overlay: ReactNode }
interface Props extends Slots {
  desktop: boolean;
  focus: boolean;
  onToggleFocus: () => void;
  lensRect?: FlipRect;
  wordmarkRect?: FlipRect;
}

interface PeekProps { edge: keyof typeof SLIDE_OUT; focus: boolean; order: number; onRestore: () => void; label: string; children: ReactNode }

/** Card that slides off-screen in focus mode, leaving a sliver that brings everything back when clicked. */
function PeekPanel({ edge, focus, order, onRestore, label, children }: PeekProps) {
  const reduce = useReducedMotion();
  const away = focus ? SLIDE_OUT[edge] : 'translate3d(0, 0, 0)';
  return (
    <div
      className="relative h-full w-full"
      style={
        reduce
          ? { transform: away, opacity: focus ? 0.35 : 1, transition: 'opacity 200ms ease' }
          : { transform: away, transition: 'transform 600ms var(--ease-drawer)' }
      }
    >
      <Materialize delay={order * 0.05} className="h-full w-full">{children}</Materialize>
      {focus && <button type="button" aria-label={label} onClick={onRestore} className="absolute inset-0 z-10 cursor-pointer rounded-[var(--radius-card)]" />}
    </div>
  );
}

/** Desktop grid or stacked layout around the overview's cards. */
export default function OverviewLayout({ desktop, focus, onToggleFocus, lensRect, wordmarkRect, arm, data, past, mic, surface, overlay }: Props) {
  const reduce = useReducedMotion();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  useFlipFrom(brandRef, wordmarkRect, 'text');

  const brand = (
    <Link ref={brandRef} to="/physician" aria-label="TrueReach, back to all patients" className="pressable pointer-events-auto inline-block" style={{ transitionProperty: 'transform' }}>
      <Wordmark layoutId="wordmark" />
    </Link>
  );
  const exit = { opacity: 0, transition: { duration: reduce ? 0.2 : 0.25, ease: 'easeOut' } } as const;

  if (!desktop) {
    return (
      <motion.main initial={{ opacity: 1 }} exit={exit} className="relative flex min-h-dvh flex-col gap-4 p-4">
        <AlertTint />
        <header className="relative">{brand}</header>
        <Materialize x={-32} y={0} className="relative aspect-[4/3] w-full">
          <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-card)] bg-[#2b1a12] shadow-[var(--shadow-float)]">
            {surface}
            {overlay}
          </div>
        </Materialize>
        <Materialize delay={0.05} className="relative h-72">{arm}</Materialize>
        <Materialize delay={0.1} className="relative h-[216px]">{data}</Materialize>
        <Materialize delay={0.15} className="relative h-[216px]">{past}</Materialize>
        <Materialize delay={0.2} className="relative h-[190px] max-w-[260px]">{mic}</Materialize>
      </motion.main>
    );
  }

  return (
    <motion.main initial={{ opacity: 1 }} exit={exit} className="relative h-dvh overflow-hidden p-6">
      <AlertTint />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex px-6 pt-6" style={{ justifyContent: focus ? 'center' : 'flex-start' }}>
        {brand}
      </header>

      <div
        className="grid h-full gap-6"
        style={{
          gridTemplateColumns: 'clamp(240px, 21vw, 300px) minmax(0, 1fr) clamp(170px, 14vw, 210px)',
          gridTemplateRows: `minmax(0, 1fr) ${BOTTOM_ROW}px`,
        }}
      >
        <div ref={placeholderRef} aria-hidden className="col-span-2 col-start-2 row-start-1" />
        <div className="col-start-1 row-start-1 min-h-0 pt-14">
          <PeekPanel edge="left" focus={focus} order={1} onRestore={onToggleFocus} label="Show the side cards">{arm}</PeekPanel>
        </div>
        <div className="col-start-1 row-start-2">
          <PeekPanel edge="left" focus={focus} order={2} onRestore={onToggleFocus} label="Show the side cards">{data}</PeekPanel>
        </div>
        <div className="col-start-2 row-start-2 min-w-0">
          <PeekPanel edge="bottom" focus={focus} order={3} onRestore={onToggleFocus} label="Show the past exercises">{past}</PeekPanel>
        </div>
        <div className="col-start-3 row-start-2">
          <PeekPanel edge="right" focus={focus} order={4} onRestore={onToggleFocus} label="Show the voice card">{mic}</PeekPanel>
        </div>
      </div>

      <VideoStage placeholderRef={placeholderRef} focus={focus} onToggle={onToggleFocus} content={surface} enterFrom={lensRect}>{overlay}</VideoStage>
    </motion.main>
  );
}
