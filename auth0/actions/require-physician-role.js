// Auth0 post-login Action (Dashboard → Actions → Triggers → post-login). Paste this file in and deploy it; see auth0/README.md.

/** Refuses the login unless the user has the `physician` role, so a new or social account can't reach patient recordings. */
exports.onExecutePostLogin = async (event, api) => {
  const roles = event.authorization?.roles ?? [];
  if (!roles.includes('physician')) {
    api.access.deny('Only invited physicians can open the TrueReach portal. Ask the care team to invite you.');
  }
};
