import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { loadThread } from '@/server/chat/messages';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/** The thread plus the suggested replies for its current state (spec §1). */
export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    return loadThread(user.uid, id);
  });
}
