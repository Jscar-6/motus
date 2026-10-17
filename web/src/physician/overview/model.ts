// View model for the physician overview: one entry per patient with severity, chart series and list order.
import type { PatientRow, RecordingRow } from '../../db/types';
import { byPatient, severityOf, type Severity } from '../severity';

export interface Entry {
  patient: PatientRow;
  severity: Severity;
  series: RecordingRow[];   // finished recordings with a score, oldest first
  signature: string;        // changes when a recording is added or changes status
}

const TINTS = ['#f2c9b0', '#efd3a0', '#e8bfa8', '#f0d9b5', '#e9b9a0', '#f3cdbd'];

/** Warm avatar tint picked from a hash of the name, so a patient keeps their colour. */
export function tintOf(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** Rank for the list: attention first, then patients with data, then patients without. */
function rankOf(e: Entry): number {
  if (e.severity.level === 'attention') return 0;
  return e.severity.pct === null ? 2 : 1;
}

/** Patients joined with their recordings, ordered attention first, then by share compensating (highest first), then no data. */
export function buildEntries(patients: PatientRow[], recordings: RecordingRow[]): Entry[] {
  const grouped = byPatient(recordings);
  const entries = patients.map((patient): Entry => {
    const own = grouped.get(patient.id) ?? [];
    const newest = own.reduce<RecordingRow | null>((a, r) => (!a || r.started_at > a.started_at ? r : a), null);
    return {
      patient,
      severity: severityOf(own),
      series: own
        .filter((r) => r.status === 'ready' && r.pct_compensating !== null)
        .sort((a, b) => a.started_at.localeCompare(b.started_at)),
      signature: `${own.length}:${newest?.id ?? ''}:${newest?.status ?? ''}`,
    };
  });
  return entries.sort((a, b) =>
    rankOf(a) - rankOf(b) || (b.severity.pct ?? 0) - (a.severity.pct ?? 0) || a.patient.name.localeCompare(b.patient.name));
}
