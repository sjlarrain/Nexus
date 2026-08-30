/**
 * Read-only health check over the stored data (BACKLOG E1b.10).
 *
 *   npm run doctor
 *
 * Written after a schema change shipped that every existing document failed —
 * `profileSchema` is validated on read, so a document that no longer parses takes out
 * `/api/me` and with it the profile and onboarding screens, for that user only, long
 * after the deploy. Unit tests cannot see that: they test the schema, not the rows.
 *
 * This walks what is actually in Firestore and answers three questions: does every
 * profile still parse, where would each user land at sign-in, and does each real
 * account have enough inbound likes to test with.
 *
 * Read-only unless `--fix` is passed, which backfills seeded likes for real accounts
 * that published before auto-liking existed, or whose likes a reseed removed.
 */
import { adminDb } from '@/server/firebase/admin';
import { profileSchema } from '@/lib/schemas/profile';
import { landingRouteFor } from '@/lib/onboarding/landing';
import { canPublish } from '@/lib/onboarding/gates';
import { DEMO_LIKE_SHARE } from '@/lib/matching/demo-plan';
import { ensureDemoMatches } from '@/server/users/demo-matches';
import type { UserRecord } from '@/server/users/ensure-user';

const db = adminDb();
const FIX = process.argv.slice(2).includes('--fix');

type Row = {
  uid: string;
  seeded: boolean;
  completed: boolean;
  parses: boolean;
  problems: string[];
  landing: string;
  matches: number;
  likes: number;
};

function issuesFor(uid: string, data: unknown): string[] {
  const parsed = profileSchema.safeParse(data);
  if (parsed.success) return [];
  return parsed.error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

async function backfill(): Promise<void> {
  const users = await db.collection('users').get();
  const targets = users.docs.filter((doc) => {
    const data = doc.data() as UserRecord & { seeded?: boolean };
    return data.seeded !== true && data.onboarding?.completed === true;
  });

  process.stdout.write(`backfilling seeded likes for ${targets.length} real account(s)...\n`);
  for (const doc of targets) {
    const result = await ensureDemoMatches(doc.id, { force: true });
    const note = result.skipped ? ' (skipped)' : '';
    process.stdout.write(`  ${doc.id}: ${result.likes} likes${note}\n`);
  }
}

async function main(): Promise<void> {
  if (FIX) await backfill();

  const [users, matches, inbox] = await Promise.all([
    db.collection('users').get(),
    db.collection('matches').get(),
    db.collectionGroup('likes').get(),
  ]);

  const matchesByUid = new Map<string, number>();
  for (const doc of matches.docs) {
    const participants = (doc.data() as { participants?: string[] }).participants ?? [];
    for (const uid of participants) matchesByUid.set(uid, (matchesByUid.get(uid) ?? 0) + 1);
  }

  const likesByUid = new Map<string, number>();
  for (const doc of inbox.docs) {
    // inbox/{uid}/likes/{fromUid}
    const owner = doc.ref.parent.parent?.id;
    if (owner) likesByUid.set(owner, (likesByUid.get(owner) ?? 0) + 1);
  }

  const rows: Row[] = users.docs.map((doc) => {
    const data = doc.data() as UserRecord & { seeded?: boolean };
    const problems = issuesFor(doc.id, data);
    return {
      uid: doc.id,
      seeded: data.seeded === true,
      completed: data.onboarding?.completed === true,
      parses: problems.length === 0,
      problems,
      landing: landingRouteFor(data),
      matches: matchesByUid.get(doc.id) ?? 0,
      likes: likesByUid.get(doc.id) ?? 0,
    };
  });

  const seeded = rows.filter((row) => row.seeded);
  const real = rows.filter((row) => !row.seeded);
  const broken = rows.filter((row) => !row.parses);

  const out = process.stdout;
  out.write(`\nusers: ${rows.length} (${seeded.length} seeded, ${real.length} real)\n`);
  out.write(`matches: ${matches.size}   inbound likes: ${inbox.size}\n`);

  out.write(`\nprofiles that no longer parse: ${broken.length}\n`);
  for (const row of broken) {
    out.write(`  ✗ ${row.uid}${row.seeded ? ' (seeded)' : ''}\n`);
    for (const problem of row.problems) out.write(`      ${problem}\n`);
  }

  out.write('\nreal accounts\n');
  if (real.length === 0) out.write('  (none yet)\n');
  for (const row of real) {
    const publishable = row.parses
      ? canPublish(profileSchema.parse(users.docs.find((d) => d.id === row.uid)?.data())).ok
      : false;
    out.write(
      `  ${row.parses ? '✓' : '✗'} ${row.uid}` +
        `  completed=${row.completed}  publishable=${publishable}` +
        `  landing=${row.landing}  matches=${row.matches}  likes=${row.likes}\n`,
    );
  }

  const eligible = seeded.filter((row) => row.completed).length;
  const want = Math.ceil(eligible * DEMO_LIKE_SHARE);
  out.write(`\nseeded-like target: ${want} of ${eligible} published seed users per account\n`);

  // Matches are no longer seeded — they are earned by swiping — so coverage is counted
  // on inbound likes. An account that has worked through part of its Likes screen has
  // consumed those likes into matches, which is the point, so count both.
  const reached = (row: Row): number => row.likes + row.matches;

  const underLiked = real
    .filter((entry) => entry.completed)
    .filter((entry) => reached(entry) < want);

  for (const row of real.filter((entry) => entry.completed)) {
    const ok = reached(row) >= want;
    out.write(
      `  ${ok ? '✓' : '✗'} ${row.uid}: ${row.likes} likes + ${row.matches} matches ` +
        `(want >= ${want})\n`,
    );
  }
  if (underLiked.length > 0) {
    out.write('  run `npm run doctor -- --fix` to backfill\n');
  }

  const failed = broken.length > 0 || underLiked.length > 0;
  out.write(`\n${failed ? 'FAIL' : 'OK'}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
