// Auth0 for the physician portal. Without keys in web/.env.local it renders its children bare, so the patient session never needs Auth0.
import type { ReactNode } from 'react';
import { Auth0Provider, type AppState } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { AUTH0_CLIENT_ID, AUTH0_DOMAIN, CALLBACK_PATH } from './config';

/** Wraps the app in Auth0Provider when configured; after Universal Login it returns the physician to the page they asked for. */
export default function PhysicianAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) return children;
  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: `${window.location.origin}${CALLBACK_PATH}` }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(state?: AppState) => navigate(state?.returnTo ?? CALLBACK_PATH, { replace: true })}
    >
      {children}
    </Auth0Provider>
  );
}
