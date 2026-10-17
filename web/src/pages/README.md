# pages

App pages and their routes, wired in `src/App.tsx` (react-router, one page at a time with AnimatePresence).

| Route | Page | Task |
|---|---|---|
| `/` | `Landing.tsx`: hero copy, animated lens, webcam permission; on success the lens and wordmark hand their rectangles to the session (FLIP, see `src/landing/`) | F1 |
| `/session` | `Session.tsx`: patient view (video panel, instruction card, arm slot); `?demo=1` uses fake poses | F1, F2 |
| `/doctor` | `Doctor.tsx`: therapist portal (F9, lazy-loaded) | F9 |
| `/setup` | `Setup.tsx`: placeholder until F3 | F3 |
| `/results` | `Results.tsx`: placeholder until F5 | F5 |

Each page owns its enter and exit animation; reduced motion becomes a short cross-fade.
