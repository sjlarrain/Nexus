import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { listMatches } from '@/server/chat/messages';

export const runtime = 'nodejs';

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return { matches: await listMatches(user.uid) };
  });
}
