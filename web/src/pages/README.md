# pages

App pages and their routes, wired in `src/App.tsx` (react-router, one page at a time with AnimatePresence).

| Route | Page | Task |
|---|---|---|
| `/` | `Landing.tsx`: hero copy, animated lens, webcam permission; on success the lens and wordmark hand their rectangles to the session (FLIP, see `src/landing/`); top-right Physician login opens `/physician` the same way; active-patient line | F1, F11 |
| `/session` | `Session.tsx`: patient view (left column of wordmark, instruction card and arm beside the video panel, which holds the Record control); `?demo=1` uses fake poses | F1, F2, F11 |
| `/doctor` | `Doctor.tsx`: therapist portal (F9, lazy-loaded) | F9 |
| `/physician` | `Physician.tsx`: physician overview, patients ranked by time compensating with a trend graph (reads Supabase live) | F11 |
| `/physician/:patientId` | `PatientOverview.tsx`: recording playback with focus view, arm replay, session data, past recordings, voice instructions (lazy-loaded) | F11 |
| `/setup` | `Setup.tsx`: placeholder until F3 | F3 |
| `/results` | `Results.tsx`: placeholder until F5 | F5 |

Each page owns its enter and exit animation; reduced motion becomes a short cross-fade.
