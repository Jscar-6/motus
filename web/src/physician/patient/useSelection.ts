// Which recording the physician is looking at: their pick, else the newest playable one, following new arrivals.
import { useEffect, useRef, useState } from 'react';
import type { RecordingRow } from '../../db/types';

export interface Selection {
  selected: RecordingRow | null;
  select: (id: string) => void;
  newIds: ReadonlySet<string>;      // recordings that arrived while the physician was looking at an older one
}

/** Pick logic over a newest-first recording list; a new ready recording is auto-selected only when the newest (or nothing) was being viewed. */
export function useSelection(recordings: RecordingRow[]): Selection {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const latestId = recordings.find((r) => r.status === 'ready' && r.video_path)?.id ?? null;
  const prevLatest = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevLatest.current;
    prevLatest.current = latestId;
    if (!latestId || !prev || prev === latestId) return;
    if (pickedId === null || pickedId === prev) setPickedId(null);
    else setNewIds((s) => new Set(s).add(latestId));
  }, [latestId, pickedId]);

  const selected =
    recordings.find((r) => r.id === pickedId) ?? recordings.find((r) => r.id === latestId) ?? recordings.find((r) => r.status === 'ready') ?? null;

  const select = (id: string) => {
    setPickedId(id);
    setNewIds((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  };

  return { selected, select, newIds };
}
