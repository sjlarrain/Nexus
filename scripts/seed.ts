/**
 * Seeds the demo database (BACKLOG E1b).
 *
 *   npm run seed             fill the database, leaving anything already there
 *   npm run seed:reset       wipe seeded data first, then fill
 *   npm run seed -- --count 80
 *
 * Everything it writes is prefixed `demo-`, so a reset can find its own data and
 * never touches a real account.
 */
import { adminAuth, adminDb } from '@/server/firebase/admin';
import {
  DEMO_COUNTERPART_UID,
  DEMO_VIEWER_UID,
  demoCounterpart,
  demoViewer,
  generatePopulation,
  type Fixture,
} from '@/lib/fixtures/generate';
import { matchIdFor, pairKey, swipeIdFor } from '@/lib/matching/match-id';
import type { Booking, Message, Venue } from '@/lib/schemas/entities';
import { GICS_SECTORS, INTERESTS, POSITIONS_BY_SECTOR, allPositions } from '@/lib/refdata/taxonomy';
import { CITIES_BY_STATE, STATE_NAMES } from '@/lib/refdata/locations';
import { PEER_MAP, FALLBACK_COMPANIES } from '@/lib/refdata/peer-map';
import { COURSE_TYPES, OPEN_TO, YEARS_BANDS } from '@/lib/refdata/constants';

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const COUNT = Number(args[args.indexOf('--count') + 1]) || 40;

const db = adminDb();
const now = Date.now();
const minutes = (n: number) => n * 60_000;
const days = (n: number) => n * 86_400_000;

/** Demo cafes, so booking works before a venue provider is chosen (BACKLOG E10.1). */
const VENUES: Venue[] = [
  {
    id: 'venue-sightglass',
    name: 'Sightglass Coffee',
    address: '270 7th St, San Francisco, CA',
    source: 'nearby',
    lat: 37.7766,
    lng: -122.4088,
  },
  {
    id: 'venue-blue-bottle',
    name: 'Blue Bottle Coffee',
    address: '66 Mint St, San Francisco, CA',
    source: 'nearby',
    lat: 37.7823,
    lng: -122.4076,
  },
  {
    id: 'venue-ritual',
    name: 'Ritual Coffee Roasters',
    address: '1026 Valencia St, San Francisco, CA',
    source: 'nearby',
    lat: 37.7565,
    lng: -122.4212,
  },
  {
    id: 'venue-four-barrel',
    name: 'Four Barrel Coffee',
    address: '375 Valencia St, San Francisco, CA',
    source: 'nearby',
    lat: 37.7671,
    lng: -122.4221,
  },
];

async function deleteWhere(collection: string, field: string, value: unknown): Promise<number> {
  const snapshot = await db.collection(collection).where(field, '==', value).get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  return snapshot.size;
}

async function reset(): Promise<void> {
  process.stdout.write('resetting seeded data...\n');

  const users = await db.collection('users').where('seeded', '==', true).get();
  for (const doc of users.docs) {
    const subs = await doc.ref.listCollections();
    for (const sub of subs) {
      const items = await sub.get();
      await Promise.all(items.docs.map((item) => item.ref.delete()));
    }
    await doc.ref.delete();
  }

  const matches = await db.collection('matches').where('seeded', '==', true).get();
  for (const doc of matches.docs) {
    const messages = await doc.ref.collection('messages').get();
    await Promise.all(messages.docs.map((m) => m.ref.delete()));
    await doc.ref.delete();
  }

  const inboxes = await db.collection('inbox').get();
  for (const doc of inboxes.docs) {
    if (!doc.id.startsWith('demo-')) continue;
    const likes = await doc.ref.collection('likes').get();
    await Promise.all(likes.docs.map((like) => like.ref.delete()));
    await doc.ref.delete();
  }

  const removed = {
    users: users.size,
    matches: matches.size,
    swipes: await deleteWhere('swipes', 'seeded', true),
    bookings: await deleteWhere('bookings', 'seeded', true),
  };
  process.stdout.write(`  removed ${JSON.stringify(removed)}\n`);
}

function userDoc(fixture: Fixture, publishedDaysAgo: number) {
  return {
    ...fixture.profile,
    onboarding: { step: 5, completed: true, publishedAt: now - days(publishedDaysAgo) },
    stats: {
      replyRate: Math.round((0.55 + (publishedDaysAgo % 5) * 0.08) * 100) / 100,
      lastActiveAt: now - minutes(publishedDaysAgo * 37),
    },
    createdAt: now - days(publishedDaysAgo + 2),
    updatedAt: now - days(publishedDaysAgo),
    seeded: true,
  };
}

