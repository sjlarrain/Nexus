'use client';

import { useCallback, useEffect, useState } from 'react';
import { PROMPT_KEYS, PROMPT_LABELS, PROMPT_HINT, LIMITS } from '@/lib/refdata/constants';
import type { Card } from '@/lib/cards/card';
import type { Profile } from '@/lib/schemas/profile';

/**
 * Profile screen (spec section 1: "Card preview, reply rate, editable prompts, entry
 * to onboarding") — BACKLOG E11.1, E11.2, E11.3.
 *
 * UNSTYLED ON PURPOSE (CLAUDE.md section 2).
 */

type Me = {
  uid: string;
  card: Card;
  profile: Profile;
  onboarding: { step: number; completed: boolean; publishedAt: number | null };
  replyRate: { rate: number | null; opened: number; replied: number; label: string | null };
  steps: { step: number; status: string; label: string }[];
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

  async function savePrompts() {
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
      <main role="alert">
        {error} — <a href="/signin">sign in</a>
      </main>
    );
  }
  if (!me) return <main>Loading...</main>;

  const { card, replyRate } = me;

  return (
    <main>
      <h1>Your profile</h1>
      <p>
        <a href="/deck">Back to the deck</a>
      </p>

      <h2>Card preview</h2>
      <p>This is exactly what other people see.</p>
      <section>
        {card.badge ? <p>{card.badge}</p> : null}
        <h3>{card.name}</h3>
        <p>{card.roleLine}</p>
        <p>{card.headline}</p>
        <p>
          {card.photos.length} of {LIMITS.photos} photos
        </p>
        {card.tags.length > 0 ? <p>{card.tags.join(' · ')}</p> : null}
        {card.doors.length > 0 ? <p>Can open doors at: {card.doors.join(', ')}</p> : null}
        {card.openTo.length > 0 ? <p>Open to: {card.openTo.join(', ')}</p> : null}
      </section>

      <h2>Reply rate</h2>
      {replyRate.label ? (
        <p>
          {replyRate.label} — you replied to {replyRate.replied} of the {replyRate.opened}{' '}
          conversations someone started with you.
        </p>
      ) : (
        <p>Nobody has opened a conversation with you yet, so there is no rate to show.</p>
      )}

      <h2>Prompts</h2>
      <p>{PROMPT_HINT}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void savePrompts();
        }}
      >
        {PROMPT_KEYS.map((key) => (
          <p key={key}>
            <label>
              {PROMPT_LABELS[key]}
              <textarea
                value={prompts[key] ?? ''}
                maxLength={300}
                onChange={(event) =>
                  setPrompts((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          </p>
        ))}
        <button type="submit" disabled={saving}>
          Save prompts
        </button>
      </form>
      {status ? <p role="status">{status}</p> : null}

      <h2>Everything else</h2>
      <ul>
        {me.steps.map((step) => (
          <li key={step.step}>
            <a href={`/onboarding/${step.step}`}>Step {step.step}</a> — {step.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
