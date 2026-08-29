import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { venuesForMatch, defaultSlots } from '@/server/booking/booking';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/** Nearby venues, with any cafe named in the chat pinned first (spec §1). */
export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    return { venues: await venuesForMatch(user.uid, id), suggestedSlots: defaultSlots() };
  });
}
