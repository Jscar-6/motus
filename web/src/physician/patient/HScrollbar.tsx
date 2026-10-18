// A thin custom scrollbar for a horizontal scroller: only shown when the content overflows, thumb width = visible share, draggable.
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

const MIN_THUMB_PX = 28;

/** Scrollbar bound to `scrollerRef`; reserves its row so the card does not jump when it appears. */
export default function HScrollbar({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const grab = useRef(0);
  const [share, setShare] = useState(1);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    /** Thumb offset in px for the scroller's current position. */
    const place = () => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!track || !thumb) return;
      const max = scroller.scrollWidth - scroller.clientWidth;
      const free = track.clientWidth - Math.max(MIN_THUMB_PX, (scroller.clientWidth / scroller.scrollWidth) * track.clientWidth);
      thumb.style.transform = `translateX(${max > 0 ? (scroller.scrollLeft / max) * free : 0}px)`;
    };
    const measure = () => {
      setShare(scroller.clientWidth / Math.max(scroller.scrollWidth, 1));
      place();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    scroller.addEventListener('scroll', place, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', place);
    };
  }, [scrollerRef]);

  /** Scroll so the thumb's grabbed point follows the pointer. */
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !track || !thumb) return;
    const free = track.clientWidth - thumb.offsetWidth;
    const x = e.clientX - track.getBoundingClientRect().left - grab.current;
    scroller.scrollLeft = (Math.min(free, Math.max(0, x)) / Math.max(free, 1)) * (scroller.scrollWidth - scroller.clientWidth);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = thumb.getBoundingClientRect();
    grab.current = e.clientX >= box.left && e.clientX <= box.right ? e.clientX - box.left : box.width / 2;
    drag(e);
  };

  const visible = share < 0.999;
  return (
    <div
      ref={trackRef}
      aria-hidden
      onPointerDown={onDown}
      onPointerMove={(e) => e.buttons === 1 && drag(e)}
      className="relative mt-2 h-1.5 shrink-0 touch-none rounded-full bg-ink/[0.06]"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 150ms ease-out' }}
    >
      <div
        ref={thumbRef}
        className="absolute inset-y-0 left-0 cursor-grab rounded-full bg-ink/30 [@media(hover:hover)]:hover:bg-ink/45"
        style={{ width: `max(${MIN_THUMB_PX}px, ${share * 100}%)`, transition: 'background-color 150ms' }}
      />
    </div>
  );
}
