// Collapsible table of the raw landmark coordinates the features are computed from.
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { PoseFrame } from '../lib/types';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ROWS = ['ear', 'shoulder', 'elbow', 'wrist', 'hip'] as const;

/** Landmarks (x, y, visibility) for the current pose, 3 decimals. */
export default function LandmarksTable({ pose }: { pose: PoseFrame | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="pressable flex w-full cursor-pointer items-center justify-between py-1"
      >
        <span className="eyebrow">Landmarks</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-ink-3" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 250ms var(--ease-out)' }} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <table className="mt-1 w-full text-[0.85rem]">
              <thead>
                <tr className="text-ink-3">
                  <th className="py-1 text-left font-normal">Point</th>
                  <th className="py-1 text-right font-normal">x</th>
                  <th className="py-1 text-right font-normal">y</th>
                  <th className="py-1 text-right font-normal">vis</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((name) => {
                  const p = pose?.[name];
                  return (
                    <tr key={name} className="border-t border-hairline">
                      <td className="py-1.5 capitalize">{name}</td>
                      <td className="py-1.5 text-right tabular">{p ? p.x.toFixed(3) : '—'}</td>
                      <td className="py-1.5 text-right tabular">{p ? p.y.toFixed(3) : '—'}</td>
                      <td className="py-1.5 text-right tabular">{p?.vis !== undefined ? p.vis.toFixed(3) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
