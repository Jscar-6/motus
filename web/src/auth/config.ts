// Auth0 tenant settings for the physician portal, read from web/.env.local. Both are public identifiers, not secrets.
export const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
export const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;

/** Where Universal Login sends the physician back; must be listed in the Auth0 app's Allowed Callback URLs. */
export const CALLBACK_PATH = '/physician';

/** Whether this device has Auth0 keys; without them the physician pages stay locked. */
export function hasAuth(): boolean {
  return Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);
}
