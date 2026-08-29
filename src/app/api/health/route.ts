import { NextResponse } from 'next/server';
import { adminCredentialStatus } from '@/server/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
export function GET() {
  const admin = adminCredentialStatus();

  // Only the presence of each public key, never the value.
  const publicConfig = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ].filter((key) => !process.env[key]);

  const ok = admin === 'ok' && publicConfig.length === 0;

  return NextResponse.json(
    {
      ok,
      service: 'warm-intro',
      adminCredential: admin,
      missingPublicConfig: publicConfig,
      usingEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS === 'true',
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
