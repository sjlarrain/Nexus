/**
 * Security rules verification against the deployed rules (BACKLOG E12.2, E9.2).
 *
 * The rules are the authorization layer — if they are wrong, every route handler in
 * the app is irrelevant, because a client can talk to Firestore directly. Nothing in
 * `npm test` touches them: the Admin SDK bypasses rules entirely, so every existing
 * test proves the opposite of what is needed here.
 *
 * The emulator would be the usual home for this, but it needs a JDK that is not
 * installed (docs/decisions.md). So this signs in as throwaway users with the *client*
 * SDK — the same code path a browser takes — and asserts what each of them can and
 * cannot reach. It tests the rules that are actually deployed, which the emulator
 * would not.
 *
 * Everything it creates is prefixed `zz-rules-` and deleted at the end, including on
 * failure.
 *
 *   npm run verify:rules
 */
import {
  initializeApp as initClientApp,
  deleteApp,
  FirebaseError,
  type FirebaseApp,
} from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getFirestore,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import { adminAuth, adminDb } from '@/server/firebase/admin';
import { publicEnv } from '@/lib/env';
import { matchIdFor } from '@/lib/matching/match-id';
import { emptyProfile } from '@/lib/schemas/profile';

// Every denial below is an expected result, and the SDK logs each one as an error.
// Silencing it keeps the report readable; the checks capture and print any error
// that actually matters.
setLogLevel('silent');

const db = adminDb();
const PREFIX = 'zz-rules-';
const PASSWORD = 'rules-verification-only';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    process.stdout.write(`  ok      ${name}\n`);
  } else {
    failed += 1;
    process.stdout.write(`  FAIL    ${name}${detail ? ` — ${detail}` : ''}\n`);
  }
}

function isDenied(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === 'permission-denied';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Asserts the rules refuse something. A silent success here is the dangerous case. */
async function denied(name: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
    check(name, false, 'the rules ALLOWED it');
  } catch (error) {
    check(name, isDenied(error), `expected permission-denied, got: ${describe(error)}`);
  }
}

/** Asserts the rules permit something — a rule that denies too much breaks the app. */
async function allowed(name: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
    check(name, true);
  } catch (error) {
    check(name, false, describe(error));
  }
}

// --- fixtures ---------------------------------------------------------------

type Person = { uid: string; email: string };

function person(suffix: string): Person {
  return { uid: `${PREFIX}${suffix}`, email: `${PREFIX}${suffix}@warmintro.test` };
}

const ALICE = person('alice');
const BOB = person('bob');
const MALLORY = person('mallory');
const NEWCOMER = person('newcomer');
const EVERYONE = [ALICE, BOB, MALLORY, NEWCOMER];

const MATCH_ID = matchIdFor(ALICE.uid, BOB.uid);
const MESSAGE_ID = `${PREFIX}message`;
const BOOKING_ID = `${PREFIX}booking`;
const VENUE_ID = `${PREFIX}venue`;

async function createPerson(who: Person, completed: boolean): Promise<void> {
  // A previous run that died before cleanup should not block this one.
  await adminAuth()
    .deleteUser(who.uid)
    .catch(() => {});
  await adminAuth().createUser({ uid: who.uid, email: who.email, password: PASSWORD });

  const now = Date.now();
  await db
    .collection('users')
    .doc(who.uid)
    .set({
      ...emptyProfile(),
      first: 'Test',
      last: who.uid,
      onboarding: { step: 5, completed, publishedAt: completed ? now : null },
      stats: { replyRate: null, lastActiveAt: now },
      createdAt: now,
      updatedAt: now,
    });
}

