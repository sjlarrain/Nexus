'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Badge, Chip, GhostButton, PrimaryButton, Quote } from '@/components/ui';
import PublishedMoment from '@/components/PublishedMoment';
import { Step1, Step2, Step3, Step4, Step5, STEP_HEADINGS } from '../steps';
import { allStepsComplete, canPublish, gateForStep } from '@/lib/onboarding/gates';
import { toCard } from '@/lib/cards/card';
import type { Profile } from '@/lib/schemas/profile';
import styles from '../onboarding.module.css';

/**
 * Onboarding (spec section 2), in the shape of mock 1g.
 *
 * The gate runs on the client from the same pure function the server uses, so the
 * Continue button names what is missing as you type rather than after a round trip.
 * The server still re-validates on publish — the client gate is a courtesy, not the
 * authority (docs/architecture.md).
 */

type MeResponse = {
  uid: string;
  profile: Profile;
  onboarding: { step: number; completed: boolean };
  steps: { step: number; status: string; label: string }[];
};

const LAST_STEP = 5;

export default function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: rawStep } = use(params);
  const step = Math.min(Math.max(Number(rawStep) || 1, 1), LAST_STEP);
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [edits, setEdits] = useState<Partial<Profile>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const step1FlushRef = useRef<(() => Partial<Profile> | undefined) | null>(null);

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
        if (!cancelled) setMe(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setMessage((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  // Server truth with local edits on top, so gates see what the user can see.
  const draft = useMemo<Profile | null>(
    () => (me ? { ...me.profile, ...edits } : null),
    [me, edits],
  );

  function patch(fields: Partial<Profile>): void {
    setEdits((current) => ({ ...current, ...fields }));
    setMessage(null);
  }

  async function save(nextStep: number, extra?: Partial<Profile>): Promise<boolean> {
    setBusy(true);
    try {
      // `extra` (e.g. a school typed but never explicitly "Save school"-ed) is folded
      // in directly rather than relied on via `patch()` + `edits`, since the state
      // update from `patch()` would not be visible in this closure's `edits` yet.
      const patch = { ...edits, ...extra };
      // A published user editing their card is not walking through onboarding, and
      // `patchProfile` rejects a step change once `onboarding.completed` is set. So
      // the resume pointer is only sent while it still means something.
      const payload = me?.onboarding.completed
        ? { patch }
        : { patch, step: nextStep };

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        setMessage((body as { error?: string }).error ?? 'Could not save.');
        return false;
      }
      setMe(await fetchMe());
      setEdits({});
      return true;
    } finally {
      setBusy(false);
    }
  }

  /** Both ways out of the publish popup — the button and the five-second timeout. */
  const toDeck = useCallback(() => router.push('/deck'), [router]);

  async function publish(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch('/api/profile/publish', { method: 'POST' });
      const body: unknown = await response.json();
      if (!response.ok) {
        setMessage((body as { error?: string }).error ?? 'Could not publish.');
        return;
      }
      setPublished(true);
    } finally {
      setBusy(false);
    }
  }

  if (!draft || !me) {
    return (
      <main className={styles.frame}>
        <p className={styles.sub}>{message ?? 'Loading…'}</p>
      </main>
    );
  }

  const heading = STEP_HEADINGS[step] ?? STEP_HEADINGS[1];
  // Spec: once every section is green, Continue returns to the review rather than
  // walking the user through steps they have already finished.
  const nextStep = allStepsComplete(draft) ? LAST_STEP : step + 1;
  const gate = step === LAST_STEP ? canPublish(draft) : gateForStep(step, draft);
  const card = toCard(me.uid, draft);

  return (
    <main className={styles.frame}>
      <div className={styles.steps}>
        {[1, 2, 3, 4, 5].map((index) => (
          <span key={index} className={index <= step ? styles.stepOn : undefined} />
        ))}
      </div>

      <span className={styles.sub} style={{ margin: 0 }}>
        Step {step} of {LAST_STEP}
      </span>
      <h1 className={styles.heading}>{heading?.title}</h1>
      <p className={styles.sub}>{heading?.sub}</p>

      <div className={styles.body}>
        {step === 1 ? <Step1 draft={draft} patch={patch} flushRef={step1FlushRef} /> : null}
        {step === 2 ? <Step2 draft={draft} patch={patch} /> : null}
        {step === 3 ? <Step3 draft={draft} patch={patch} /> : null}
        {step === 4 ? <Step4 draft={draft} patch={patch} /> : null}
        {step === LAST_STEP ? (
          <>
            <article
              style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-card)',
                padding: 16,
                marginBottom: 18,
              }}
            >
              {card.badge ? <Badge>{card.badge}</Badge> : null}
              <h2 style={{ fontFamily: 'var(--display)', fontSize: 25, margin: '10px 0 0' }}>
                {card.name}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '2px 0 10px' }}>
                {card.roleLine}
              </p>
              {card.headline ? <Quote>{card.headline}</Quote> : null}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {card.tags.map((tag) => (
                  <Chip key={tag}>{tag}</Chip>
                ))}
              </div>
            </article>
            <Step5 draft={draft} patch={patch} steps={me.steps} />
          </>
        ) : null}
      </div>

      {message ? (
        <p className={styles.status} role="status">
          {message}
        </p>
      ) : null}

      <div className={styles.nav}>
        {step > 1 ? (
          <button
            type="button"
            className={styles.back}
            onClick={() => router.push(`/onboarding/${step - 1}` as Route)}
          >
            Back
          </button>
        ) : null}

        {step === LAST_STEP ? (
          <PrimaryButton
            className={styles.next}
            label="Publish my card"
            gate={gate}
            disabled={busy}
            onClick={() => void publish()}
          />
        ) : (
          <PrimaryButton
            className={styles.next}
            label="Continue"
            gate={gate}
            disabled={busy}
            onClick={async () => {
              const extra = step === 1 ? (step1FlushRef.current?.() ?? undefined) : undefined;
              if (extra) patch(extra);
              if (await save(nextStep, extra)) router.push(`/onboarding/${nextStep}` as Route);
            }}
          />
        )}
      </div>

      <GhostButton
        className={styles.saveExit}
        disabled={busy}
        onClick={async () => {
          const extra = step === 1 ? (step1FlushRef.current?.() ?? undefined) : undefined;
          if (extra) patch(extra);
          if (await save(step, extra)) setMessage('Saved. You can pick this up later.');
        }}
      >
        Save &amp; exit
      </GhostButton>

      {published ? <PublishedMoment onDismiss={toDeck} /> : null}
    </main>
  );
}
