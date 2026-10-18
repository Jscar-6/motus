# supabase

Database for F11 recordings: one hosted Supabase project shared by every device that runs the app on its own localhost.

1. Create a free project at supabase.com.
2. Dashboard → SQL → New query: run `schema.sql`, then `seed.sql` (adds the demo patient and badged sample patients).
3. Dashboard → Project Settings → API: copy the Project URL and the anon public key into `web/.env.local`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
4. Restart `npm run dev`. Every device (patient and physician) uses the same two values.

Demo scope: no login and permissive anon policies, so use test patients only. Storage is a public-read bucket capped at 50 MB per file (free tier).
