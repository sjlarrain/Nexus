import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { badRequest, readJson, route } from '@/server/http/respond';
import { acceptBooking, cancelBooking, loadBooking, waitingOn } from '@/server/booking/booking';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(['accept', 'cancel']),
  /** Required when accepting: which of the proposed times was chosen. */
  startsAt: z.number().int().positive().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const booking = await loadBooking(user.uid, id);
    return { booking, waitingOn: waitingOn(booking, user.uid) };
  });
}

export async function POST(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { action, startsAt } = await readJson(request, bodySchema);

    if (action === 'cancel') {
      await cancelBooking(user.uid, id);
      return { status: 'cancelled' };
    }

    if (startsAt === undefined) throw badRequest('Pick one of the proposed times.');
    return acceptBooking(user.uid, id, startsAt);
  });
}
