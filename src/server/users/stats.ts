import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { replyRateFor, type ReplyRate, type ReplyRateMessage } from '@/lib/profile/reply-rate';
import type { Match, Message } from '@/lib/schemas/entities';

/**
 * Reply rate (BACKLOG E11.2).
 *
 * Computed on read rather than incremented on every message write. Two reasons: it is
 * always correct even after a message is deleted or a match is closed, and it removes
 * a counter that two concurrent sends could race. The result is cached back onto
 * `users/{uid}.stats.replyRate` so the deck and card can read one number without
 * walking every thread.
 */

/** Enough for a demo population; a real one would page. */
const MAX_THREADS = 50;

export async function computeReplyRate(uid: string): Promise<ReplyRate> {
  const db = adminDb();

  const matches = await db
    .collection('matches')
    .where('participants', 'array-contains', uid)
    .limit(MAX_THREADS)
    .get();

  const threads = await Promise.all(
    matches.docs.map(async (doc) => {
      // A closed match still counts: you either replied before it closed or you did not.
      const messages = await doc.ref.collection('messages').orderBy('createdAt').get();
      return messages.docs.map((message) => {
        const data = message.data() as Message;
        return {
          from: data.from,
          kind: data.kind,
          createdAt: data.createdAt,
        } satisfies ReplyRateMessage;
      });
    }),
  );

  return replyRateFor(uid, threads);
}

/**
 * Recomputes and caches. Kept separate from the read so a caller that only wants the
 * number is not forced into a write.
 */
export async function refreshReplyRate(uid: string): Promise<ReplyRate> {
  const value = await computeReplyRate(uid);
  await adminDb().collection('users').doc(uid).update({ 'stats.replyRate': value.rate });
  return value;
}

/** True when the match is visible to this user (closed matches are hidden both ways). */
export function isOpen(match: Pick<Match, 'closedAt'>): boolean {
  return match.closedAt === null;
}
