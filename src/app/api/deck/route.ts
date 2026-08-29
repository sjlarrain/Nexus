import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { loadDeck } from '@/server/deck/load-deck';
import type { DeckFilters } from '@/lib/deck/rank';

export const runtime = 'nodejs';

/** Repeatable query params: ?industry=Software&industry=Fintech */
function listParam(url: URL, key: string): string[] | undefined {
  const values = url.searchParams.getAll(key).filter((v) => v.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

export async function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const url = new URL(request.url);

    const direction = url.searchParams.get('direction');
    const filters: DeckFilters = {
      industries: listParam(url, 'industry'),
      lanes: listParam(url, 'lane'),
      cities: listParam(url, 'city'),
      direction:
        direction === 'refer' || direction === 'looking' || direction === 'both'
          ? direction
          : undefined,
    };

    return loadDeck(user.uid, {
      filters,
      limit: Number(url.searchParams.get('limit')) || 20,
      offset: Number(url.searchParams.get('cursor')) || 0,
    });
  });
}