async function writeUsers(fixtures: Fixture[]): Promise<void> {
  let batch = db.batch();
  let queued = 0;

  for (const [index, fixture] of fixtures.entries()) {
    batch.set(db.collection('users').doc(fixture.uid), userDoc(fixture, (index % 20) + 1));
    batch.set(db.collection('users').doc(fixture.uid).collection('private').doc('meta'), {
      email: fixture.email,
      authProviders: ['password'],
      seeded: true,
    });
    queued += 2;

    // Firestore caps a batch at 500 writes.
    if (queued >= 400) {
      await batch.commit();
      batch = db.batch();
      queued = 0;
    }
  }

  if (queued > 0) await batch.commit();
  process.stdout.write(`  users: ${fixtures.length}\n`);
}

/** Inbound likes waiting for the demo viewer, one of them a priority (swipe-up) ask. */
async function writeInboundLikes(admirers: Fixture[]): Promise<void> {
  const batch = db.batch();
  for (const [index, admirer] of admirers.entries()) {
    const priority = index === 0;
    batch.set(db.collection('inbox').doc(DEMO_VIEWER_UID).collection('likes').doc(admirer.uid), {
      fromUid: admirer.uid,
      priority,
      createdAt: now - minutes(30 * (index + 1)),
    });
    batch.set(db.collection('swipes').doc(swipeIdFor(admirer.uid, DEMO_VIEWER_UID)), {
      from: admirer.uid,
      to: DEMO_VIEWER_UID,
      action: priority ? 'priority' : 'yes',
      createdAt: now - minutes(30 * (index + 1)),
      seeded: true,
    });
  }
  await batch.commit();
  process.stdout.write(`  inbound likes for ${DEMO_VIEWER_UID}: ${admirers.length}\n`);
}

type Thread = { from: string; text: string; minutesAgo: number };

async function writeMatch(
  a: string,
  b: string,
  thread: Thread[],
  bookingId: string | null,
): Promise<string> {
  const matchId = matchIdFor(a, b);
  const participants = pairKey(a, b);
  const last = thread.at(-1);

  await db
    .collection('matches')
    .doc(matchId)
    .set({
      participants,
      createdAt: now - days(2),
      lastMessage: last
        ? { text: last.text, at: now - minutes(last.minutesAgo), from: last.from }
        : null,
      bookingId,
      closedAt: null,
      seeded: true,
    });

  // Both directions of the swipe, so the deck never re-shows a matched person.
  const batch = db.batch();
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    batch.set(db.collection('swipes').doc(swipeIdFor(from, to)), {
      from,
      to,
      action: 'yes',
      createdAt: now - days(2),
      seeded: true,
    });
  }

  for (const [index, message] of thread.entries()) {
    const doc: Message & { seeded: boolean } = {
      from: message.from,
      text: message.text,
      kind: 'text',
      createdAt: now - minutes(message.minutesAgo),
      seeded: true,
    };
    batch.set(
      db
        .collection('matches')
        .doc(matchId)
        .collection('messages')
        .doc(`msg-${String(index).padStart(3, '0')}`),
      doc,
    );
  }
  await batch.commit();

  return matchId;
}

