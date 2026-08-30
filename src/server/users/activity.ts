import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { buildActivity, activitySummary, type ActivityEvent } from '@/lib/activity/feed';
import { counterpartOf } from '@/lib/matching/match-id';
import { profileSchema } from '@/lib/schemas/profile';
import type { Booking, InboundLike, Match } from '@/lib/schemas/entities';

/**
 * Activity feed (BACKLOG E11.4).
 *
 * Everything here is derived from collections other features already write, so adding
 * the feed changed no write path. See src/lib/activity/feed.ts for the reasoning.
 */

const MAX_LIKES = 20;
const MAX_MATCHES = 30;
const MAX_BOOKINGS = 20;

/** One lookup per person, shared by all three event sources. */
async function namesFor(uids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids)];
  const docs = await Promise.all(unique.map((uid) => adminDb().collection('users').doc(uid).get()));

  const names = new Map<string, string>();
  for (const doc of docs) {
    const data = doc.data();
    if (!data) continue;
    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) continue;
    names.set(doc.id, [parsed.data.first, parsed.data.last].filter(Boolean).join(' ').trim());
  }
  return names;
}

export type Activity = {
  events: ActivityEvent[];
  summary: string | null;
};

export async function loadActivity(uid: string): Promise<Activity> {
  const db = adminDb();

  const [likeDocs, matchDocs, bookingDocs] = await Promise.all([
    db
      .collection('inbox')
      .doc(uid)
      .collection('likes')
      .orderBy('createdAt', 'desc')
      .limit(MAX_LIKES)
      .get(),
    db.collection('matches').where('participants', 'array-contains', uid).limit(MAX_MATCHES).get(),
    db
      .collection('bookings')
      .where('participants', 'array-contains', uid)
      .limit(MAX_BOOKINGS)
      .get(),
  ]);

  const likes = likeDocs.docs.map((doc) => doc.data() as InboundLike);
  const openMatches = matchDocs.docs
    .map((doc) => ({ matchId: doc.id, match: doc.data() as Match }))
    .filter((entry) => entry.match.closedAt === null);
  const bookings = bookingDocs.docs.map((doc) => doc.data() as Booking);

  const names = await namesFor([
    ...likes.map((like) => like.fromUid),
    ...openMatches.map((entry) => counterpartOf(entry.match.participants, uid)),
    ...bookings.map((booking) => counterpartOf(booking.participants, uid)),
  ]);

  // A person whose profile has gone is dropped rather than rendered as "undefined".
  const named = (otherUid: string): string | null => names.get(otherUid) ?? null;

  const events = buildActivity({
    uid,
    likes: likes.flatMap((like) => {
      const name = named(like.fromUid);
      return name ? [{ name, priority: like.priority, createdAt: like.createdAt }] : [];
    }),
    matches: openMatches.flatMap(({ matchId, match }) => {
      const name = named(counterpartOf(match.participants, uid));
      return name
        ? [{ matchId, name, createdAt: match.createdAt, lastMessage: match.lastMessage }]
        : [];
    }),
    bookings: bookings.flatMap((booking) => {
      const name = named(counterpartOf(booking.participants, uid));
      return name
        ? [
            {
              matchId: booking.matchId,
              name,
              venueName: booking.venue?.name ?? null,
              status: booking.status,
              updatedAt: booking.updatedAt,
            },
          ]
        : [];
    }),
  });

  return { events, summary: activitySummary(events) };
}
