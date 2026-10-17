// Flag log: newest flags enter from the top; times are relative to when this tab received each flag.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CompLabel } from '../lib/types';
import { useLive } from '../live/store';
import type { FlagEvent } from '../live/types';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const NAMES: Partial<Record<CompLabel, string>> = { trunk_lean: 'Trunk lean', shoulder_hike: 'Shoulder hike', trunk_rotation: 'Trunk rotation' };
const SHOWN = 8;

/** "4s ago" style label from a millisecond age. */
function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/** The flag's measured value in its own unit. */
function valueText(f: FlagEvent): string {
  if (f.label === 'shoulder_hike') return f.value.toFixed(2);
  if (f.label === 'trunk_lean' || f.label === 'trunk_rotation') return `${f.value.toFixed(1)}°`;
  return '';
}

/** Scrolling list of the latest compensation flags. */
export default function FlagLog() {
  const flags = useLive((s) => s.flags);
  const [now, setNow] = useState(() => performance.now());
  // FlagEvent.t is the patient tab's clock, so ages are measured from when this tab first saw each id.
  const seen = useRef(new Map<string, number>());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  for (const f of flags) if (!seen.current.has(f.id)) seen.current.set(f.id, performance.now());

  return (
    <div>
      <p className="eyebrow">Flag log</p>
      {flags.length === 0 ? (
        <p className="mt-2 text-[0.9rem] text-ink-3">No flags yet.</p>
      ) : (
        <ul className="mt-1">
          <AnimatePresence initial={false}>
            {flags.slice(0, SHOWN).map((f) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="flex items-baseline gap-2 border-b border-hairline py-2 text-[0.92rem]">
                  <span aria-hidden className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-bad" />
                  <span className="min-w-0 flex-1 truncate text-ink">{NAMES[f.label] ?? f.label}</span>
                  <span className="text-ink-2 tabular">{valueText(f)}</span>
                  <span className="w-14 text-right text-[0.8rem] text-ink-3 tabular">{ago(now - (seen.current.get(f.id) ?? now))}</span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
