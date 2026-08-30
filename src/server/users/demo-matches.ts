import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { swipeIdFor } from '@/lib/matching/match-id';
import { DEMO_LIKE_SHARE, planDemoLikes } from '@/lib/matching/demo-plan';
import type { UserRecord } from '@/server/users/ensure-user';

/**
 * Seeded inbound likes for a new account (BACKLOG E1b.9).
 *
 * Nobody can test the likes screen, chat or booking from an empty account, and a
 * fresh sign-up has nothing by definition. So the moment someone publishes, most of
 * the seeded population has already liked them.
 *
 * Likes, not matches. Handing a new account forty finished threads it never swiped
 * for is a worse demo than a full Likes screen and a deck where every right-swipe
 * lands: the counter-swipe is already in place, so `recordSwipe` sees a mutual yes
 * and opens the thread in the same transaction a real match would use. Nothing here
 * writes a match document.
 *
 * Only documents carrying `seeded: true` are touched, which is the same marker
 * `npm run seed` writes and `seed:reset` deletes. A real account is never liked by
 * another real account by this.
 *
 * Set `DEMO_AUTO_MATCH=false` to turn it off without a code change; it must be off
 * before the app sees users who are not in on the demo.
 */

/** Firestore caps a batch at 500 writes; stay well under it. */
const BATCH_LIMIT = 400;

export { DEMO_LIKE_SHARE };

export type DemoMatchResult = {
  /** Inbound likes written. */
  likes: number;
  /** Already run for this user, or switched off. */
  skipped: boolean;
};

export function autoMatchEnabled(): boolean {
  return process.env.DEMO_AUTO_MATCH !== 'false';
}

/**
 * Idempotent by construction: a like is keyed by the liker's uid in the account's
 * inbox, so a re-run overwrites rather than duplicating. `demoMatchedAt`
 * short-circuits it anyway, so the common path is a single document read.
 */
export async function ensureDemoMatches(
  uid: string,
  options: { force?: boolean } = {},
): Promise<DemoMatchResult> {
  const empty: DemoMatchResult = { likes: 0, skipped: true };
  if (!autoMatchEnabled()) return empty;

  const db = adminDb();
  const meRef = db.collection('users').doc(uid);
  const me = await meRef.get();
  const record = me.data() as
    (UserRecord & { demoMatchedAt?: number; seeded?: boolean }) | undefined;

  if (!record) return empty;
  // `seed:reset` deletes every seeded like but cannot clear this flag, which would
  // otherwise leave an already-liked account with nothing after a reseed. That is
  // what `force` is for; the backfill in `npm run doctor -- --fix` passes it.
  if (record.demoMatchedAt && !options.force) return empty;
  // A seeded person already has the scenario data the seed script gave them.
  if (record.seeded) return empty;

  const [seeded, mySwipes] = await Promise.all([
    db.collection('users').where('seeded', '==', true).get(),
    db.collection('swipes').where('from', '==', uid).get(),
  ]);

  const alreadySwiped = new Set(mySwipes.docs.map((doc) => (doc.data() as { to: string }).to));

  // Sorted for determinism: the same account always gets the same set, so a bug
  // found while demoing can be reproduced.
  const eligible = seeded.docs
    .filter((doc) => doc.id !== uid)
    .filter((doc) => (doc.data() as UserRecord).onboarding?.completed === true)
    .map((doc) => doc.id)
    .sort();

  if (eligible.length === 0) {
    await meRef.update({ demoMatchedAt: Date.now() });
    return { likes: 0, skipped: false };
  }

  const { toLike } = planDemoLikes({
    eligible,
    alreadySwiped,
    share: DEMO_LIKE_SHARE,
  });

  const now = Date.now();
  let batch = db.batch();
  let queued = 0;

  const flush = async (): Promise<void> => {
    if (queued === 0) return;
    await batch.commit();
    batch = db.batch();
    queued = 0;
  };

  const queue = async (write: () => void): Promise<void> => {
    write();
    queued += 1;
    if (queued >= BATCH_LIMIT) await flush();
  };

  for (const [index, other] of toLike.entries()) {
    // Staggered so the Likes screen is not thirty rows with an identical timestamp.
    const createdAt = now - (index + 1) * 90_000;
    // `priority` is the swipe-up ask and sorts to the top (spec section 1). One of
    // them is enough to show what the state looks like.
    const priority = index === 0;

    await queue(() =>
      batch.set(db.collection('inbox').doc(uid).collection('likes').doc(other), {
        fromUid: other,
        priority,
        createdAt,
      }),
    );
    /*
     * The swipe behind the like. This is the half that makes the deck pay off: it is
     * the document `recordSwipe` reads as `theirSwipe`, so the account's first
     * right-swipe on this person is a mutual yes and opens a thread immediately.
     */
    await queue(() =>
      batch.set(db.collection('swipes').doc(swipeIdFor(other, uid)), {
        from: other,
        to: uid,
        action: priority ? 'priority' : 'yes',
        createdAt,
        seeded: true,
      }),
    );
  }

  await queue(() => batch.update(meRef, { demoMatchedAt: now }));
  await flush();

  return { likes: toLike.length, skipped: false };
}