async function writeScenarios(population: Fixture[]): Promise<void> {
  // 1. A live match with history, and a cafe named in the thread. This is what makes
  //    rule 1 of suggest() fire and pins "Mentioned in your chat" on the booking screen.
  const chatty: Thread[] = [
    {
      from: DEMO_COUNTERPART_UID,
      text: 'Jordan! Your Figma work on the plugin surface is great.',
      minutesAgo: 600,
    },
    {
      from: DEMO_VIEWER_UID,
      text: 'Thank you — that project ate a whole quarter. How is merchant tooling going?',
      minutesAgo: 540,
    },
    {
      from: DEMO_COUNTERPART_UID,
      text: 'Busy in a good way. We are hiring a designer actually.',
      minutesAgo: 480,
    },
    { from: DEMO_VIEWER_UID, text: 'I would love to hear more about that role.', minutesAgo: 420 },
    {
      from: DEMO_COUNTERPART_UID,
      text: 'Want to grab a coffee? Sightglass Coffee is close to both of us.',
      minutesAgo: 45,
    },
  ];
  const chattyMatch = await writeMatch(DEMO_VIEWER_UID, DEMO_COUNTERPART_UID, chatty, null);

  // 2. A brand new match with no messages — the match moment and the three openers.
  const fresh = population[0];
  if (fresh) await writeMatch(DEMO_VIEWER_UID, fresh.uid, [], null);

  // 3. A match with a confirmed booking — post-booking suggestions, prep state.
  const booked = population[1];
  if (booked) {
    const bookingId = 'demo-booking-001';
    const bookedMatch = await writeMatch(
      DEMO_VIEWER_UID,
      booked.uid,
      [
        { from: booked.uid, text: 'Great to match. Coffee next week?', minutesAgo: 2000 },
        { from: DEMO_VIEWER_UID, text: 'Yes — sending times now.', minutesAgo: 1900 },
      ],
      bookingId,
    );

    const venue = VENUES[1];
    if (venue) {
      const booking: Booking & { seeded: boolean } = {
        matchId: bookedMatch,
        participants: pairKey(DEMO_VIEWER_UID, booked.uid),
        mode: 'in_person',
        venue,
        slots: [
          { startsAt: now + days(2), durationMin: 30 },
          { startsAt: now + days(3), durationMin: 30 },
        ],
        chosenSlot: now + days(2),
        status: 'confirmed',
        createdBy: DEMO_VIEWER_UID,
        createdAt: now - days(1),
        updatedAt: now - minutes(120),
        seeded: true,
      };
      await db.collection('bookings').doc(bookingId).set(booking);
    }
  }

  process.stdout.write(
    `  scenarios: chat+cafe (${chattyMatch.slice(0, 8)}), fresh match, booked coffee\n`,
  );
}

/** Option lists the client reads once and caches (BACKLOG E4.5). */
async function writeRefdata(): Promise<void> {
  const batch = db.batch();
  batch.set(db.collection('refdata').doc('taxonomy'), {
    industries: GICS_SECTORS,
    functions: allPositions(),
    positionsBySector: POSITIONS_BY_SECTOR,
    interests: INTERESTS,
    openTo: OPEN_TO,
    courseTypes: COURSE_TYPES,
    yearsBands: YEARS_BANDS,
    updatedAt: now,
  });
  batch.set(db.collection('refdata').doc('locations'), {
    states: STATE_NAMES,
    cities: CITIES_BY_STATE,
    updatedAt: now,
  });
  batch.set(db.collection('refdata').doc('companies'), {
    peerMap: PEER_MAP,
    fallback: FALLBACK_COMPANIES,
    updatedAt: now,
  });
  for (const venue of VENUES) {
    batch.set(db.collection('venues').doc(venue.id), { ...venue, seeded: true });
  }
  await batch.commit();
  process.stdout.write(`  refdata: 3 docs, ${VENUES.length} venues\n`);
}

/**
 * Auth accounts so the demo can actually sign in. Best effort: if Email/Password is
 * not enabled yet, the seed still succeeds and says so.
 */
async function writeAuthUsers(fixtures: Fixture[]): Promise<void> {
  const auth = adminAuth();
  let created = 0;
  for (const fixture of fixtures) {
    try {
      await auth.createUser({
        uid: fixture.uid,
        email: fixture.email,
        password: 'warmintro-demo',
        displayName: `${fixture.profile.first} ${fixture.profile.last}`,
      });
      created += 1;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/uid-already-exists' || code === 'auth/email-already-exists') continue;
      process.stdout.write(`  auth accounts skipped: ${(error as Error).message}\n`);
      return;
    }
  }
  process.stdout.write(`  auth accounts: ${created} created (password: warmintro-demo)\n`);
}

async function main(): Promise<void> {
  process.stdout.write(`seeding project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

  if (RESET) await reset();

  const viewer = demoViewer();
  const counterpart = demoCounterpart();
  const population = generatePopulation(COUNT);
  const everyone = [viewer, counterpart, ...population];

  await writeRefdata();
  await writeUsers(everyone);
  await writeInboundLikes(population.slice(2, 8));
  await writeScenarios(population);
  await writeAuthUsers([viewer, counterpart]);

  process.stdout.write(`\ndone. sign in as ${viewer.email} / warmintro-demo\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
});
