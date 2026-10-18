# auth0

Physician sign-in for the portal (PLAN.md §20, Auth0 entry). The web side lives in `web/src/auth/`; this folder holds the tenant-side code and setup. The patient session never uses Auth0.

| File | What |
|---|---|
| `actions/require-physician-role.js` | Post-login Action: refuses any login without the `physician` role |

## Tenant setup (once)

1. **Application** (Applications → Applications → Create → Single Page Application). In Settings:
   - Allowed Callback URLs: `http://localhost:5173/physician`
   - Allowed Logout URLs and Allowed Web Origins: `http://localhost:5173`
   - Add the same entries for any other origin the app runs on (LAN IP, deployed URL).
   - Refresh Token Rotation: on (keeps the physician signed in across reloads without third-party cookies).
2. **Keys:** copy Domain and Client ID into `web/.env.local` as `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID`. They are public identifiers, not secrets. Restart `npm run dev`.
3. **Invite only:** Authentication → Database → Username-Password-Authentication → turn on "Disable Sign Ups". Create each physician under User Management → Users.
4. **Role:** User Management → Roles → create `physician` and assign it to each physician.
5. **Action:** Actions → Triggers → post-login → Add Action → Create custom action, paste `actions/require-physician-role.js`, Deploy, then drag it into the flow and Apply. Social logins (Google) create accounts even with sign-ups disabled; this Action is what keeps them out.
6. **Optional, no code:** Security → Multi-factor Auth (e.g. one-time password); Authentication → Social (Google); Authentication → Passwordless (email code).

## Limits

This gates the physician pages in the browser. Supabase still accepts the anon key (`supabase/schema.sql`), so locking the data itself (Supabase third-party auth with Auth0 tokens) is a separate, later step.
