// Supabase client for F11. Null when web/.env.local has no keys, so the camera-only session still runs without a database.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const BUCKET = 'recordings';

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

/** Whether the database is configured on this device. */
export function hasDatabase(): boolean {
  return supabase !== null;
}

/** Public URL of a file in the recordings bucket, or null without a database or path. */
export function publicUrl(path: string | null): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
