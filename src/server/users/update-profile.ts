import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { profilePatchSchema, profileSchema, type ProfilePatch } from '@/lib/schemas/profile';
import { canPublish, gateForStep } from '@/lib/onboarding/gates';
import { badRequest, forbidden, notFound } from '@/server/http/respond';
import { ensureDemoMatches } from '@/server/users/demo-matches';
import type { UserRecord } from '@/server/users/ensure-user';

/**
 * Profile writes (BACKLOG E3.4, E3.5, E3.6).
 *
 * Every write goes through `profilePatchSchema`, which is a non-strict Zod object —
 * so the add-form drafts the spec lists (`schoolDraft`, `referDraft`, `targetDraft`,
 * `interestDraft`, …) are dropped rather than persisted. That is E3.3, enforced by
 * the schema instead of by a field list someone has to remember to update.
 */

async function loadUser(uid: string): Promise<UserRecord> {
  const snapshot = await adminDb().collection('users').doc(uid).get();
  const data = snapshot.data() as UserRecord | undefined;
  if (!data) throw notFound('No profile yet.');
  return data;
}

export type PatchResult = {
  profile: ReturnType<typeof profileSchema.parse>;
  onboarding: UserRecord['onboarding'];
  gate: ReturnType<typeof gateForStep>;
};

/**
 * Applies a partial update. Idempotent: sending the same patch twice leaves the
 * document identical, because nothing here appends or increments.
 */
export async function patchProfile(
  uid: string,
  patch: ProfilePatch,
  step?: number,
): Promise<PatchResult> {
  const clean = profilePatchSchema.parse(patch);
  if (Object.keys(clean).length === 0 && step === undefined) {
    throw badRequest('Nothing to update.');
  }

  const current = await loadUser(uid);
  if (current.onboarding.completed && step !== undefined) {
    // Published users edit their profile; they do not walk back through onboarding.
    throw forbidden('Onboarding is already complete.');
  }

  const merged = profileSchema.parse({ ...current, ...clean });

  const onboarding: UserRecord['onboarding'] = {
    ...current.onboarding,
    // "Save & exit" persists progress on every step transition (spec section 2).
    step: step ?? current.onboarding.step,
  };

  await adminDb()
    .collection('users')
    .doc(uid)
    .update({ ...clean, onboarding, updatedAt: Date.now() });

  return {
    profile: merged,
    onboarding,
    gate: gateForStep(onboarding.step, merged),
  };
}

/**
 * Publishing is the moment a user becomes visible in other people's decks, so it
 * re-validates the whole profile rather than trusting the per-step gates that ran
 * on the way in.
 */
export async function publishProfile(uid: string): Promise<{ publishedAt: number }> {
  const current = await loadUser(uid);
  const profile = profileSchema.parse(current);

  const gate = canPublish(profile);
  if (!gate.ok) throw badRequest(gate.label);

  const publishedAt = Date.now();
  await adminDb()
    .collection('users')
    .doc(uid)
    .update({
      onboarding: { step: 5, completed: true, publishedAt },
      updatedAt: publishedAt,
    });

  // A published card with an empty chat list is untestable. Seeding the matches here
  // rather than in the route keeps it on every path that publishes.
  await ensureDemoMatches(uid);

  return { publishedAt };
}
