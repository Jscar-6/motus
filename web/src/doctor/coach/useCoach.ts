// Polls the coach: every 8 s, and 1.5 s after any new flag. Mounted once, by CoachPanel.
import { useEffect } from 'react';
import { useLive } from '../../live/store';
import { fetchCoachNote } from './coachApi';
import { buildCoachContext } from './context';
import { useCoachStore } from './coachStore';

const INTERVAL_MS = 8000;
const FLAG_DEBOUNCE_MS = 1500;

/** Request coach notes while mounted and push them to the coach store. */
export function useCoach(): void {
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let debounce: number | undefined;

    const request = async () => {
      if (inFlight) return;
      inFlight = true;
      const store = useCoachStore.getState();
      store.beginPending();
      try {
        const note = await fetchCoachNote(buildCoachContext());
        const lastCoach = [...useCoachStore.getState().messages].reverse().find((m) => m.role === 'coach');
        if (alive && !(note.source === 'template' && lastCoach?.text === note.text)) {
          useCoachStore.getState().push('coach', note.text, note.source);
        }
      } finally {
        inFlight = false;
        useCoachStore.getState().endPending();
      }
    };

    const interval = window.setInterval(request, INTERVAL_MS);
    const unsubscribe = useLive.subscribe((state, prev) => {
      if (state.flags[0] && state.flags[0].id !== prev.flags[0]?.id) {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(request, FLAG_DEBOUNCE_MS);
      }
    });
    void request();

    return () => {
      alive = false;
      window.clearInterval(interval);
      window.clearTimeout(debounce);
      unsubscribe();
    };
  }, []);
}
