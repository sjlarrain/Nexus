import { adminDb } from '@/server/firebase/admin';
import { requireUser } from '@/server/auth/session';
import { notFound, route } from '@/server/http/respond';
import { toCard } from '@/lib/cards/card';
import { profileSchema } from '@/lib/schemas/profile';
import { gateForStep, statusForStep } from '@/lib/onboarding/gates';
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

    return {
      uid: user.uid,
      card: toCard(user.uid, profile),
      profile,
      onboarding: data.onboarding,
      stats: data.stats,
      steps: [1, 2, 3, 4, 5].map((step) => ({
        step,
        status: statusForStep(step, profile),
        label: gateForStep(step, profile).label,
      })),
    };
  });
}
