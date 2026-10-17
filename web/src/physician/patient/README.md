# physician/patient

Components of the physician's patient overview (`/physician/:patientId`, F11, Figma 5:13). The page is `src/pages/PatientOverview.tsx`; recordings come live from `src/db`, and the selected one is replayed through `src/replay`.

| File | Role |
| --- | --- |
| `OverviewLayout.tsx` | Desktop grid with slide-out cards and the focus view (reuses `doctor/VideoStage`), or a stacked layout below 1024 px |
| `RecordingPlayer.tsx` | `PlayerSurface` (video, state messages) and `PlayerOverlay` (date chip, glass controls, flag ticks) |
| `PastExercisesCard.tsx` | Bottom-middle card: thumbnail strip, or the voice transcript while dictating |
| `RecordingStrip.tsx`, `HScrollbar.tsx` | Newest-first tiles and a custom scrollbar shown only when they overflow |
| `TranscriptPanel.tsx` | Live transcript, editable box, Gemini reply typed out, check marks |
| `MicPanel.tsx` | Mic button and buzz sensitivity |
| `SessionDataCard.tsx` | Time compensating, flags, peaks, length and mode for the selected recording |
| `useSelection.ts` | Selected recording, auto-follow of new arrivals, "New" markers |
| `useVoiceNote.ts` | Voice flow: listen, edit, send to Gemini, reply, finish |
| `useRecordingNote.ts` | One cached coach note per recording, built from its stored peaks and flag counts |
| `useTypewriter.ts` | Character-by-character reveal (instant under reduced motion) |

The arm card uses `ArmViewer replay`, which follows the pose in the live store. Playback writes the recording's samples to that store, so the arm, alert tint and coach context stay in sync with the video.
