import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { EMULATOR_PORTS } from '@/lib/firebase/emulators';

/**
 * Admin SDK. Never import this from a client component — the ESLint rule in
 * eslint.config.mjs enforces that, and `server-only` fails the build if it slips.
 *
 * Credentials come from a base64-encoded service account in the environment, never
 * from a JSON file on disk (CLAUDE.md section 7).
 */

function credentialsFromEnv() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!encoded) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_B64 is not set. Set it in .env.local, or run against the ' +
        'emulators with FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST.',
    );
  }
  const json: unknown = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  if (typeof json !== 'object' || json === null) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 did not decode to a JSON object.');
  }
  return json as { project_id: string; client_email: string; private_key: string };
}

/**
 * The emulators accept any credential, so we skip the service account entirely when
 * the emulator host vars are present. That is what lets `npm run seed` work on a
 * fresh clone with no secrets at all.
 */
function usingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST ?? process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) {
    // Invariant: initializeApp below always runs before any getApps() consumer.
    return existing[0] as App;
  }

  if (usingEmulators()) {
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'warm-intro-local',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  const sa = credentialsFromEnv();
  return initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key.replace(/\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = (): Auth => getAuth(adminApp());
export const adminDb = (): Firestore => getFirestore(adminApp());
export const adminBucket = () => getStorage(adminApp()).bucket();

/** Point a non-Next process (seed scripts, tests) at the local emulators. */
export function useEmulatorHosts(): void {
  process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${EMULATOR_PORTS.firestore}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `127.0.0.1:${EMULATOR_PORTS.auth}`;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `127.0.0.1:${EMULATOR_PORTS.storage}`;
}
