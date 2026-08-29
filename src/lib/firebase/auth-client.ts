'use client';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type UserCredential,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * Client-side sign-in (BACKLOG E2.1).
 *
 * The pattern throughout: authenticate with the Firebase JS SDK, then hand the
 * resulting ID token to our own `/api/auth/session` once. From then on the httpOnly
 * session cookie is what identifies the user to the server — the SDK session only
 * matters for realtime Firestore reads.
 */

export type SignInResult = {
  uid: string;
  isNewUser: boolean;
  /** Where to send them: onboarding at the saved step, or the deck. */
  next: string;
};

async function exchangeForSession(credential: UserCredential): Promise<SignInResult> {
  const idToken = await credential.user.getIdToken();

  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    const message = (body as { error?: string }).error ?? 'Sign-in failed.';
    throw new Error(message);
  }

  return body as SignInResult;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  const provider = new GoogleAuthProvider();
  return exchangeForSession(await signInWithPopup(firebaseAuth(), provider));
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  return exchangeForSession(await signInWithEmailAndPassword(firebaseAuth(), email, password));
}

export async function signUpWithEmail(email: string, password: string): Promise<SignInResult> {
  return exchangeForSession(await createUserWithEmailAndPassword(firebaseAuth(), email, password));
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email);
}

/** Clears both halves of the session: the SDK's, and our cookie. */
export async function signOut(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' });
  await firebaseSignOut(firebaseAuth());
}

/**
 * Firebase error codes are not user-facing. This maps the ones a sign-in form can
 * actually produce; anything else falls through to the raw message.
 */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in.';
    case 'auth/weak-password':
      return 'Pick a password of at least six characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return error instanceof Error ? error.message : 'Sign-in failed.';
  }
}
