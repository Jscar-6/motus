// Landing indicator of who is being recorded; becomes a small menu when there is more than one real patient (F11).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useActivePatient } from '../db/activePatient';
import { EASE_OUT } from '../patient/motion';

/** "Recording for · Name" line; null without a database or patient. */
export default function PatientSwitcher() {
  const { patient, patients, setPatient, configured } = useActivePatient();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const choices = patients.filter((p) => !p.is_sample);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!configured || !patient) return null;
  if (choices.length < 2) return <p className="eyebrow">Recording for · {patient.name}</p>;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="eyebrow pressable cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        style={{ transitionProperty: 'transform' }}
      >
        Recording for · {patient.name} ▾
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Active patient"
            initial={reduced ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.96)' }}
            animate={{ opacity: 1, transform: 'scale(1)', transition: { duration: 0.18, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            style={{ transformOrigin: 'top left' }}
            className="material absolute left-0 top-full z-10 mt-2 flex min-w-48 flex-col p-1.5"
          >
            {choices.map((p) => (
              <li key={p.id} role="option" aria-selected={p.id === patient.id}>
                <button
                  type="button"
                  autoFocus={p.id === patient.id}
                  onClick={() => { setPatient(p.id); setOpen(false); }}
                  className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[0.95rem] text-ink focus-visible:bg-white/80 focus-visible:outline-none [@media(hover:hover)]:hover:bg-white/80"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
