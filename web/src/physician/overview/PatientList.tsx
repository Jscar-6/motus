// The ranked list of patient rows; rows glide to their new place when severity changes.
import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import type { Entry } from './model';
import PatientRow from './PatientRow';

const MAX_STAGGERED = 8;
const SETTLE_MS = 900;

/** Ranked patient rows; on first paint row i slides in as page item `firstOrder + i`, patients added later fade in on their own. */
export default function PatientList({ entries, onOpen, firstOrder = 0 }: { entries: Entry[]; onOpen: (id: string, el: HTMLElement) => void; firstOrder?: number }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <LayoutGroup>
      <ul className="flex flex-col gap-3 pb-2">
        <AnimatePresence>
          {entries.map((entry, i) => (
            <PatientRow key={entry.patient.id} entry={entry} order={settled ? null : firstOrder + Math.min(i, MAX_STAGGERED)} onOpen={onOpen} />
          ))}
        </AnimatePresence>
      </ul>
    </LayoutGroup>
  );
}
