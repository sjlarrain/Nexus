import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { adminDb } from '@/server/firebase/admin';
import { currentUser } from '@/server/auth/session';
import { landingRouteFor, type UserRecord } from '@/server/users/ensure-user';

/**
 * The front door (BACKLOG E2.5).
 *
 * There is no landing page to show: everyone who arrives is either signed out, part
 * way through onboarding, or ready for the deck. So this route decides and forwards,
 * server-side, before anything renders — no flash of the wrong screen.
 */

// Depends on the session cookie, so it can never be prerendered.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect('/signin');

  const snapshot = await adminDb().collection('users').doc(user.uid).get();
  const record = snapshot.data() as UserRecord | undefined;

  // Signed in with no document yet: the shell is created on first sign-in, so this
  // means an interrupted first visit. Onboarding from the top is the right recovery.
  if (!record) redirect('/onboarding/1');

  redirect(landingRouteFor(record) as Route);
}
