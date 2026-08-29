/**
 * Connectivity check for the real Firebase project. Read-only: it never writes.
 * Run with: npm run check:firebase
 */
import { adminAuth, adminDb, adminBucket } from '@/server/firebase/admin';

type Check = { name: string; ok: boolean; detail: string };

async function run(): Promise<void> {
  const checks: Check[] = [];

  try {
    const users = await adminAuth().listUsers(1);
    checks.push({ name: 'Auth', ok: true, detail: `reachable, ${users.users.length} user(s) so far` });
  } catch (error) {
    checks.push({ name: 'Auth', ok: false, detail: (error as Error).message });
  }

  try {
    await adminDb().collection('refdata').limit(1).get();
    checks.push({ name: 'Firestore', ok: true, detail: 'reachable' });
  } catch (error) {
    const message = (error as Error).message;
    const notCreated = message.includes('NOT_FOUND') || message.includes('does not exist');
    checks.push({
      name: 'Firestore',
      ok: false,
      detail: notCreated ? 'database not created yet — Firebase console > Firestore > Create database' : message,
    });
  }

  try {
    const [exists] = await adminBucket().exists();
    checks.push({
      name: 'Storage',
      ok: exists,
      detail: exists ? 'bucket reachable' : 'bucket missing — Firebase console > Storage > Get started',
    });
  } catch (error) {
    checks.push({ name: 'Storage', ok: false, detail: (error as Error).message });
  }

  for (const check of checks) {
    console.log(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.name.padEnd(10)} ${check.detail}`);
  }

  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}

void run();
