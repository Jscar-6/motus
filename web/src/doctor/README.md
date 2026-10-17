# doctor

The therapist portal (F9), mounted at `/doctor` by `pages/Doctor.tsx`. It mirrors the patient's live session and makes the AI's per-frame math visible. Everything reads `live/store.ts` (`useLive`, `useThrottledSample`, `getHistory`); nothing here touches `lib/config.ts` thresholds except to display them.

| File | What it does |
|---|---|
| `DoctorLayout.tsx` | Desktop grid (≥1024 px) with slide-out side panels and the focus view; stacked layout below that |
| `VideoStage.tsx` | The video panel; springs between its grid cell and the ~90% focus rect |
| `LiveView.tsx`, `skeleton.ts`, `canvasKit.ts` | One canvas: video or demo backdrop, skeleton coloured by rule level, lean and elbow arcs, flag pills |
| `LiveMathPanel.tsx`, `MetricTile.tsx`, `Sparkline.tsx`, `metrics.ts` | Right-hand panel: metric tiles with formula, threshold track, 8 s sparkline and hold timer |
| `FlagLog.tsx`, `LandmarksTable.tsx`, `NearFarToggle.tsx` | Flag log, raw landmarks, near/far control |
| `AdjustmentsCard.tsx` | Therapist-phrased live guidance and the `ArmSlot` for the 3D arm |
| `VideoChips.tsx`, `Materialize.tsx`, `useMedia.ts` | Video chips, entrance wrapper, media query hook |
| `coach/` | Gemini coach and mic (F10, separate owner) |

Rules of the road: values that change every frame are drawn on canvas in a `requestAnimationFrame` loop or shown through `useThrottledSample`; bars use `transform: scaleX()`; focus mode animates the video's real size so the canvas never stretches mid-flight.
