# physician

Shared helpers and components for the physician portal (F11): patients ranked by how much they compensate.

| File or folder | What it holds |
|---|---|
| `severity.ts` | Severity of a patient from their recordings (`ok` / `watch` / `attention`) and the UI cutoffs `ATTENTION_PCT` and `WATCH_PCT` (hand-picked, not clinically validated) |
| `format.ts` | Text formatters: `initials`, `pct`, `relative`, `stamp`, `duration` |
| `slideIn.ts` | The overview's entrance: `useSlideIn(order)` slides each item in from the right edge of the screen, top to bottom, 60 ms apart |
| `overview/` | The `/physician` page parts: `model.ts` (ranking), `TrendChart.tsx` (SVG line graph), `PatientList.tsx` and `PatientRow.tsx` (pill rows), `Sparkline.tsx`, `States.tsx` (setup, error, empty) |
