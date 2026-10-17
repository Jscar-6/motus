// Page frame for the therapist portal: desktop grid with slide-out side panels and the focus view, or a stacked layout on narrow screens.
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import Wordmark from '../ui/Wordmark';
import LiveView from './LiveView';
import Materialize from './Materialize';
import VideoStage from './VideoStage';

const MIC_SIZE = 190;
const COACH_HEIGHT = 190;
const MATH_OPEN_PX = 340;
const MATH_RAIL_PX = 56;
const SLIDE_OUT = {
  left: 'translate3d(calc(-100% - 6px), 0, 0)',
  right: 'translate3d(calc(100% + 6px), 0, 0)',
  bottom: 'translate3d(0, 100%, 0)',
} as const;

interface Slots { adjustments: ReactNode; mic: ReactNode; coach: ReactNode; math: ReactNode; videoOverlay: ReactNode }
interface Props extends Slots { desktop: boolean; focus: boolean; mathOpen: boolean; onToggleFocus: () => void }

interface PeekProps { edge: keyof typeof SLIDE_OUT; focus: boolean; order: number; onRestore: () => void; label: string; className?: string; children: ReactNode }

/** Side panel that slides off-screen in focus mode, leaving a sliver that brings everything back when clicked. */
function PeekPanel({ edge, focus, order, onRestore, label, className, children }: PeekProps) {
  const reduce = useReducedMotion();
  const away = focus ? SLIDE_OUT[edge] : 'translate3d(0, 0, 0)';
  return (
    <div
      className={clsx('relative h-full w-full', className)}
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

/** Desktop grid or stacked layout around the portal's panels. */
export default function DoctorLayout({ desktop, focus, mathOpen, onToggleFocus, adjustments, mic, coach, math, videoOverlay }: Props) {
  const placeholderRef = useRef<HTMLDivElement>(null);

  if (!desktop) {
    return (
      <main className="relative flex min-h-dvh flex-col gap-4 p-4">
        <Wordmark layoutId="wordmark" />
        <Materialize x={-32} y={0} className="relative aspect-[4/3] w-full">
          <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-card)] bg-[#2b1a12] shadow-[var(--shadow-float)]">
            <LiveView />
            {videoOverlay}
          </div>
        </Materialize>
        <Materialize delay={0.05} className="h-[22rem]">{adjustments}</Materialize>
        <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
          <Materialize delay={0.1} className="aspect-square w-full max-w-[190px]">{mic}</Materialize>
          <Materialize delay={0.15} className="h-[190px]">{coach}</Materialize>
        </div>
        <Materialize delay={0.2} className="h-[40rem]">{math}</Materialize>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden p-6">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex px-6 pt-6" style={{ justifyContent: focus ? 'center' : 'flex-start' }}>
        <Wordmark layoutId="wordmark" />
      </header>

      <div
        className="grid h-full gap-6"
        style={{
          gridTemplateColumns: `clamp(240px, 21vw, 300px) minmax(0, 1fr) ${mathOpen ? MATH_OPEN_PX : MATH_RAIL_PX}px`,
          gridTemplateRows: `minmax(0, 1fr) ${COACH_HEIGHT}px`,
          transition: 'grid-template-columns 600ms var(--ease-drawer)',
        }}
      >
        <div ref={placeholderRef} aria-hidden className="col-start-2 row-start-1" />
        <div className="col-start-1 row-start-1 min-h-0 pt-14">
          <PeekPanel edge="left" focus={focus} order={1} onRestore={onToggleFocus} label="Show the side panels">{adjustments}</PeekPanel>
        </div>
        <div className="col-start-1 row-start-2" style={{ width: MIC_SIZE }}>
          <PeekPanel edge="left" focus={focus} order={2} onRestore={onToggleFocus} label="Show the side panels">{mic}</PeekPanel>
        </div>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0" style={{ marginLeft: MIC_SIZE + 24 }}>
          <PeekPanel edge="bottom" focus={focus} order={3} onRestore={onToggleFocus} label="Show the coach panel">{coach}</PeekPanel>
        </div>
        <div className="col-start-3 row-span-2 row-start-1 min-h-0">
          <PeekPanel edge="right" focus={focus} order={4} onRestore={onToggleFocus} label="Show the live math panel">{math}</PeekPanel>
        </div>
      </div>

      <VideoStage placeholderRef={placeholderRef} focus={focus} onToggle={onToggleFocus}>{videoOverlay}</VideoStage>
    </main>
  );
}
