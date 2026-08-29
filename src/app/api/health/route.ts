import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminStatus = 'ok' | 'missing' | 'unreadable' | 'unloadable';

/**
 * Liveness and configuration probe.
 *
 * Reports *whether* each piece of configuration is usable, never what it contains —
 * no values, no error messages, since either could carry a credential
 * (CLAUDE.md section 7).
 *
 * This exists because a missing `FIREBASE_SERVICE_ACCOUNT_B64` makes every route that
 * touches Firestore return an opaque 500 while the pages still render, which reads
 * like a broken app rather than an unset variable. One curl now says which it is.
 */
export async function GET() {
  /*
   * The admin SDK is loaded lazily, inside a try. A static import made this route die
   * from the very failure it exists to report: on the first Vercel deploy every route
   * that imports the admin module returned a bare 500, health included, so the probe
   * could say nothing about why. `unloadable` is that case — the module itself throws
   * on import (a missing optional dependency, or a Node version below firebase-admin's
   * floor of 22), which is a different problem from an unset variable.
   */
  let adminCredential: AdminStatus;
  try {
    const admin = await import('@/server/firebase/admin');
    adminCredential = admin.adminCredentialStatus();
  } catch {
    adminCredential = 'unloadable';
  }

  // Only the presence of each public key, never the value.
  const missingPublicConfig = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ].filter((key) => !process.env[key]);

  const ok = adminCredential === 'ok' && missingPublicConfig.length === 0;

  return NextResponse.json(
    {
      ok,
      service: 'warm-intro',
      adminCredential,
      // Presence only. Reported separately because `unloadable` hides whether the
      // variable was ever set.
      serviceAccountSet: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64),
      missingPublicConfig,
      usingEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS === 'true',
      // Which build is actually serving, and on what. Both are the first questions
      // asked when the live site disagrees with the local one; neither is a secret.
      node: process.version,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
