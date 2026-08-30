import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { matchIdFor, pairKey, swipeIdFor } from '@/lib/matching/match-id';
import { DEMO_MATCH_SHARE, planDemoMatches } from '@/lib/matching/demo-plan';
import type { Message } from '@/lib/schemas/entities';
import type { UserRecord } from '@/server/users/ensure-user';

/**
 * Auto-matching against the seeded population (BACKLOG E1b.9).
 *
 * Nobody can test chat, the likes screen or booking from an empty account, and a
 * fresh sign-up has no matches by definition — swiping through forty cards before
 * reaching a single thread is not a demo. So the moment someone publishes, they are
 * matched with most of the seeded people.
 *
 * Only documents carrying `seeded: true` are touched, which is the same marker
 * `npm run seed` writes and `seed:reset` deletes. A real account is never matched to
 * another real account by this.
 *
 * Set `DEMO_AUTO_MATCH=false` to turn it off without a code change; it must be off
 * before the app sees users who are not in on the demo.
 */

/** How many of those threads get an opening line, so chat has something to show. */
const THREADS_WITH_A_MESSAGE = 5;

/** Firestore caps a batch at 500 writes; stay well under it. */
const BATCH_LIMIT = 400;

const OPENERS = [
  'Saw your card come up — how are you finding the market right now?',
  'Your headline caught my eye. Happy to trade notes any time.',
  'We overlap on a couple of things. Coffee sometime?',
  'Glad you turned up in my deck. What are you working on this quarter?',
  'Happy to open a door if it is useful — just say the word.',
];

export { DEMO_MATCH_SHARE };

export type DemoMatchResult = {
  matched: number;
  likes: number;
  /** Already run for this user, or switched off. */
  skipped: boolean;
};

export function autoMatchEnabled(): boolean {
  return process.env.DEMO_AUTO_MATCH !== 'false';
}

/**
 * Idempotent by construction: match ids derive from the uid pair, so a re-run
 * overwrites rather than duplicating. `demoMatchedAt` short-circuits it anyway, so
 * the common path is a single document read.
 */
export async function ensureDemoMatches(
  uid: string,
  options: { force?: boolean } = {},
): Promise<DemoMatchResult> {
  const empty: DemoMatchResult = { matched: 0, likes: 0, skipped: true };
  if (!autoMatchEnabled()) return empty;

  const db = adminDb();
  const meRef = db.collection('users').doc(uid);
  const me = await meRef.get();
  const record = me.data() as
    (UserRecord & { demoMatchedAt?: number; seeded?: boolean }) | undefined;

  if (!record) return empty;
  // `seed:reset` deletes every seeded match but cannot clear this flag, which would
  // otherwise leave an already-matched account with nothing after a reseed. That is
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
    return { matched: 0, likes: 0, skipped: false };
  }

  const { toMatch, toLike } = planDemoMatches({
    eligible,
    alreadySwiped,
    share: DEMO_MATCH_SHARE,
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

  for (const [index, other] of toMatch.entries()) {
    const matchId = matchIdFor(uid, other);
    // Staggered so the chat list is not forty threads with an identical timestamp.
    const createdAt = now - index * 60_000;
    const opener = index < THREADS_WITH_A_MESSAGE ? OPENERS[index % OPENERS.length] : null;

    await queue(() =>
      batch.set(db.collection('matches').doc(matchId), {
        participants: pairKey(uid, other),
        createdAt,
        lastMessage: opener ? { text: opener, at: createdAt, from: other } : null,
        bookingId: null,
        closedAt: null,
        seeded: true,
      }),
    );

    // Both directions, so neither party's deck re-shows someone already matched.
    for (const [from, to] of [
      [uid, other],
      [other, uid],
    ] as const) {
      await queue(() =>
        batch.set(db.collection('swipes').doc(swipeIdFor(from, to)), {
          from,
          to,
          action: 'yes',
          createdAt,
          seeded: true,
        }),
      );
    }

    if (opener) {
      const message: Message & { seeded: boolean } = {
        from: other,
        text: opener,
        kind: 'text',
        createdAt,
        seeded: true,
      };
      await queue(() =>
        batch.set(
          db.collection('matches').doc(matchId).collection('messages').doc('msg-000'),
          message,
        ),
      );
    }
  }

  for (const [index, other] of toLike.entries()) {
    const createdAt = now - (index + 1) * 90_000;
    await queue(() =>
      batch.set(db.collection('inbox').doc(uid).collection('likes').doc(other), {
        fromUid: other,
        priority: index === 0,
        createdAt,
      }),
    );
    await queue(() =>
      batch.set(db.collection('swipes').doc(swipeIdFor(other, uid)), {
        from: other,
        to: uid,
        action: index === 0 ? 'priority' : 'yes',
        createdAt,
        seeded: true,
      }),
    );
  }

  await queue(() => batch.update(meRef, { demoMatchedAt: now }));
  await flush();

  return { matched: toMatch.length, likes: toLike.length, skipped: false };
}
