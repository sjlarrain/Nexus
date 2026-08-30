import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createSession,
  currentUser,
  requireUser,
  revokeSessions,
  sessionCookieOptions,
  verifySession,
} from '@/server/auth/session';
import { ensureUserDocument, landingRouteFor } from '@/server/users/ensure-user';
import { ensureDemoMatches } from '@/server/users/demo-matches';
import { badRequest, readJson, route } from '@/server/http/respond';

export const runtime = 'nodejs';

const bodySchema = z.object({ idToken: z.string().min(20, 'idToken is missing') });

/**
 * Sign in: trade a Firebase ID token for an httpOnly session cookie, and make sure
 * the user has a profile document (BACKLOG E2.2, E2.4).
 */
export async function POST(request: Request) {
  return route(async () => {
    const { idToken } = await readJson(request, bodySchema);

    const { value, maxAge } = await createSession(idToken);
    const user = await verifySession(value);
    if (!user) throw badRequest('That sign-in could not be verified.');

    const { created, user: record } = await ensureUserDocument(user);

    // Catches accounts published before auto-matching existed. It is once-per-user
    // and must never be the reason a sign-in fails, hence the swallow.
    if (record.onboarding.completed) {
      try {
        await ensureDemoMatches(user.uid);
      } catch (error) {
        console.error('[session] demo matches', error);
      }
    }

    (await cookies()).set(SESSION_COOKIE, value, sessionCookieOptions(maxAge));

    return { uid: user.uid, isNewUser: created, next: landingRouteFor(record) };
  });
}

/** Who am I? Used by the client to decide what to render before hydration. */
export async function GET() {
  return route(async () => {
    const user = await currentUser();
    return user ? { signedIn: true, uid: user.uid } : { signedIn: false };
  });
}

/**
 * Sign out. Revokes refresh tokens too, so the session is dead on every device
 * rather than only in this browser.
 */
export async function DELETE() {
  return route(async () => {
    const user = await requireUser();
    await revokeSessions(user.uid);
    (await cookies()).delete(SESSION_COOKIE);
    return { ok: true };
  });
}
