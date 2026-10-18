// Which patient this device records for. Remembered per device; defaults to the first non-sample patient.
import { useEffect } from 'react';
import { create } from 'zustand';
import { usePatients } from './hooks';
import type { PatientRow } from './types';

const KEY = 'truereach.activePatient';

/** Read the remembered id; storage can throw in private windows. */
function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

interface ActivePatientState {
  id: string | null;
  set: (id: string) => void;
}

export const useActivePatientStore = create<ActivePatientState>((set) => ({
  id: readStored(),
  set: (id) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* per-device convenience only */
    }
    set({ id });
  },
}));

/** The active patient row (falls back to the first non-sample patient) and whether the database is configured. */
export function useActivePatient(): { patient: PatientRow | null; configured: boolean } {
  const { data, configured } = usePatients();
  const { id, set } = useActivePatientStore();
  const chosen = data.find((p) => p.id === id) ?? data.find((p) => !p.is_sample) ?? data[0] ?? null;

  useEffect(() => {
    if (chosen && chosen.id !== id) set(chosen.id);
  }, [chosen, id, set]);

  return { patient: chosen, configured };
}
