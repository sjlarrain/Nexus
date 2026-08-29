import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { publishProfile } from '@/server/users/update-profile';

export const runtime = 'nodejs';

/** Full-profile validation, then the user becomes visible in decks (BACKLOG E3.6). */
export async function POST() {
  return route(async () => {
    const user = await requireUser();
    return publishProfile(user.uid);
  });
}
