// How much a patient is compensating, from their recent recordings; drives row colour and list order.
import type { RecordingRow } from '../db/types';

/** Share of time compensating at or above which a patient is highlighted. UI cutoff, hand-picked; not clinically validated. */
export const ATTENTION_PCT = 0.25;
/** Share of time compensating at or above which a patient is "watch" rather than "ok". UI cutoff, hand-picked; not clinically validated. */
export const WATCH_PCT = 0.12;
/** How many of the newest finished recordings the score averages. */
export const RECENT_COUNT = 3;

export type SeverityLevel = 'none' | 'ok' | 'watch' | 'attention';

export interface Severity {
  level: SeverityLevel;
  pct: number | null;           // mean pct_compensating over the recent recordings, 0–1
  recordings: number;           // finished recordings in total, with or without analysis
  lastAt: string | null;        // started_at of the newest recording of any status
  recordingNow: boolean;        // a recording with status 'recording' or 'uploading' exists
}

/** Level for a share of time compensating. */
export function levelOf(pct: number | null): SeverityLevel {
  if (pct === null) return 'none';
  if (pct >= ATTENTION_PCT) return 'attention';
  if (pct >= WATCH_PCT) return 'watch';
  return 'ok';
}

/** Severity of one patient from their recordings (any order). */
export function severityOf(recordings: RecordingRow[]): Severity {
  const sorted = recordings.slice().sort((a, b) => b.started_at.localeCompare(a.started_at));
  const ready = sorted.filter((r) => r.status === 'ready');
  const recent = ready.filter((r) => r.pct_compensating !== null).slice(0, RECENT_COUNT);
  const pct = recent.length ? recent.reduce((sum, r) => sum + (r.pct_compensating ?? 0), 0) / recent.length : null;
  return {
    level: levelOf(pct),
    pct,
    recordings: ready.length,
    lastAt: sorted[0]?.started_at ?? null,
    recordingNow: sorted.some((r) => r.status === 'recording' || r.status === 'uploading'),
  };
}

/** Group recordings by patient id. */
export function byPatient(recordings: RecordingRow[]): Map<string, RecordingRow[]> {
  const map = new Map<string, RecordingRow[]>();
  for (const r of recordings) {
    const list = map.get(r.patient_id);
    if (list) list.push(r);
    else map.set(r.patient_id, [r]);
  }
  return map;
}
