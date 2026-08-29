/**
 * Integration check for the swipe transaction, against the real database
 * (BACKLOG E7.6).
 *
 * Unit tests cannot prove this: the whole question is what Firestore does when two
 * transactions touch the same documents at the same instant. So this creates throwaway
 * users, fires the swipes concurrently, and asserts the invariant afterwards.
 *
 * Everything it writes is prefixed `zz-test-` and deleted at the end, including on
 * failure.
 *
 *   npm run verify:swipe
 */
import { adminDb } from '@/server/firebase/admin';
import { recordSwipe } from '@/server/swipes/record-swipe';
import { matchIdFor, swipeIdFor } from '@/lib/matching/match-id';
import { emptyProfile } from '@/lib/schemas/profile';

const db = adminDb();
const PREFIX = 'zz-test-';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    process.stdout.write(`  ok    ${name}\n`);
  } else {
    failed += 1;
    process.stdout.write(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}\n`);
  }
}

async function makeUser(suffix: string): Promise<string> {
  const uid = `${PREFIX}${suffix}`;
  await db
    .collection('users')
    .doc(uid)
    .set({
      ...emptyProfile(),
      first: 'Test',
      last: suffix,
      onboarding: { step: 5, completed: true, publishedAt: Date.now() },
      stats: { replyRate: null, lastActiveAt: Date.now() },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  return uid;
}

async function cleanup(uids: string[]): Promise<void> {
  const batch = db.batch();
  for (const uid of uids) {
    batch.delete(db.collection('users').doc(uid));
    for (const other of uids) {
      if (uid === other) continue;
      batch.delete(db.collection('swipes').doc(swipeIdFor(uid, other)));
      batch.delete(db.collection('inbox').doc(uid).collection('likes').doc(other));
      batch.delete(db.collection('matches').doc(matchIdFor(uid, other)));
    }
  }
  await batch.commit();
}

async function matchExists(a: string, b: string): Promise<boolean> {
  return (await db.collection('matches').doc(matchIdFor(a, b)).get()).exists;
}

async function testSimultaneousMutualYes(): Promise<void> {
  process.stdout.write('\nsimultaneous mutual yes\n');
  const [a, b] = await Promise.all([makeUser('race-a'), makeUser('race-b')]);

  // The actual race: both requests in flight before either has committed.
  const [first, second] = await Promise.all([
    recordSwipe(a, b, 'yes'),
    recordSwipe(b, a, 'yes'),
  ]);

  const matched = [first, second].filter((r) => r.matched);
  check('exactly one side reports the match', matched.length === 1, `${matched.length} did`);
  check('a match document exists', await matchExists(a, b));

  const all = await db.collection('matches').where('participants', 'array-contains', a).get();
  check('exactly one match document was created', all.size === 1, `found ${all.size}`);

  const inboxA = await db.collection('inbox').doc(a).collection('likes').doc(b).get();
  const inboxB = await db.collection('inbox').doc(b).collection('likes').doc(a).get();
  check('neither inbox keeps a stale like', !inboxA.exists && !inboxB.exists);

  await cleanup([a, b]);
}

async function testSequentialMutualYes(): Promise<void> {
  process.stdout.write('\nsequential mutual yes\n');
  const [a, b] = await Promise.all([makeUser('seq-a'), makeUser('seq-b')]);

  const one = await recordSwipe(a, b, 'priority');
  check('first swipe does not match', !one.matched);

  const like = await db.collection('inbox').doc(b).collection('likes').doc(a).get();
  check('the like lands in their inbox', like.exists);
  check('a swipe-up is flagged as priority', like.data()?.priority === true);

  const two = await recordSwipe(b, a, 'yes');
  check('the second swipe matches', two.matched);
  check('the match id is the derived one', two.matchId === matchIdFor(a, b));

  await cleanup([a, b]);
}

async function testPassAndIdempotency(): Promise<void> {
  process.stdout.write('\npasses and repeated swipes\n');
  const [a, b] = await Promise.all([makeUser('pass-a'), makeUser('pass-b')]);

  await recordSwipe(a, b, 'no');
  check('a pass never matches', !(await matchExists(a, b)));

  const back = await recordSwipe(b, a, 'yes');
  check('they can still like me after I passed', !back.matched);
  check('but no match is created', !(await matchExists(a, b)));

  // A double tap or a retried request must not undo anything.
  const repeat = await recordSwipe(a, b, 'yes');
  check('re-swiping keeps the original decision', repeat.action === 'no');
  check('re-swiping does not create a match', !repeat.matched);

  await cleanup([a, b]);
}

async function testSelfSwipe(): Promise<void> {
  process.stdout.write('\nself swipe\n');
  const a = await makeUser('self-a');
  let rejected = false;
  try {
    await recordSwipe(a, a, 'yes');
  } catch {
    rejected = true;
  }
  check('swiping on yourself is rejected', rejected);
  await cleanup([a]);
}

async function testMissingTarget(): Promise<void> {
  process.stdout.write('\nswipe on a card that no longer exists\n');
  const a = await makeUser('ghost-a');
  let rejected = false;
  try {
    await recordSwipe(a, `${PREFIX}does-not-exist`, 'yes');
  } catch {
    rejected = true;
  }
  check('a deleted profile cannot be swiped', rejected);
  await cleanup([a]);
}

async function main(): Promise<void> {
  process.stdout.write(`verifying swipes against ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

  try {
    await testSimultaneousMutualYes();
    await testSequentialMutualYes();
    await testPassAndIdempotency();
    await testSelfSwipe();
    await testMissingTarget();
  } finally {
    // Belt and braces: sweep anything an early failure left behind.
    const leftovers = await db.collection('users').where('last', '>=', '').get();
    const stale = leftovers.docs.filter((doc) => doc.id.startsWith(PREFIX));
    if (stale.length > 0) {
      await Promise.all(stale.map((doc) => doc.ref.delete()));
      process.stdout.write(`\n  swept ${stale.length} leftover test user(s)\n`);
    }
  }

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
});
