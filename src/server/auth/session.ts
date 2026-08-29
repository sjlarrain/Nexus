import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from '@/server/firebase/admin';

/**
 * Session handling (BACKLOG E2.2, E2.3).
 *
 * The browser signs in with the Firebase JS SDK and gets an ID token that expires in
 * an hour. We trade it once for a Firebase *session cookie*, which is httpOnly — so
 * page loads and route handlers are authenticated server-side without shipping a
 * token to JavaScript, and a stolen ID token has a short blast radius.
 */

export const SESSION_COOKIE = 'warm_intro_session';

/** Five days. Firebase caps session cookies at two weeks. */
const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type AuthedUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export async function createSession(idToken: string): Promise<{ value: string; maxAge: number }> {
  const value = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  return { value, maxAge: SESSION_MAX_AGE_MS / 1000 };
}

/**
 * `checkRevoked` costs a lookup but means signing out on one device, or disabling an
 * account, takes effect immediately rather than up to five days later.
 */
export async function verifySession(cookie: string): Promise<AuthedUser | null> {
  try {
    const claims = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true,
    };
  } catch {
    return null;
  }
}

/** The signed-in user, or null. Use in pages and handlers that tolerate anonymity. */
export async function currentUser(): Promise<AuthedUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return cookie ? verifySession(cookie) : null;
}

/**
 * The signed-in user, or throw. Route handlers catch this via `handleAuthError` and
 * turn it into a 401 — so a handler body can assume it has a user.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in.');
    this.name = 'UnauthorizedError';
  }
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Invalidates every session for a user, on every device. */
export async function revokeSessions(uid: string): Promise<void> {
  await adminAuth().revokeRefreshTokens(uid);
}

export const sessionCookieOptions = (maxAge: number) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }) as const;
