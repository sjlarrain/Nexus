import { adminDb } from '@/server/firebase/admin';
import { requireUser } from '@/server/auth/session';
import { notFound, route } from '@/server/http/respond';
import { toCard } from '@/lib/cards/card';
import { profileSchema } from '@/lib/schemas/profile';
import { gateForStep, statusForStep } from '@/lib/onboarding/gates';
import { refreshReplyRate } from '@/server/users/stats';
import { formatReplyRate } from '@/lib/profile/reply-rate';
import type { UserRecord } from '@/server/users/ensure-user';

export const runtime = 'nodejs';

/**
 * The viewer's own profile, plus the per-step review status the step-5 screen needs
 * (BACKLOG E11.1, spec section 2 step 5).
 */
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const snapshot = await adminDb().collection('users').doc(user.uid).get();
    const data = snapshot.data() as UserRecord | undefined;
    if (!data) throw notFound('No profile yet.');

    const profile = profileSchema.parse(data);

    // Recomputed on read so the number on the profile screen is never stale; the
    // write caches it back for the deck (BACKLOG E11.2).
    const replyRate = await refreshReplyRate(user.uid);

    return {
      uid: user.uid,
      card: toCard(user.uid, profile),
      profile,
      onboarding: data.onboarding,
      stats: { ...data.stats, replyRate: replyRate.rate },
      replyRate: { ...replyRate, label: formatReplyRate(replyRate) },
      steps: [1, 2, 3, 4, 5].map((step) => ({
        step,
        status: statusForStep(step, profile),
        label: gateForStep(step, profile).label,
      })),
    };
  });
}
