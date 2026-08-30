'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Eyebrow, PrimaryButton, hatchClass } from '@/components/ui';
import { firebaseAuth } from '@/lib/firebase/client';
import { LIMITS, PROMPT_HINT, PROMPT_KEYS, PROMPT_LABELS } from '@/lib/refdata/constants';
import type { Card as CardType } from '@/lib/cards/card';
import type { Profile } from '@/lib/schemas/profile';
import styles from './profile.module.css';

/**
 * Profile screen (spec section 1: "Card preview, reply rate, editable prompts, entry
 * to onboarding") — BACKLOG E11.1, E11.2, E11.3.
 *
 * Laid out after docs/mocks/planup-profile.unpacked.html: the photo set first, then
 * who you are, then the one number that matters, then the prompts. The mock's own
 * "Edit profile" and "Log out" are 11px text links; they are buttons here because the
 * owner asked for them as CTAs — and editing is not a separate screen, it re-enters
 * onboarding, which is already the only place these fields are edited.
 */

type Me = {
  uid: string;
  card: CardType;
  profile: Profile;
  onboarding: { step: number; completed: boolean; publishedAt: number | null };
  replyRate: { rate: number | null; opened: number; replied: number; label: string | null };
  steps: { step: number; status: string; label: string }[];
};

const STEP_NAMES: Record<number, string> = {
  1: 'Who you are',
  2: 'Where you are today',
  3: 'What you are looking for',
  4: 'A little colour',
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async (): Promise<Me> => {
    const response = await fetch('/api/me');
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'Could not load your profile.');
    }
    return body as Me;
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (cancelled) return;
        setMe(next);
        setPrompts({ p1: next.profile.p1, p2: next.profile.p2, p3: next.profile.p3 });
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function savePrompts(): Promise<void> {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: prompts }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        setStatus((body as { error?: string }).error ?? 'Those did not save.');
        return;
      }
      setStatus('Saved.');
      setMe(await load());
    } finally {
      setSaving(false);
    }
  }

  /**
   * Both halves matter: the cookie is what the server trusts, and the client SDK is
   * what the chat's realtime listener uses. Leaving either behind logs you out of
   * only half the app.
   */
  async function logOut(): Promise<void> {
    setLeaving(true);
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      await signOut(firebaseAuth());
      router.push('/signin');
    } catch {
      setStatus('Could not log out. Try again.');
      setLeaving(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <p className={styles.empty} role="alert">
          {error} — <a href="/signin">sign in</a>
        </p>
      </AppShell>
    );
  }

  if (!me) {
    return (
      <AppShell>
        <p className={styles.empty}>Loading…</p>
      </AppShell>
    );
  }

  const { card, replyRate } = me;
  const photo = card.photos[0];

  return (
    <AppShell>
      <div className={styles.frame}>
        {/* The mock's photo set: the first one large, the rest beside it. */}
        <div className={styles.photos}>
          <div className={`${styles.photoLead} ${hatchClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo.url} alt="" /> : null}
            <span className={styles.photoTag}>photo 1</span>
          </div>
          <div className={styles.photoRest}>
            {[1, 2].map((index) => {
              const rest = card.photos[index];
              return (
                <div key={index} className={`${styles.photoSmall} ${hatchClass}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {rest ? <img src={rest.url} alt="" /> : null}
                  <span className={styles.photoTag}>{index + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* First and last name are not gated in step 1, so this can genuinely be
            empty — an unnamed heading reads as a broken page rather than a gap. */}
        <h1 className={styles.name}>{card.name || 'Your card'}</h1>
        <p className={styles.role}>{card.roleLine}</p>

        <div className={styles.stat}>
          <span className={styles.statValue}>{replyRate.label ?? '—'}</span>
          <span className={styles.statLabel}>Replies</span>
          <p className={styles.statNote}>
            {replyRate.label
              ? `You replied to ${replyRate.replied} of the ${replyRate.opened} conversations someone started with you.`
              : 'Nobody has opened a conversation with you yet, so there is no rate to show.'}
          </p>
        </div>

        {/* The two things you actually come to this screen to do. Editing re-enters
            onboarding rather than duplicating every field on a second screen. */}
        <div className={styles.ctas}>
          <Link href="/onboarding/1" className={styles.editCta}>
            Edit profile
          </Link>
          <button
            type="button"
            className={styles.logoutCta}
            disabled={leaving}
            onClick={() => void logOut()}
          >
            {leaving ? 'Logging out…' : 'Log out'}
          </button>
        </div>

        <Link href="/deck?tips=1" className={styles.replayTips}>
          Replay quick tips
        </Link>

        <p className={styles.photoCount}>
          {card.photos.length} of {LIMITS.photos} photos · {card.tags.length} tags on your card
        </p>

        <Eyebrow>My prompts</Eyebrow>
        <div className={styles.sectionLabel} />
        <p className={styles.sub}>{PROMPT_HINT}</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void savePrompts();
          }}
        >
          {PROMPT_KEYS.map((key) => (
            <label key={key} className={styles.prompt}>
              <Eyebrow>{PROMPT_LABELS[key]}</Eyebrow>
              <textarea
                className={styles.textarea}
                value={prompts[key] ?? ''}
                maxLength={300}
                onChange={(event) =>
                  setPrompts((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <PrimaryButton type="submit" label="Save prompts" disabled={saving} />
        </form>

        {status ? (
          <p className={styles.status} role="status">
            {status}
          </p>
        ) : null}

        <Eyebrow>Everything else</Eyebrow>
        <div className={styles.sectionLabel} />
        {me.steps
          .filter((step) => step.step <= 4)
          .map((step) => (
            <Link key={step.step} href={`/onboarding/${step.step}`} className={styles.editRow}>
              <span>{STEP_NAMES[step.step]}</span>
              <span className={styles.editState}>{step.status}</span>
            </Link>
          ))}
      </div>
    </AppShell>
  );
}