async function seed(): Promise<void> {
  await Promise.all([
    createPerson(ALICE, true),
    createPerson(BOB, true),
    createPerson(MALLORY, true),
    // Signed in but never published: the deck must not open up to them.
    createPerson(NEWCOMER, false),
  ]);

  const now = Date.now();
  const participants = [ALICE.uid, BOB.uid].sort();

  await db.collection('users').doc(ALICE.uid).collection('private').doc('meta').set({
    email: ALICE.email,
    emailVerified: false,
    createdAt: now,
  });

  await db
    .collection('matches')
    .doc(MATCH_ID)
    .set({
      participants,
      createdAt: now,
      lastMessage: { text: 'private', at: now, from: BOB.uid },
      bookingId: BOOKING_ID,
      closedAt: null,
    });

  await db
    .collection('matches')
    .doc(MATCH_ID)
    .collection('messages')
    .doc(MESSAGE_ID)
    .set({ from: BOB.uid, text: 'This is private.', kind: 'text', createdAt: now });

  await db
    .collection('inbox')
    .doc(ALICE.uid)
    .collection('likes')
    .doc(BOB.uid)
    .set({ fromUid: BOB.uid, priority: false, createdAt: now });

  const venue = {
    id: VENUE_ID,
    name: 'Test Cafe',
    address: '',
    source: 'nearby',
    lat: null,
    lng: null,
  };

  await db
    .collection('bookings')
    .doc(BOOKING_ID)
    .set({
      matchId: MATCH_ID,
      participants,
      venue,
      slots: [{ startsAt: now, durationMin: 30 }],
      chosenSlot: null,
      status: 'proposed',
      createdBy: ALICE.uid,
      createdAt: now,
      updatedAt: now,
    });

  await db.collection('venues').doc(VENUE_ID).set(venue);
}

async function cleanup(): Promise<void> {
  await Promise.allSettled(EVERYONE.map((who) => adminAuth().deleteUser(who.uid)));

  await db.collection('matches').doc(MATCH_ID).collection('messages').doc(MESSAGE_ID).delete();
  await db.collection('users').doc(ALICE.uid).collection('private').doc('meta').delete();

  const batch = db.batch();
  for (const who of EVERYONE) batch.delete(db.collection('users').doc(who.uid));
  batch.delete(db.collection('inbox').doc(ALICE.uid).collection('likes').doc(BOB.uid));
  batch.delete(db.collection('matches').doc(MATCH_ID));
  batch.delete(db.collection('bookings').doc(BOOKING_ID));
  batch.delete(db.collection('venues').doc(VENUE_ID));
  await batch.commit();
}

// --- client sessions --------------------------------------------------------

type Session = { db: Firestore; close: () => Promise<void> };

/**
 * A real client session, not an admin one. Each gets its own named Firebase app so
 * two identities can be held at once without signing each other out.
 */
async function signInAs(who: Person | null, label: string): Promise<Session> {
  const app: FirebaseApp = initClientApp(publicEnv(), `${PREFIX}${label}`);
  const auth: Auth = getAuth(app);
  if (who) await signInWithEmailAndPassword(auth, who.email, PASSWORD);
  return {
    db: getFirestore(app),
    close: async () => {
      await deleteApp(app);
    },
  };
}

// --- the checks -------------------------------------------------------------

async function asStranger(): Promise<void> {
  const { db: client, close } = await signInAs(MALLORY, 'mallory');
  process.stdout.write('\nA signed-in stranger\n');

  // The product requires this one: published profiles are public to published users.
  await allowed('can read another published profile', () =>
    getDoc(doc(client, 'users', ALICE.uid)),
  );

  await denied('cannot read a profile private/meta', () =>
    getDoc(doc(client, 'users', ALICE.uid, 'private', 'meta')),
  );
  await denied('cannot edit someone else profile', () =>
    updateDoc(doc(client, 'users', ALICE.uid), { headline: 'hacked' }),
  );
  await denied('cannot read a match it is not in', () => getDoc(doc(client, 'matches', MATCH_ID)));
  await denied('cannot read messages in that match', () =>
    getDocs(collection(client, 'matches', MATCH_ID, 'messages')),
  );
  await denied('cannot write a message into that match', () =>
    setDoc(doc(client, 'matches', MATCH_ID, 'messages', `${PREFIX}intruder`), {
      from: MALLORY.uid,
      text: 'hello',
      kind: 'text',
      createdAt: Date.now(),
    }),
  );
  await denied('cannot read someone else inbox likes', () =>
    getDocs(collection(client, 'inbox', ALICE.uid, 'likes')),
  );
  await denied('cannot read a booking it is not in', () =>
    getDoc(doc(client, 'bookings', BOOKING_ID)),
  );
  await denied('cannot read swipes', () => getDocs(collection(client, 'swipes')));
  await allowed('can read venues', () => getDoc(doc(client, 'venues', VENUE_ID)));
  await denied('cannot write venues', () =>
    setDoc(doc(client, 'venues', VENUE_ID), { name: 'spoofed' }),
  );
  await denied('cannot reach an unlisted collection', () =>
    getDoc(doc(client, 'zz-unlisted', 'anything')),
  );

  await close();
}

