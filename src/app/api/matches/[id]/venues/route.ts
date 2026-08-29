import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { venuesForMatch, defaultSlots, bookingForMatch, waitingOn } from '@/server/booking/booking';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/**
 * Nearby venues, with any cafe named in the chat pinned first (spec §1), plus the
 * match's current booking so the screen knows whether to propose or to accept.
 */
export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;

    const [venues, existing] = await Promise.all([
      venuesForMatch(user.uid, id),
      bookingForMatch(user.uid, id),
    ]);

    return {
      venues,
      suggestedSlots: defaultSlots(),
      booking: existing ? { id: existing.id, ...existing.booking } : null,
      waitingOn: existing ? waitingOn(existing.booking, user.uid) : null,
    };
  });
}
