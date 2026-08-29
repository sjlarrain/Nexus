'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Badge, Card, Chip, Eyebrow, PrimaryButton, Quote, hatchClass } from '@/components/ui';
import { LIMITS, PROMPT_HINT, PROMPT_KEYS, PROMPT_LABELS } from '@/lib/refdata/constants';
import type { Card as CardType } from '@/lib/cards/card';
import type { Profile } from '@/lib/schemas/profile';
import styles from './profile.module.css';

/**
 * Profile screen (spec section 1: "Card preview, reply rate, editable prompts, entry
 * to onboarding") — BACKLOG E11.1, E11.2, E11.3.
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
  const [me, setMe] = useState<Me | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        <h1 className={styles.heading}>Your card</h1>
        <p className={styles.sub}>This is exactly what other people see.</p>

        <Card className={styles.preview}>
          <div className={`${styles.previewPhoto} ${hatchClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo.url} alt="" /> : null}
            {card.badge ? <Badge className={styles.previewBadge}>{card.badge}</Badge> : null}
          </div>
          <div className={styles.previewBody}>
            <h2 className={styles.name}>{card.name}</h2>
            <p className={styles.role}>{card.roleLine}</p>
            {card.headline ? <Quote>{card.headline}</Quote> : null}
            <div className={styles.tags}>
              {card.tags.map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
              <Chip>
                {card.photos.length} of {LIMITS.photos} photos
              </Chip>
            </div>
          </div>
        </Card>

        <Eyebrow>Reply rate</Eyebrow>
        <div className={styles.sectionLabel} />
        <div className={styles.rate}>
          {replyRate.label ? (
            <>
              <span className={styles.rateValue}>{replyRate.label}</span>
              <p className={styles.rateNote}>
                You replied to {replyRate.replied} of the {replyRate.opened} conversations someone
                started with you.
              </p>
            </>
          ) : (
            <p className={styles.rateNote}>
              Nobody has opened a conversation with you yet, so there is no rate to show.
            </p>
          )}
        </div>

        <Eyebrow>Prompts</Eyebrow>
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
