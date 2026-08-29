'use client';

import { use, useCallback, useEffect, useState } from 'react';
import type { Profile } from '@/lib/schemas/profile';

/**
 * Onboarding shell (spec section 2).
 *
 * UNSTYLED AND DELIBERATELY INCOMPLETE. The real five-step flow — photo slots, the
 * State/City pair, the doors card, the multi-select grids — is E15, blocked on the
 * HTML mocks (CLAUDE.md section 2).
 *
 * What this does do is exercise the whole persistence path for real: PATCH per step,
 * the gate label on the disabled button, "Save & exit", and publish. So the backend
 * is provably finished before any of it gets dressed.
 */

type MeResponse = {
  profile: Profile;
  onboarding: { step: number; completed: boolean };
  steps: { step: number; status: string; label: string }[];
};

const FIELDS: { key: keyof Profile; label: string; step: number }[] = [
  { key: 'first', label: 'First name', step: 1 },
  { key: 'last', label: 'Last name', step: 1 },
  { key: 'headline', label: 'Headline', step: 1 },
  { key: 'city', label: 'City (as "Austin, TX")', step: 1 },
  { key: 'company', label: 'Company', step: 2 },
  { key: 'role', label: 'Title', step: 2 },
  { key: 'industry', label: 'Industry', step: 2 },
  { key: 'lane', label: 'Function', step: 2 },
  { key: 'bio', label: 'Short bio', step: 4 },
];

export default function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: rawStep } = use(params);
  const step = Number(rawStep) || 1;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const fetchMe = useCallback(async (): Promise<MeResponse> => {
    const response = await fetch('/api/me');
    const body: unknown = await response.json();
    if (!response.ok) throw new Error((body as { error?: string }).error ?? 'Not signed in.');
    return body as MeResponse;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setDraft(
          Object.fromEntries(FIELDS.map((f) => [f.key, String(data.profile[f.key] ?? '')])),
        );
      })
      .catch((caught: unknown) => {
        if (!cancelled) setMessage((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  async function save(nextStep?: number) {
    const patch = Object.fromEntries(
      FIELDS.filter((f) => f.step === step).map((f) => [f.key, draft[f.key] ?? '']),
    );

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch, step: nextStep ?? step }),
    });
    const body: unknown = await response.json();

    if (!response.ok) {
      setMessage((body as { error?: string }).error ?? 'Could not save.');
      return;
    }

    setMessage('Saved.');
    setMe(await fetchMe());
  }

  async function publish() {
    const response = await fetch('/api/profile/publish', { method: 'POST' });
    const body: unknown = await response.json();
    setMessage(
      response.ok ? 'Published. You are now in other people’s decks.' : ((body as { error?: string }).error ?? 'Could not publish.'),
    );
  }

  if (!me) return <main>{message ?? 'Loading...'}</main>;

  const gate = me.steps.find((s) => s.step === step);
  const fields = FIELDS.filter((field) => field.step === step);

  return (
    <main>
      <h1>Onboarding — step {step} of 5</h1>

      <ol>
        {me.steps.map((s) => (
          <li key={s.step}>
            <a href={`/onboarding/${s.step}`}>
              Step {s.step}: {s.status}
            </a>
          </li>
        ))}
      </ol>

      {fields.length === 0 ? <p>Nothing to fill in on this step yet.</p> : null}

      {fields.map((field) => (
        <label key={String(field.key)}>
          {field.label}
          <input
            value={draft[field.key] ?? ''}
            onChange={(event) =>
              setDraft((current) => ({ ...current, [field.key]: event.target.value }))
            }
          />
        </label>
      ))}

      <button type="button" onClick={() => void save()}>
        Save &amp; exit
      </button>

      {/* The disabled label states what is missing — spec section 3. */}
      <button
        type="button"
        disabled={!gate || gate.status === 'Needs work'}
        onClick={() => void save(Math.min(step + 1, 5))}
      >
        {gate?.label ?? 'Continue'}
      </button>

      {step === 5 ? (
        <button type="button" onClick={() => void publish()}>
          Publish
        </button>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
