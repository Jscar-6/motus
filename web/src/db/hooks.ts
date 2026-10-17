// React hooks over F11 tables that stay current through Supabase Realtime (inserts, updates, deletes).
import { useEffect, useRef, useState } from 'react';
import { listPatients, listRecordings } from './api';
import { supabase } from './supabase';
import type { PatientRow, RecordingRow } from './types';

export interface Live<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  configured: boolean;       // false when web/.env.local has no Supabase keys
}

type Row = { id: string };

/** Apply one Realtime change to a list of rows. */
function applyChange<T extends Row>(rows: T[], event: string, next: T | null, old: Partial<T> | null): T[] {
  if (event === 'DELETE') return rows.filter((r) => r.id !== old?.id);
  if (!next) return rows;
  const i = rows.findIndex((r) => r.id === next.id);
  if (i === -1) return [next, ...rows];
  const copy = rows.slice();
  copy[i] = next;
  return copy;
}

/** Load a table once, then keep it current with a Realtime subscription; `filter` is a PostgREST filter like `patient_id=eq.<id>`. */
function useLiveTable<T extends Row>(table: string, load: () => Promise<T[]>, filter?: string, sort?: (a: T, b: T) => number): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: [], loading: supabase !== null, error: null, configured: supabase !== null });
  const loadRef = useRef(load);
  const sortRef = useRef(sort);
  loadRef.current = load;
  sortRef.current = sort;

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    loadRef.current()
      .then((data) => live && setState({ data, loading: false, error: null, configured: true }))
      .catch((e: Error) => live && setState({ data: [], loading: false, error: e.message, configured: true }));

    const channel = client
      .channel(`live-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => {
        if (!live) return;
        setState((s) => {
          const rows = applyChange(s.data, payload.eventType, (payload.new as T) ?? null, (payload.old as Partial<T>) ?? null);
          const order = sortRef.current;
          return { ...s, data: order ? rows.slice().sort(order) : rows };
        });
      })
      .subscribe();

    return () => {
      live = false;
      void client.removeChannel(channel);
    };
  }, [table, filter]);

  return state;
}

const byStartedDesc = (a: RecordingRow, b: RecordingRow) => b.started_at.localeCompare(a.started_at);
const byCreated = (a: PatientRow, b: PatientRow) => a.created_at.localeCompare(b.created_at);

/** All patients, live. */
export function usePatients(): Live<PatientRow> {
  return useLiveTable('patients', listPatients, undefined, byCreated);
}

/** Recordings (newest first) for one patient, or everyone when patientId is omitted; live. */
export function useRecordings(patientId?: string): Live<RecordingRow> {
  return useLiveTable('recordings', () => listRecordings(patientId), patientId ? `patient_id=eq.${patientId}` : undefined, byStartedDesc);
}
