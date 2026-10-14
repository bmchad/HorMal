import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth';
import 'aws-amplify/auth/enable-oauth-listener';

const env = import.meta.env;

export const IS_MOCK = env.MODE === 'mock';
const userPoolId = env.VITE_COGNITO_USER_POOL_ID;
const clientId = env.VITE_COGNITO_CLIENT_ID || env.VITE_COGNITO_APP_CLIENT_ID;
const domain = env.VITE_COGNITO_DOMAIN || env.VITE_COGNITO_AUTH_DOMAIN;

export const AUTH_CONFIGURED = Boolean(userPoolId && clientId && domain);

if (AUTH_CONFIGURED && !IS_MOCK) {
  const origin = window.location.origin + '/';
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        loginWith: {
          oauth: {
            domain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [origin],
            redirectSignOut: [origin],
            responseType: 'code', // OAuth2 authorization code + PKCE
            providers: ['Google'],
          },
        },
      },
    },
  });
}

/** Returns true if there is a signed-in Google/Cognito session. */
export async function hasSession(): Promise<boolean> {
  if (IS_MOCK) return true;
  if (!AUTH_CONFIGURED) return false;
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

export async function getIdToken(): Promise<string | undefined> {
  if (IS_MOCK) return 'mock';
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export const loginWithGoogle = () => signInWithRedirect({ provider: 'Google' });
export const logout = () => (IS_MOCK ? Promise.resolve() : signOut());
