import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { readJson, route } from '@/server/http/respond';
import { recordSwipe } from '@/server/swipes/record-swipe';
import { swipeActionSchema } from '@/lib/schemas/entities';

export const runtime = 'nodejs';

const bodySchema = z.object({
  targetUid: z.string().min(1),
  /** right = yes, left = no, up = priority ask (spec §1). */
  action: swipeActionSchema,
});

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const { targetUid, action } = await readJson(request, bodySchema);
    return recordSwipe(user.uid, targetUid, action);
  });
}
