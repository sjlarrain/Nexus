/**
 * Reads the seeded database and prints the deck Jordan would actually see, with the
 * score breakdown for each card (BACKLOG E1b.8).
 *
 * This is the end-to-end check that the fixtures, the ranking, and Firestore agree:
 * everything here comes back out of the database, nothing is generated in memory.
 *
 *   npm run demo:deck
 */
import { adminDb } from '@/server/firebase/admin';
import { DEMO_VIEWER_UID } from '@/lib/fixtures/generate';
import { rankDeck, type Candidate } from '@/lib/deck/rank';
import { roleLineFor } from '@/lib/cards/card';
import { profileSchema, type Profile } from '@/lib/schemas/profile';
import { suggest } from '@/lib/chat/suggest';
import type { Message } from '@/lib/schemas/entities';

const db = adminDb();

type UserRow = Profile & { stats?: { lastActiveAt: number | null } };

async function loadViewer(): Promise<Profile> {
  const snapshot = await db.collection('users').doc(DEMO_VIEWER_UID).get();
  const data = snapshot.data();
  if (!data) throw new Error(`${DEMO_VIEWER_UID} is not in the database. Run npm run seed first.`);
  return profileSchema.parse(data);
}

async function loadCandidates(): Promise<Candidate[]> {
  const snapshot = await db.collection('users').get();
  const out: Candidate[] = [];

  for (const doc of snapshot.docs) {
    if (doc.id === DEMO_VIEWER_UID) continue;
    const row = doc.data() as UserRow;
    const parsed = profileSchema.safeParse(row);
    if (!parsed.success) {
      process.stdout.write(`  ! ${doc.id} failed schema validation\n`);
      continue;
    }
    out.push({ uid: doc.id, profile: parsed.data, lastActiveAt: row.stats?.lastActiveAt ?? null });
  }

  return out;
}

/** Already-swiped people must never come back round (docs/architecture.md section 5). */
async function loadSwiped(): Promise<Set<string>> {
  const snapshot = await db.collection('swipes').where('from', '==', DEMO_VIEWER_UID).get();
  return new Set(snapshot.docs.map((doc) => (doc.data() as { to: string }).to));
}

async function showDeck(): Promise<void> {
  const viewer = await loadViewer();
  const swiped = await loadSwiped();
  const candidates = (await loadCandidates()).filter((c) => !swiped.has(c.uid));

  process.stdout.write(`\nDECK for ${viewer.first} ${viewer.last} (${roleLineFor(viewer)})\n`);
  process.stdout.write(`  targeting: ${viewer.targetCompanies.join(', ')}\n`);
  process.stdout.write(`  ${candidates.length} candidates after excluding ${swiped.size} already swiped\n\n`);

  for (const card of rankDeck(viewer, candidates, { seed: 1 }).slice(0, 8)) {
    const s = card.score;
    process.stdout.write(
      `  ${String(Math.round(s.total)).padStart(3)}  ${card.profile.first} ${card.profile.last}\n`,
    );
    process.stdout.write(`       ${roleLineFor(card.profile)}\n`);
    process.stdout.write(
      `       doors ${s.doorOverlap} · direction ${s.directionComplement} · industry ${s.industryOverlap} · function ${s.laneOverlap} · city ${s.sameCity} · recency ${s.recency}\n`,
    );
    if (card.profile.referCompanies.length) {
      process.stdout.write(`       can open: ${card.profile.referCompanies.join(', ')}\n`);
    }
    process.stdout.write('\n');
  }
}

async function showLikes(): Promise<void> {
  const snapshot = await db
    .collection('inbox')
    .doc(DEMO_VIEWER_UID)
    .collection('likes')
    .get();

  process.stdout.write(`LIKES waiting for ${DEMO_VIEWER_UID}: ${snapshot.size}\n`);

  // Sorted here rather than in the query: an inbox is small enough that the round
  // trip costs more than the sort. The composite index exists either way, so
  // GET /api/likes can order in Firestore once paging matters.
  const likes = snapshot.docs
    .map((doc) => doc.data() as { fromUid: string; priority: boolean; createdAt: number })
    .sort((a, b) => Number(b.priority) - Number(a.priority) || b.createdAt - a.createdAt);

  for (const like of likes) {
    const person = await db.collection('users').doc(like.fromUid).get();
    const profile = person.data() as Profile | undefined;
    process.stdout.write(
      `  ${like.priority ? '^ priority' : '  yes     '}  ${profile?.first ?? '?'} ${profile?.last ?? ''} — ${profile ? roleLineFor(profile) : ''}\n`,
    );
  }
  process.stdout.write('\n');
}

async function showChats(): Promise<void> {
  const snapshot = await db
    .collection('matches')
    .where('participants', 'array-contains', DEMO_VIEWER_UID)
    .get();

  process.stdout.write(`MATCHES: ${snapshot.size}\n`);

  for (const doc of snapshot.docs) {
    const match = doc.data() as { participants: [string, string]; bookingId: string | null };
    const otherUid = match.participants.find((uid) => uid !== DEMO_VIEWER_UID) ?? '?';
    const other = (await db.collection('users').doc(otherUid).get()).data() as Profile | undefined;

    const messageDocs = await doc.ref.collection('messages').orderBy('createdAt').get();
    const messages = messageDocs.docs.map((m) => m.data() as Message);

    const suggestions = suggest({
      messages,
      meUid: DEMO_VIEWER_UID,
      theirName: other?.first,
      booked: match.bookingId !== null,
    });

    process.stdout.write(`\n  with ${other?.first ?? otherUid} — ${messages.length} messages`);
    process.stdout.write(match.bookingId ? ' · coffee booked\n' : '\n');
    if (messages.length > 0) {
      process.stdout.write(`    last: "${messages[messages.length - 1]?.text ?? ''}"\n`);
    }
    process.stdout.write(`    suggest() fired rule: ${suggestions[0]?.rule}\n`);
    for (const suggestion of suggestions) {
      process.stdout.write(`      ${suggestion.pinned ? '*' : '-'} ${suggestion.text}\n`);
    }
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  await showDeck();
  await showLikes();
  await showChats();
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
});