async function asParticipant(): Promise<void> {
  const { db: client, close } = await signInAs(ALICE, 'alice');
  process.stdout.write('\nA participant in the match\n');

  await allowed('can read own private/meta', () =>
    getDoc(doc(client, 'users', ALICE.uid, 'private', 'meta')),
  );
  await denied('cannot write own private/meta', () =>
    setDoc(doc(client, 'users', ALICE.uid, 'private', 'meta'), { email: 'x' }),
  );
  await allowed('can read the match', () => getDoc(doc(client, 'matches', MATCH_ID)));
  await allowed('can read the messages', () =>
    getDocs(collection(client, 'matches', MATCH_ID, 'messages')),
  );
  await allowed('can read own inbox likes', () =>
    getDocs(collection(client, 'inbox', ALICE.uid, 'likes')),
  );
  await allowed('can read the booking', () => getDoc(doc(client, 'bookings', BOOKING_ID)));

  // Server-only writes: a client-side message would leave `lastMessage` stale.
  await denied('cannot write a message', () =>
    setDoc(doc(client, 'matches', MATCH_ID, 'messages', `${PREFIX}client`), {
      from: ALICE.uid,
      text: 'written by the client',
      kind: 'text',
      createdAt: Date.now(),
    }),
  );
  await denied('cannot edit the match', () =>
    updateDoc(doc(client, 'matches', MATCH_ID), { closedAt: Date.now() }),
  );
  await denied('cannot edit the booking', () =>
    updateDoc(doc(client, 'bookings', BOOKING_ID), { status: 'confirmed' }),
  );

  await allowed('can edit own profile', () =>
    updateDoc(doc(client, 'users', ALICE.uid), { headline: 'edited by the owner' }),
  );
  await denied('cannot award itself a reply rate', () =>
    updateDoc(doc(client, 'users', ALICE.uid), { stats: { replyRate: 1, lastActiveAt: null } }),
  );
  await denied('cannot publish itself by writing onboarding', () =>
    updateDoc(doc(client, 'users', ALICE.uid), {
      onboarding: { step: 5, completed: true, publishedAt: Date.now() },
    }),
  );
  await denied('cannot delete own profile', () => deleteDoc(doc(client, 'users', ALICE.uid)));

  await close();
}

async function asUnpublished(): Promise<void> {
  const { db: client, close } = await signInAs(NEWCOMER, 'newcomer');
  process.stdout.write('\nSigned in but not published\n');

  await allowed('can read own profile', () => getDoc(doc(client, 'users', NEWCOMER.uid)));
  // Publishing is what buys you the deck. Reading it before that is not on.
  await denied('cannot read other profiles', () => getDoc(doc(client, 'users', ALICE.uid)));

  await close();
}

async function asAnonymous(): Promise<void> {
  const { db: client, close } = await signInAs(null, 'anon');
  process.stdout.write('\nNot signed in at all\n');

  await denied('cannot read any profile', () => getDoc(doc(client, 'users', ALICE.uid)));
  await denied('cannot read venues', () => getDoc(doc(client, 'venues', VENUE_ID)));
  await denied('cannot read refdata', () => getDoc(doc(client, 'refdata', 'cities')));

  await close();
}

async function main(): Promise<void> {
  process.stdout.write(`Verifying deployed rules on ${publicEnv().projectId}\n`);
  await seed();

  try {
    await asStranger();
    await asParticipant();
    await asUnpublished();
    await asAnonymous();
  } finally {
    await cleanup();
  }

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error: unknown) => {
  process.stderr.write(`\n${describe(error)}\n`);
  await cleanup().catch(() => {});
  process.exitCode = 1;
});
