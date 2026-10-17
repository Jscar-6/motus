// Downloads a recording's timeline JSON once per recording and keeps it for later selections.
import { useEffect, useState } from 'react';
import { fetchTimeline } from '../db/api';
import type { RecordingRow, RecordingTimeline } from '../db/types';

const cache = new Map<string, RecordingTimeline>();

/** The timeline of a ready recording, or null while loading, when it has none, or when the download failed. */
export function useTimeline(recording: RecordingRow | null): RecordingTimeline | null {
  const id = recording?.status === 'ready' && recording.timeline_path ? recording.id : null;
  const [loaded, setLoaded] = useState<{ id: string; timeline: RecordingTimeline } | null>(null);

  useEffect(() => {
    if (!id || !recording || cache.has(id)) return undefined;
    let live = true;
    fetchTimeline(recording)
      .then((timeline) => {
        if (!timeline) return;
        cache.set(id, timeline);
        if (live) setLoaded({ id, timeline });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id, recording]);

  if (!id) return null;
  return cache.get(id) ?? (loaded?.id === id ? loaded.timeline : null);
}
