# recording

Records the patient's webcam and uploads it to Supabase for the physician pages (F11).

- `recorder.ts`: `startRecording()` runs a `MediaRecorder` on the camera stream and captures a replay timeline (live samples, flags, sleeve frames, all in ms since start). `handle.stop()` packages the video, timeline and a JPEG thumbnail with summary stats; `uploadRecording()` uploads the three files in parallel and flips the row to `ready` (or `failed`). Recordings auto-stop at 4 minutes to stay under the 50 MB per-file cap.
- `useRecorder.ts`: React hook with the state `idle | starting | recording | uploading | sent | error`, the elapsed clock, and why recording is unavailable (no database, no patient, no camera). Leaving the page stops and still uploads.
- `RecordButton.tsx`: the glass Record / Stop / Uploading / Sent pill in the video panel.
