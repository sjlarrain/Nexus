import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { emptyProfile, type Profile } from '@/lib/schemas/profile';
import type { AuthedUser } from '@/server/auth/session';

/**
 * Creates the user shell on first sign-in (BACKLOG E2.4).
 *
 * Two documents, deliberately: the public card surface at `users/{uid}`, and anything
 * private at `users/{uid}/private/meta`. Keeping email out of the public document is
 * what lets the security rules say "any published user may read any other" without
 * leaking contact details (docs/architecture.md section 3).
 */

export type UserRecord = Profile & {
  onboarding: { step: number; completed: boolean; publishedAt: number | null };
  stats: { replyRate: number | null; lastActiveAt: number | null };
  createdAt: number;
  updatedAt: number;
};

export type EnsureResult = {
  created: boolean;
  user: UserRecord;
};

export async function ensureUserDocument(auth: AuthedUser): Promise<EnsureResult> {
  const db = adminDb();
  const ref = db.collection('users').doc(auth.uid);
  const now = Date.now();

  const existing = await ref.get();
  if (existing.exists) {
    // Cheap liveness signal; the deck uses it for the recency component.
    await ref.update({ 'stats.lastActiveAt': now });
    return { created: false, user: existing.data() as UserRecord };
  }

  const user: UserRecord = {
    ...emptyProfile(),
    onboarding: { step: 1, completed: false, publishedAt: null },
    stats: { replyRate: null, lastActiveAt: now },
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(ref, user);
  batch.set(ref.collection('private').doc('meta'), {
    email: auth.email,
    emailVerified: auth.emailVerified,
    createdAt: now,
  });
  await batch.commit();

  return { created: true, user };
}

/**
 * Where to send someone after sign-in: back into onboarding at the step they left,
 * or to the deck once published (BACKLOG E2.5).
 */
export function landingRouteFor(user: Pick<UserRecord, 'onboarding'>): string {
  return user.onboarding.completed ? '/deck' : `/onboarding/${user.onboarding.step}`;
}
