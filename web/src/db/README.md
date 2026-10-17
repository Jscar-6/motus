# db

Supabase access for F11 (schema in `/supabase`). `supabase.ts` is null without keys, so camera-only sessions still run.

| File | What |
|---|---|
| `supabase.ts` | client, bucket name, public file URLs |
| `types.ts` | `PatientRow`, `RecordingRow`, `RecordingTimeline` |
| `api.ts` | list, create and update rows; upload files; fetch a timeline |
| `hooks.ts` | `usePatients`, `useRecordings`: load once, then stay current via Realtime |
| `activePatient.ts` | which patient this device records for (remembered per device) |
