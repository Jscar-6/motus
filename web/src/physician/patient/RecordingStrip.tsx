// Horizontal strip of recording thumbnails (newest first) with a custom scrollbar that appears only when the tiles overflow.
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { publicUrl } from '../../db/supabase';
import type { RecordingRow } from '../../db/types';
import { pct } from '../format';
import { levelOf, type SeverityLevel } from '../severity';
import HScrollbar from './HScrollbar';

const CHIP_TONE: Record<SeverityLevel, string> = { none: 'text-ink-3', ok: 'text-ok', watch: 'text-[#8a5c0f]', attention: 'text-bad' };

interface TileProps { rec: RecordingRow; number: number; selected: boolean; isNew: boolean; onSelect: () => void }

/** Moving highlight over an uploading thumbnail. */
function Shimmer() {
  const reduced = useReducedMotion();
  if (reduced) return <span aria-hidden className="absolute inset-0 bg-white/15" />;
  return (
    <motion.span
      aria-hidden
      className="absolute inset-y-0 left-0 w-1/2"
      style={{ background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.3), transparent)' }}
      initial={{ transform: 'translateX(-100%)' }}
      animate={{ transform: 'translateX(200%)' }}
      transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.3 }}
    />
  );
}

/** One thumbnail tile: image or dark placeholder, status, severity chip, and its "Video N" label. */
function Tile({ rec, number, selected, isNew, onSelect }: TileProps) {
  const reduced = useReducedMotion();
  const thumb = publicUrl(rec.thumb_path);
  return (
    <motion.div
      layout="position"
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-[9.5rem] shrink-0"
    >
      <button type="button" data-tile aria-pressed={selected} onClick={onSelect} className="pressable block w-full cursor-pointer text-left">
        <span className={clsx('relative block aspect-[16/10] overflow-hidden rounded-[var(--radius-inner)] bg-[#2b1a12]', selected && 'ring-2 ring-ink')}>
          {thumb && <img src={thumb} alt="" loading="lazy" draggable={false} className="absolute inset-0 size-full object-cover" />}
          {rec.status === 'uploading' && <Shimmer />}
          {rec.status === 'recording' && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center gap-1.5 font-display text-[0.65rem] tracking-[0.08em] text-white/90 uppercase">
                <motion.span
                  aria-hidden
                  className="size-2 rounded-full bg-[#FF6B57]"
                  animate={reduced ? undefined : { opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                Recording…
              </span>
            </span>
          )}
          {rec.status === 'ready' && (
            <span className={clsx('tabular absolute top-1.5 right-1.5 inline-flex h-5 items-center rounded-full bg-white/85 px-2 font-display text-[0.65rem] tracking-[0.04em]', CHIP_TONE[levelOf(rec.pct_compensating)])}>
              {pct(rec.pct_compensating)}
            </span>
          )}
        </span>
        <span className={clsx('mt-1 flex items-center gap-1.5 font-display text-[0.7rem] tracking-[0.08em] uppercase', selected ? 'text-ink' : 'text-ink-2')}>
          Video {number}
          {isNew && <span className="size-1.5 rounded-full bg-bad"><span className="sr-only">New</span></span>}
        </span>
      </button>
    </motion.div>
  );
}

interface Props { recordings: RecordingRow[]; selectedId: string | null; newIds: ReadonlySet<string>; onSelect: (id: string) => void }

/** The scrolling strip of tiles plus its scrollbar; arrow keys move between tiles, the wheel scrolls sideways. */
export default function RecordingStrip({ recordings, selectedId, newIds, onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tiles = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-tile]')];
    const next = tiles[tiles.indexOf(document.activeElement as HTMLButtonElement) + (e.key === 'ArrowRight' ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-3 p-0.5">
          <AnimatePresence initial={false}>
            {recordings.map((rec, i) => (
              <Tile key={rec.id} rec={rec} number={recordings.length - i} selected={rec.id === selectedId} isNew={newIds.has(rec.id)} onSelect={() => onSelect(rec.id)} />
            ))}
          </AnimatePresence>
        </div>
      </div>
      <HScrollbar scrollerRef={scrollerRef} />
    </div>
  );
}
