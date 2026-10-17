// The ranked list of patient rows; rows glide to their new place when severity changes.
import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import type { Entry } from './model';
import PatientRow from './PatientRow';

const MAX_STAGGERED = 8;
const STAGGER_S = 0.04;
const SETTLE_MS = 900;

/** Ranked patient rows; only the first paint staggers, patients added later fade in on their own. */
export default function PatientList({ entries, onOpen }: { entries: Entry[]; onOpen: (id: string, el: HTMLElement) => void }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <LayoutGroup>
      <ul className="flex flex-col gap-3 pb-2">
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => (
            <PatientRow key={entry.patient.id} entry={entry} delay={settled ? 0 : Math.min(i, MAX_STAGGERED) * STAGGER_S} onOpen={onOpen} />
          ))}
        </AnimatePresence>
      </ul>
    </LayoutGroup>
  );
}
