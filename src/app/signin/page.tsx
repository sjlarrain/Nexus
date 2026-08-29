'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  authErrorMessage,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/firebase/auth-client';

/**
 * Onboarding step 0 (spec section 2).
 *
 * UNSTYLED ON PURPOSE. The visual language arrives with the HTML mocks (CLAUDE.md
 * section 2); this exists only so the auth flow can be exercised by a human. Every
 * element here is expected to be replaced, not restyled.
 */
export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<{ next: string }>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { next } = await action();
      // `next` is decided by the server, so typedRoutes cannot know it statically.
      router.push(next as Route);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Warm Intro</h1>
      <p>{mode === 'in' ? 'Sign in' : 'Create an account'}</p>

      <button type="button" disabled={busy} onClick={() => void run(signInWithGoogle)}>
        Continue with Google
      </button>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            mode === 'in' ? signInWithEmail(email, password) : signUpWithEmail(email, password),
          );
        }}
      >
        <label>
          Email
          <input
            type="email"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Working...' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'I need an account' : 'I already have an account'}
      </button>

      <button
        type="button"
        disabled={busy || email.length === 0}
        onClick={() => {
          void resetPassword(email)
            .then(() => setNotice('Check your email for a reset link.'))
            .catch((caught: unknown) => setError(authErrorMessage(caught)));
        }}
      >
        Reset password
      </button>

      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </main>
  );
}
