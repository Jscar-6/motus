// Session camera panel (Figma 1:6): the vision model's webcam filling the panel, with grey glass pills on top:
// tracked side, rest-pose capture, and a live chip for the measurement changing the most. Clicking the video places
// the target (near by default).
import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { METRICS, levelOf, type Metric } from '../doctor/metrics';
import { FORWARD_REACH } from '../lib/config';
import type { RestCaptureStatus } from '../lib/features';
import type { CompLabel, FrameFeatures } from '../lib/types';
import { pushFlag, pushSample, useLive } from '../live/store';
import type { LiveSample } from '../live/types';
import { EASE_OUT } from '../patient/motion';
import CameraView from './CameraView';
import { targetFromClick } from './target';
import { useVisionModel } from './useVisionModel';
import SleevePill from '../sleeve/SleevePill';

// UI timing for the live chip (display only, not a detection threshold): change is measured over this window,
// and a newly shown measurement stays at least HOLD_MS so the chip doesn't flicker between two.
const CHANGE_WINDOW_MS = 500;
const HOLD_MS = 800;
const LIVE_KEYS = ['lean', 'hike', 'rot', 'elbow', 'flex'] as const;
const PILL = 'inline-flex h-8 items-center gap-1 rounded-full bg-[rgb(110_104_98/0.42)] px-1 font-display text-[0.7rem] uppercase tracking-[0.08em] text-white backdrop-blur-md';
const REJECT = { no_person: 'no one in view', hidden: 'body hidden', moving: 'you moved' };

/** Short pill text for the rest-pose capture state. */
function restLabel(s: RestCaptureStatus | null): string {
  if (!s) return 'Capture rest pose';
  if (s.kind === 'holding') return `Hold still · ${Math.round(s.progress * 100)}%`;
  if (s.kind === 'rejected') return `Restarting · ${REJECT[s.reason]}`;
  return 'Rest pose ✓';
}

