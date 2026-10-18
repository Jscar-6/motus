# doctor/coach

F10 Gemini live coach and voice buzz control for the therapist portal. `CoachPanel` (wide card) and `MicCard` (square card) are default exports that read their own state; the portal only places them.

- `context.ts` builds a `CoachContext` from the last ~8 s of `getHistory()` and the live store: max and mean trunk lean (absolute value), max hike, min elbow, max shoulder flexion, min visibility, current and counted flags, near/far, source, buzz level, and the `FORWARD_REACH` thresholds with a note on their source (D3 TRSP fit; `visMin` placeholder until E4). Only measured numbers.
- `coachApi.ts` calls `POST /coach` and `POST /coach/voice` (PLAN.md §16, `VITE_API_URL`, default `http://localhost:8000`) with a 6 s timeout; any failure falls back to `templateCoach.ts`.
- `templateCoach.ts` writes deterministic notes and parses spoken "lower / stronger / normal" from the same numbers (badge says "Template").
- `useCoach.ts` requests a note every 8 s and 1.5 s after a new flag.
- `speech.ts` wraps the browser Web Speech API (Chrome); `MicCard` is disabled elsewhere.
- Buzz sensitivity only changes the runtime setting via `setBuzz`; it never touches `config.ts` thresholds. The sleeve's buzz controller (`sleeve/sleeveSession`, S3) reads it to pick the motor pattern.
