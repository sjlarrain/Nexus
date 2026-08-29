import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { matchIdFor, swipeIdFor } from '@/lib/matching/match-id';
import { pairKey } from '@/lib/matching/match-id';
import type { SwipeAction } from '@/lib/schemas/entities';
import { badRequest, notFound } from '@/server/http/respond';

/**
 * The swipe write path (BACKLOG E7.1–E7.3).
 *
 * The hard case: Jordan and Daniel swipe yes on each other in the same instant. If
 * both requests independently decided "no match yet, write my swipe", neither would
 * create the match. If both decided "match!", we would create two threads.
 *
 * A Firestore transaction fixes both. Each attempt reads the counter-swipe inside the
 * transaction; whichever commits second sees the first one's write and creates the
 * match. And because `matchIdFor` derives the id from the sorted uid pair rather than
 * generating one, even a retry that races cannot produce a second thread — it writes
 * the same document id.
 */

export type SwipeOutcome = {
  action: SwipeAction;
  matched: boolean;
  matchId: string | null;
};

export async function recordSwipe(
  from: string,
  to: string,
  action: SwipeAction,
): Promise<SwipeOutcome> {
  if (from === to) throw badRequest('You cannot swipe on yourself.');

  const db = adminDb();
  const now = Date.now();

  const targetRef = db.collection('users').doc(to);
  const mySwipeRef = db.collection('swipes').doc(swipeIdFor(from, to));
  const theirSwipeRef = db.collection('swipes').doc(swipeIdFor(to, from));
  const myInboxRef = db.collection('inbox').doc(from).collection('likes').doc(to);
  const theirInboxRef = db.collection('inbox').doc(to).collection('likes').doc(from);

  return db.runTransaction(async (tx) => {
    // Every read must happen before every write inside a Firestore transaction.
    const [target, theirSwipe, existing] = await Promise.all([
      tx.get(targetRef),
      tx.get(theirSwipeRef),
      tx.get(mySwipeRef),
    ]);

    if (!target.exists) throw notFound('That person is no longer available.');

    // Swiping twice on the same card is a no-op, not an error: a flaky network or a
    // double tap should not undo a match that already exists.
    if (existing.exists) {
      const previous = existing.data() as { action: SwipeAction };
      const matchId = matchIdFor(from, to);
      const match = await tx.get(db.collection('matches').doc(matchId));
      return {
        action: previous.action,
        matched: match.exists,
        matchId: match.exists ? matchId : null,
      };
    }

    tx.set(mySwipeRef, { from, to, action, createdAt: now });

    if (action === 'no') {
      // A pass also clears any like they had sent me, so the Likes screen stays honest.
      tx.delete(myInboxRef);
      return { action, matched: false, matchId: null };
    }

    const theirAction = theirSwipe.exists
      ? (theirSwipe.data() as { action: SwipeAction }).action
      : null;
    const mutual = theirAction === 'yes' || theirAction === 'priority';

    if (!mutual) {
      // Mirror the swipe into their inbox so their Likes screen is one query.
      // `priority` is the swipe-up ask and sorts to the top (spec section 1).
      tx.set(theirInboxRef, {
        fromUid: from,
        priority: action === 'priority',
        createdAt: now,
      });
      return { action, matched: false, matchId: null };
    }

    const matchId = matchIdFor(from, to);
    tx.set(db.collection('matches').doc(matchId), {
      participants: pairKey(from, to),
      createdAt: now,
      lastMessage: null,
      bookingId: null,
      closedAt: null,
    });

    // The like has been consumed by the match; it should not linger in either inbox.
    tx.delete(myInboxRef);
    tx.delete(theirInboxRef);

    return { action, matched: true, matchId };
  });
}

/**
 * Yes-back from the Likes screen. Identical to a right-swipe — it exists as its own
 * function only so the route reads clearly (BACKLOG E8.2).
 */
export async function likeBack(from: string, to: string): Promise<SwipeOutcome> {
  return recordSwipe(from, to, 'yes');
}

/** Pass from the Likes screen: drop the inbound like without matching (E8.3). */
export async function dismissLike(me: string, them: string): Promise<void> {
  await recordSwipe(me, them, 'no');
}
