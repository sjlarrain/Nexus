import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { profileSchema } from '@/lib/schemas/profile';
import { rankDeck, type Candidate, type DeckFilters } from '@/lib/deck/rank';
import { toCard, type Card } from '@/lib/cards/card';
import { notFound } from '@/server/http/respond';
import type { UserRecord } from '@/server/users/ensure-user';

/**
 * The candidate feed (BACKLOG E6.1, E6.5).
 *
 * Exclusions are computed from the viewer's own swipe history rather than filtered in
 * the query, because Firestore cannot express "not in this set". At demo scale that is
 * simply cheaper; when the population outgrows a single read, this becomes a paged
 * scan with the exclusion set held in a cursor.
 */

export type DeckCard = Card & {
  /** Why this person is here — surfaced for tuning, not shown to users. */
  score: number;
};

export type DeckPage = {
  cards: DeckCard[];
  /** Feed the next request this to continue where the deck left off. */
  cursor: number | null;
  remaining: number;
};

async function excludedUids(uid: string): Promise<Set<string>> {
  const db = adminDb();

  const [swipes, matches] = await Promise.all([
    db.collection('swipes').where('from', '==', uid).get(),
    db.collection('matches').where('participants', 'array-contains', uid).get(),
  ]);

  const excluded = new Set<string>([uid]);
  for (const doc of swipes.docs) excluded.add((doc.data() as { to: string }).to);
  for (const doc of matches.docs) {
    for (const participant of (doc.data() as { participants: string[] }).participants) {
      excluded.add(participant);
    }
  }

  return excluded;
}

export async function loadDeck(
  uid: string,
  options: { filters?: DeckFilters; limit?: number; offset?: number } = {},
): Promise<DeckPage> {
  const db = adminDb();
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  const me = await db.collection('users').doc(uid).get();
  const data = me.data() as UserRecord | undefined;
  if (!data) throw notFound('No profile yet.');
  const viewer = profileSchema.parse(data);

  const excluded = await excludedUids(uid);

  // Only published users appear in a deck: an unfinished profile has no card to show.
  const snapshot = await db.collection('users').where('onboarding.completed', '==', true).get();

  const candidates: Candidate[] = [];
  for (const doc of snapshot.docs) {
    if (excluded.has(doc.id)) continue;
    const row = doc.data() as UserRecord;
    const parsed = profileSchema.safeParse(row);
    if (!parsed.success) continue;
    candidates.push({
      uid: doc.id,
      profile: parsed.data,
      lastActiveAt: row.stats?.lastActiveAt ?? null,
    });
  }

  const ranked = rankDeck(viewer, candidates, { filters: options.filters });
  const page = ranked.slice(offset, offset + limit);

  return {
    cards: page.map((candidate) => ({
      ...toCard(candidate.uid, candidate.profile),
      score: candidate.score.total,
    })),
    cursor: offset + limit < ranked.length ? offset + limit : null,
    remaining: Math.max(ranked.length - (offset + page.length), 0),
  };
}
