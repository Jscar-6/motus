// Chips on the top-right of the live video: LIVE, data source, camera mode and (in demo) a shortcut to the patient view.
import { useLive } from '../live/store';
import Badge from '../ui/Badge';

const SOURCE_LABEL = { none: 'Connecting', camera: 'Camera', demo: 'Demo data', remote: 'Patient tab' } as const;

/** Status chips overlaid on the video. Only the shortcut button takes pointer events. */
export default function VideoChips({ mode }: { mode: 'remote' | 'demo' }) {
  const source = useLive((s) => s.source);
  const demo = source === 'demo' || (source === 'none' && mode === 'demo');
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2">
      {demo && (
        <button
          type="button"
          onClick={() => window.open('/session', 'truereach-patient')}
          className="pressable pointer-events-auto inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-white/70 px-3 font-display text-[0.7rem] tracking-[0.08em] text-ink-2 uppercase [@media(hover:hover)]:hover:bg-white"
          style={{ transitionProperty: 'transform, background-color' }}
        >
          Open patient view
          <span aria-hidden>↗</span>
        </button>
      )}
      <Badge tone="neutral">{SOURCE_LABEL[demo ? 'demo' : source]}</Badge>
      <Badge tone="neutral">Camera</Badge>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-black/40 px-3 font-display text-[0.7rem] tracking-[0.08em] text-white uppercase backdrop-blur-md">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-[#FF6B57] motion-reduce:animate-none" />
        Live
      </span>
    </div>
  );
}
