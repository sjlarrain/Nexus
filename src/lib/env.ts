import { z } from 'zod';

/**
 * Public configuration. Safe to ship to the browser.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when it sees the literal
 * property access, so every key is spelled out here rather than looped over.
 */
const publicEnvSchema = z.object({
  apiKey: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_API_KEY is missing'),
  authDomain: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing'),
  projectId: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing'),
  storageBucket: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing'),
  messagingSenderId: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing'),
  appId: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_APP_ID is missing'),
  useEmulators: z.boolean(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

const raw = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  useEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS === 'true',
};

let cached: PublicEnv | null = null;

/** Throws with a readable list of missing keys instead of a vague Firebase error. */
export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.message).join('\n  ');
    throw new Error(`Firebase client config is incomplete. Copy .env.example to .env.local.\n  ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
