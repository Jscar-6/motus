// The live video panel. On desktop it floats above the grid and follows a placeholder cell; focus mode springs it to ~90% of the viewport.
// Real size is animated (not a scale transform) so the canvas never stretches mid-flight; springs retarget from their velocity, so rapid toggles reverse smoothly.
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import LiveView from './LiveView';
import Materialize from './Materialize';

const SPRING = { type: 'spring', bounce: 0, duration: 0.55 } as const;
const SMOOTH_WINDOW_MS = 800;
const FOCUS_TOP = 64;
const FOCUS_BOTTOM = 40;

interface Rect { left: number; top: number; width: number; height: number }
interface Props {
  placeholderRef: RefObject<HTMLDivElement | null>;
  focus: boolean;
  onToggle: () => void;
  children?: ReactNode;
  content?: ReactNode;                                                      // replaces the live view (physician playback)
  enterFrom?: { x: number; y: number; width: number; height: number };    // viewport rect the panel grows out of on mount
}

/** Rectangle of the focus view: 90% of the viewport width, centred, below the wordmark. */
function focusRect(): Rect {
  const width = Math.round(window.innerWidth * 0.9);
  return { left: (window.innerWidth - width) / 2, top: FOCUS_TOP, width, height: window.innerHeight - FOCUS_TOP - FOCUS_BOTTOM };
}

/** Hint chip text for the bottom-left corner of the video. */
function Hint({ focus }: { focus: boolean }) {
  return (
    <p className="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex h-7 items-center rounded-full bg-black/35 px-3 font-display text-[0.7rem] tracking-[0.08em] text-white/90 uppercase backdrop-blur-md">
      {focus ? 'Click or Esc to exit' : 'Click to focus'}
    </p>
  );
}

/** Desktop video panel with the focus animation. */
export default function VideoStage({ placeholderRef, focus, onToggle, children, content, enterFrom }: Props) {
  const reduce = useReducedMotion();
  const left = useMotionValue(0);
  const top = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const dip = useMotionValue(1);
  const smoothUntil = useRef(0);
  const focusRef = useRef(focus);
  const mounted = useRef(false);

  /** Moves the rect to the focus rect or the placeholder cell: sprung during a toggle, tracked exactly otherwise. */
  const place = useCallback(() => {
    const ph = placeholderRef.current;
    const parent = ph?.offsetParent;
    if (!ph || !parent) return;
    const box = ph.getBoundingClientRect();
    const origin = parent.getBoundingClientRect();
    const target = focusRef.current ? focusRect() : { left: box.left - origin.left, top: box.top - origin.top, width: box.width, height: box.height };
    const smooth = !reduce && performance.now() < smoothUntil.current;
    const values = { left, top, width, height };
    for (const k of Object.keys(values) as (keyof Rect)[]) {
      if (smooth) animate(values[k], target[k], SPRING);
      else values[k].jump(target[k]);
    }
  }, [placeholderRef, reduce, left, top, width, height]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useLayoutEffect(() => {
    const parent = placeholderRef.current?.offsetParent;
    if (!enterFrom || !parent) return;
    const origin = parent.getBoundingClientRect();
    left.jump(enterFrom.x - origin.left);
    top.jump(enterFrom.y - origin.top);
    width.jump(enterFrom.width);
    height.jump(enterFrom.height);
    smoothUntil.current = performance.now() + SMOOTH_WINDOW_MS;
    place();
  }, []); // once, on mount

  useEffect(() => {
    const ph = placeholderRef.current;
    const observer = new ResizeObserver(place);
    if (ph) observer.observe(ph);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [placeholderRef, place]);

  useEffect(() => {
    focusRef.current = focus;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    smoothUntil.current = performance.now() + SMOOTH_WINDOW_MS;
    if (reduce) animate(dip, [0.35, 1], { duration: 0.2, ease: 'easeOut' });
    place();
  }, [focus, place, reduce, dip]);

  return (
    <Materialize x={enterFrom ? 0 : -72} y={0} className="absolute z-20" style={{ left, top, width, height }}>
      <motion.div style={{ opacity: dip, contain: 'layout paint' }} className="relative h-full w-full overflow-hidden rounded-[var(--radius-card)] bg-[#2b1a12] shadow-[var(--shadow-float)]">
        {content ?? <LiveView />}
        <button
          type="button"
          aria-label={focus ? 'Exit focus view' : 'Focus on the live video'}
          aria-pressed={focus}
          onClick={onToggle}
          className="absolute inset-0 rounded-[var(--radius-card)]"
          style={{ cursor: focus ? 'zoom-out' : 'zoom-in' }}
        />
        {children}
        <Hint focus={focus} />
      </motion.div>
    </Materialize>
  );
}
