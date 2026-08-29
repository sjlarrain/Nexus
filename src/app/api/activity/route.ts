import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { loadActivity } from '@/server/users/activity';

export const runtime = 'nodejs';

/** What happened while you were away (BACKLOG E11.4). */
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    return loadActivity(user.uid);
  });
}
