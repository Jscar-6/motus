// F11 data access: patient and recording rows, recording uploads, and timeline downloads.
import type { Mode } from '../lib/types';
import { BUCKET, publicUrl, supabase } from './supabase';
import type { PatientRow, RecordingRow, RecordingTimeline } from './types';

/** The client, or an error explaining how to configure it. */
function db() {
  if (!supabase) throw new Error('Database not configured: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to web/.env.local');
  return supabase;
}

/** All patients, oldest first. */
export async function listPatients(): Promise<PatientRow[]> {
  const { data, error } = await db().from('patients').select('*').order('created_at');
  if (error) throw error;
  return data as PatientRow[];
}

/** Recordings for one patient, or for everyone when patientId is omitted; newest first. */
export async function listRecordings(patientId?: string): Promise<RecordingRow[]> {
  let query = db().from('recordings').select('*').order('started_at', { ascending: false });
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query;
  if (error) throw error;
  return data as RecordingRow[];
}

/** Insert a row with status 'recording' the moment recording starts, so the physician sees it live. */
export async function createRecording(patientId: string, mode: Mode): Promise<RecordingRow> {
  const { data, error } = await db()
    .from('recordings')
    .insert({ patient_id: patientId, mode, status: 'recording' })
    .select()
    .single();
  if (error) throw error;
  return data as RecordingRow;
}

/** Patch a recording row (status, paths, stats). */
export async function updateRecording(id: string, patch: Partial<RecordingRow>): Promise<void> {
  const { error } = await db().from('recordings').update(patch).eq('id', id);
  if (error) throw error;
}

/** Upload one file into the recordings bucket and return its path. */
export async function uploadFile(path: string, body: Blob, contentType: string): Promise<string> {
  const { error } = await db().storage.from(BUCKET).upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return path;
}

/** Storage paths for one recording's files. */
export function recordingPaths(rec: Pick<RecordingRow, 'id' | 'patient_id'>, videoExt: string) {
  const base = `${rec.patient_id}/${rec.id}`;
  return { video: `${base}/video.${videoExt}`, timeline: `${base}/timeline.json`, thumb: `${base}/thumb.jpg` };
}

/** Download and parse a recording's timeline. */
export async function fetchTimeline(rec: RecordingRow): Promise<RecordingTimeline | null> {
  const url = publicUrl(rec.timeline_path);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Timeline download failed (${res.status})`);
  return (await res.json()) as RecordingTimeline;
}
