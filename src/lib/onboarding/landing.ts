import { canPublish, gateForStep } from '@/lib/onboarding/gates';
import { profileSchema } from '@/lib/schemas/profile';

/**
 * Where a signed-in user belongs (BACKLOG E2.5).
 *
 * Pure and framework-free so it can be unit tested: both callers — the sign-in route
 * handler and the `/` redirect — are server code, and this is the rule they share.
 */

export type LandingInput = {
  onboarding: { step: number; completed: boolean };
  [key: string]: unknown;
};

const ONBOARDING_STEPS = [1, 2, 3, 4] as const;

/**
 * `onboarding.completed` is not enough on its own. A profile published under an
 * earlier version of the gates can stop satisfying the current ones — that is exactly
 * what happened when step 4 became mandatory — and trusting the flag alone drops
 * those users on the deck holding a card that can no longer be published, with no
 * route back to fix it. So the gates are re-run and the first failing step wins.
 */
export function landingRouteFor(user: LandingInput): string {
  const parsed = profileSchema.safeParse(user);
  // Unparseable is a data problem, not a user problem; onboarding rebuilds it.
  if (!parsed.success) return '/onboarding/1';

  if (!user.onboarding.completed) return `/onboarding/${user.onboarding.step}`;
  if (canPublish(parsed.data).ok) return '/deck';

  const step = ONBOARDING_STEPS.find((entry) => !gateForStep(entry, parsed.data).ok) ?? 1;
  return `/onboarding/${step}`;
}