/** Two-option segmented control inside a grey pill. */
function Segmented<T extends string>({ label, options, value, onPick }: {
  label: string;
  options: { value: T; text: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={PILL}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onPick(o.value)}
          className={clsx(
            'pressable h-6 cursor-pointer rounded-full px-3 transition-colors duration-150',
            o.value === value ? 'bg-white/90 text-ink' : 'text-white/85 [@media(hover:hover)]:hover:bg-white/20',
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** Picks the measurement whose value moved most (relative to its display range) over the last window. */
function useMostChanging(features: FrameFeatures | null): Metric | null {
  const history = useRef<{ t: number; f: FrameFeatures }[]>([]);
  const shown = useRef<{ metric: Metric; since: number } | null>(null);
  const metrics = METRICS.filter((m) => (LIVE_KEYS as readonly string[]).includes(m.key));

  const now = performance.now();
  if (features && history.current[history.current.length - 1]?.f !== features) {
    history.current = [...history.current.filter((h) => now - h.t <= CHANGE_WINDOW_MS), { t: now, f: features }];
    const oldest = history.current[0].f;
    const change = (m: Metric) => {
      const a = m.read({ features: oldest } as LiveSample);
      const b = m.read({ features } as LiveSample);
      return a === null || b === null ? -1 : Math.abs(b - a) / (m.hi - m.lo);
    };
    const best = metrics.reduce((x, y) => (change(y) > change(x) ? y : x));
    const cur = shown.current;
    if (!cur || (best.key !== cur.metric.key && now - cur.since >= HOLD_MS && change(best) > change(cur.metric))) {
      shown.current = { metric: best, since: now };
    }
  }
  return features ? shown.current?.metric ?? metrics[0] : null;
}

/** Live chip: the most-changing measurement and its value, red once it passes its threshold. */
function LiveChip({ features, rules }: Pick<LiveSample, 'features' | 'rules'>) {
  const reduced = useReducedMotion();
  const metric = useMostChanging(features);
  const sample = { features, rules } as LiveSample;
  const value = metric ? metric.read(sample) : null;
  const over = metric ? levelOf(metric, sample) === 'over' : false;
  const enter = reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px)' };
  const exit = reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-10px)' };

  return (
    <div
      aria-live="polite"
      className={clsx(PILL, 'relative min-w-[9.5rem] overflow-hidden px-3.5 transition-colors duration-200', over && '!bg-bad/85')}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={metric?.key ?? 'none'}
          initial={enter}
          animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.22, ease: EASE_OUT } }}
          exit={{ ...exit, transition: { duration: 0.15, ease: EASE_OUT } }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          {metric && value !== null ? (
            <>
              {metric.label}
              <span className="tabular">{value > 0 && metric.check ? '+' : ''}{value.toFixed(metric.digits)}{metric.unit}</span>
            </>
          ) : (
            <span className="text-white/75">Live · capture rest pose</span>
          )}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** Publishes each vision frame and every new flag to the live store, so recordings save the pose timeline. */
function usePublishToLive(v: ReturnType<typeof useVisionModel>): void {
  const lastFlags = useRef<CompLabel[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    useLive.setState({ restCaptured: v.capture?.kind === 'done', near: v.target?.near ?? v.near, targetSet: !!v.target, reps: v.reps.length });
  }, [v.capture, v.target, v.near, v.reps]);
  useEffect(() => {
    if (!v.frame && !v.features) return;
    const t = performance.now();
    pushSample({ t, pose: v.frame, features: v.features, rules: v.rules, aspect: v.aspect });
    const flags = v.rules?.flags ?? [];
    for (const label of flags) {
      if (lastFlags.current.includes(label)) continue;
      const value = v.rules?.checks.find((c) => c.label === label)?.value ?? 0;
      pushFlag({ id: `${label}-${++seq.current}`, t, label, value });
    }
    lastFlags.current = flags;
  }, [v.frame, v.features, v.rules, v.aspect]);
}

/** Full-panel webcam with the vision model's controls as grey pills; `trailing` sits top right (Record). */
export default function VisionOverlay({ trailing }: { trailing?: ReactNode }) {
  const v = useVisionModel();
  usePublishToLive(v);
  const r = FORWARD_REACH.touchRadius!;
  const tip = v.hand;

  return (
    <>
      {/* The box keeps the video's aspect ratio and covers the panel, so clicks and overlays stay in video coordinates.
          CameraView's own status text is hidden: the Session panel already shows starting and error states. */}
      <div className="absolute inset-0 overflow-hidden [container-type:size] [&_p]:hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
          style={{ aspectRatio: v.aspect, width: `max(100cqw, calc(100cqh * ${v.aspect}))` }}
          onClick={(e) => v.setTarget(targetFromClick(e.clientX, e.clientY, e.currentTarget.querySelector('video')!, v.near))}
        >
          <CameraView side={v.side} onPose={v.onPose} debug />
          {v.target && (
            <div
              className="pointer-events-none absolute rounded-full border-[3px] border-sky-400 transition-colors duration-150"
              style={{
                left: `${(v.target.point[0] - r / v.aspect) * 100}%`, top: `${(v.target.point[1] - r) * 100}%`,
                width: `${(2 * r * 100) / v.aspect}%`, height: `${2 * r * 100}%`,
                background: v.touching ? 'rgb(56 189 248 / 0.6)' : 'transparent',
              }}
            />
          )}
          {tip && (
            <div
              className="pointer-events-none absolute -ml-[5px] -mt-[5px] size-2.5 rounded-full bg-yellow-400"
              style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%`, opacity: tip.source === 'hand' ? 1 : 0.5 }}
              title={tip.source === 'hand' ? 'Hand model' : 'Estimated from the arm'}
            />
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Segmented
            label="Side tracked"
            options={[{ value: 'left', text: 'Left' }, { value: 'right', text: 'Right' }]}
            value={v.side}
            onPick={v.pickSide}
          />
          <button
            type="button"
            onClick={v.requestCapture}
            className={clsx(PILL, 'pressable relative cursor-pointer overflow-hidden px-3.5 [@media(hover:hover)]:hover:bg-[rgb(110_104_98/0.55)]')}
          >
            {v.capture?.kind === 'holding' && (
              <span aria-hidden className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${v.capture.progress * 100}%` }} />
            )}
            <span className="relative whitespace-nowrap">{restLabel(v.capture)}</span>
          </button>
          <LiveChip features={v.features} rules={v.rules} />
          <SleevePill pillClass={PILL} />
        </div>
        {trailing && <div className="pointer-events-auto shrink-0">{trailing}</div>}
      </div>
    </>
  );
}
