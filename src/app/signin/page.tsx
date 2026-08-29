'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Eyebrow, Input, PrimaryButton } from '@/components/ui';
import {
  authErrorMessage,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/firebase/auth-client';
import styles from './signin.module.css';

/**
 * Onboarding step 0 (spec section 2). Shares the one-question-per-screen frame of
 * mock 1g, since it is the first step of the same flow.
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

  const signingIn = mode === 'in';

  return (
    <main className={styles.frame}>
      <span className={styles.brand}>
        <span className={styles.brandName}>Warm Intro</span>
        <span className={styles.brandBeta}>BETA</span>
      </span>

      <h1 className={styles.heading}>
        {signingIn ? 'Welcome back.' : 'Let us build your card.'}
      </h1>
      <p className={styles.sub}>
        {signingIn
          ? 'Referrals work best between people who have actually met.'
          : 'Three photos and a few questions. About four minutes.'}
      </p>

      <button
        type="button"
        className={styles.google}
        disabled={busy}
        onClick={() => void run(signInWithGoogle)}
      >
        Continue with Google
      </button>

      <div className={styles.divider}>
        <Eyebrow>or</Eyebrow>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            signingIn ? signInWithEmail(email, password) : signUpWithEmail(email, password),
          );
        }}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            autoComplete={signingIn ? 'current-password' : 'new-password'}
            required
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <PrimaryButton
          type="submit"
          disabled={busy}
          label={busy ? 'Working…' : signingIn ? 'Sign in' : 'Create account'}
        />
      </form>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => setMode(signingIn ? 'up' : 'in')}
        >
          {signingIn ? 'I need an account' : 'I already have an account'}
        </button>

        <button
          type="button"
          className={styles.linkButton}
          disabled={busy || email.length === 0}
          onClick={() => {
            void resetPassword(email)
              .then(() => setNotice('Check your email for a reset link.'))
              .catch((caught: unknown) => setError(authErrorMessage(caught)));
          }}
        >
          Reset password
        </button>
      </div>

      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {/* Demo account, so nobody has to be told it out loud on the day. */}
      <p className={styles.demo}>
        demo · jordan.reyes@warmintro.test · warmintro-demo
      </p>
    </main>
  );
}
