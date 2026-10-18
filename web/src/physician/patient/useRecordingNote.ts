// One short coach note per recording, asked of Gemini (template fallback) from the recording's own stored numbers and cached.
import { useEffect, useState } from 'react';
import { fetchCoachNote } from '../../doctor/coach/coachApi';
import { buildCoachContext, type CoachContext } from '../../doctor/coach/context';
import type { RecordingRow } from '../../db/types';

const cache = new Map<string, string>();

/** Coach context for a whole recording: the stored peaks and flag counts over the live store's thresholds and settings. */
function recordingContext(rec: RecordingRow): CoachContext {
  return {
    ...buildCoachContext(),
    windowSec: Math.round((rec.duration_ms ?? 0) / 1000),
    sampleCount: rec.frame_count ?? 0,
    maxLean: rec.peaks.maxLeanDeg ?? null,
    meanLean: null,
    maxHike: rec.peaks.maxHikeRatio ?? null,
    minElbow: rec.peaks.minElbowDeg ?? null,
    maxShoulderFlex: rec.peaks.maxShoulderFlexDeg ?? null,
    minVis: null,
    flags: [],
    windowFlagCounts: rec.flag_counts,
    sessionFlagCounts: rec.flag_counts,
  };
}

/** The coach's note about the selected recording, or null while loading or when the recording has no frames. */
export function useRecordingNote(rec: RecordingRow | null): string | null {
  const id = rec?.status === 'ready' && rec.frame_count ? rec.id : null;
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (!id || !rec || cache.has(id)) return undefined;
    let live = true;
    void fetchCoachNote(recordingContext(rec)).then((n) => {
      cache.set(id, n.text);
      if (live) setNote({ id, text: n.text });
    });
    return () => {
      live = false;
    };
  }, [id, rec]);

  if (!id) return null;
  return cache.get(id) ?? (note?.id === id ? note.text : null);
}
