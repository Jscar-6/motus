# auth

Auth0 sign-in for the physician portal (`/physician`, `/physician/:patientId`). Tenant setup and the post-login Action are in `/auth0`. The patient session never needs Auth0: without keys the provider renders its children bare, and the physician pages show a setup card instead of opening (fail closed).

| File | What |
|---|---|
| `config.ts` | `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` from `web/.env.local`, the callback path, `hasAuth()` |
| `PhysicianAuthProvider.tsx` | `Auth0Provider` inside the router; tokens cached in localStorage with refresh tokens so a reload keeps the session; after login, returns to the page that asked |
| `usePhysicianAuth.ts` | `configured`, `loading`, `signedIn`, `email`, `error`, `signIn(returnTo)`, `signOut()`; safe without keys |
| `RequirePhysician.tsx` | Route gate: setup card (no keys), quiet "Checking sign-in…", sign-in card, or the access-denied message from the Action |
| `SignOutButton.tsx` | Top-right email and Sign out on the physician overview |
