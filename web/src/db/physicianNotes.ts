// Physician-to-patient notes over Supabase Realtime broadcast: the physician's confirmed voice instruction and Gemini's reply reach the patient's screen live.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const EVENT = 'note';

/** One note as the patient sees it; `reply` stays null until Gemini (or the template) answers. */
export interface PhysicianNote {
  id: string;
  instruction: string;
  reply: string | null;
  sentAt: string;             // ISO
}

/** Broadcast channel name for one patient. */
function topic(patientId: string): string {
  return `physician-notes-${patientId}`;
}

/** Send (or update, same id) a note to one patient's screen; a no-op without a database. Never throws. */
export async function sendPhysicianNote(patientId: string, note: PhysicianNote): Promise<void> {
  if (!supabase || !patientId) return;
  const channel = supabase.channel(topic(patientId));
  try {
    await channel.httpSend(EVENT, note);
  } catch {
    // Best effort: the physician's own flow carries on when the broadcast fails.
  } finally {
    void supabase.removeChannel(channel);
  }
}

/** The latest note sent to this patient while this screen is open, or null; updates live. */
export function usePhysicianNote(patientId: string | null): PhysicianNote | null {
  const [note, setNote] = useState<PhysicianNote | null>(null);

  useEffect(() => {
    const client = supabase;
    setNote(null);
    if (!client || !patientId) return undefined;
    const channel = client
      .channel(topic(patientId))
      .on('broadcast', { event: EVENT }, ({ payload }) => setNote(payload as PhysicianNote))
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [patientId]);

  return note;
}
