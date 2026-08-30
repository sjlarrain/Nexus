import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { readJson, route } from '@/server/http/respond';
import { createBooking } from '@/server/booking/booking';
import { BOOKING_MODES } from '@/lib/schemas/entities';

export const runtime = 'nodejs';

const bodySchema = z.object({
  matchId: z.string().min(1),
  mode: z.enum(BOOKING_MODES),
  /** Required for `in_person`; a video call has no venue. */
  venueId: z.string().min(1).nullable(),
  /** One or two 30-minute options (spec §1: "two time slots"). */
  slots: z.array(z.number().int().positive()).min(1).max(2),
  /** In person: book the single slot outright rather than propose it. */
  hold: z.boolean().default(false),
});

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readJson(request, bodySchema);
    return createBooking(user.uid, body);
  });
}
