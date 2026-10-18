// The physician's sign-in state, safe to call whether or not Auth0 is configured.
import { useAuth0 } from '@auth0/auth0-react';
import { CALLBACK_PATH, hasAuth } from './config';

export interface PhysicianAuth {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  email: string | null;
  error: string | null;
  signIn: (returnTo?: string, switchAccount?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Sign-in state and actions; with no Auth0 keys it reports signed out and its actions do nothing. */
export function usePhysicianAuth(): PhysicianAuth {
  const auth = useAuth0();
  const configured = hasAuth();
  return {
    configured,
    loading: configured && auth.isLoading,
    signedIn: configured && auth.isAuthenticated,
    email: auth.user?.email ?? null,
    error: configured ? auth.error?.message ?? null : null,
    signIn: async (returnTo = CALLBACK_PATH, switchAccount = false) => {
      if (!configured) return;
      await auth.loginWithRedirect({ appState: { returnTo }, authorizationParams: switchAccount ? { prompt: 'login' } : undefined });
    },
    signOut: async () => {
      if (!configured) return;
      await auth.logout({ logoutParams: { returnTo: window.location.origin } });
    },
  };
}
