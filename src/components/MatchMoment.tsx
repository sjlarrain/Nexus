'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { GhostButton, PrimaryButton } from '@/components/ui';
import type { Card } from '@/lib/cards/card';
import styles from './MatchMoment.module.css';

/**
 * Match moment, coffee-first (mock 1d).
 *
 * Spec section 1: "primary action pushes to a 30-minute coffee", so this screen is
 * the start of the booking rather than a congratulations card. Picking a slot here
 * carries it into the café screen, which is where the booking is actually created.
 *
 * Two labels from the mock are missing on purpose (docs/design.md): "he's free"
 * needs calendar availability we do not have, and "$16–$28" needs venue pricing the
 * schema does not carry. Inventing either would be a promise the app cannot keep.
 */

export default function MatchMoment({
  matchId,
  counterpart,
  onDismiss,
}: {
  matchId: string;
  counterpart: Card;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<number[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);

  const firstName = counterpart.name.split(' ')[0] ?? counterpart.name;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/matches/${matchId}/venues`)
      .then((response) => (response.ok ? (response.json() as Promise<{ suggestedSlots: number[] }>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setSlots(body.suggestedSlots);
        setChosen(body.suggestedSlots[0] ?? null);
      })
      // The sheet still works without slots; the café screen offers them again.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  function toCoffee(): void {
    const query = chosen === null ? '' : `?slot=${chosen}`;
    router.push(`/chat/${matchId}/coffee${query}` as Route);
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="It is a match">
      <article className={styles.sheet}>
        <span className={styles.eyebrow}>Matched · just now</span>
        <h2>{firstName} said yes back.</h2>
        <p>
          The next step that actually works is a 30-minute coffee. Pick a slot now and {firstName}{' '}
          just confirms.
        </p>

        <div className={styles.slots}>
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setChosen(slot)}
              className={`${styles.slot} ${chosen === slot ? styles.slotOn : ''}`}
            >
              <span className={styles.slotTime}>
                {new Date(slot).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className={styles.slotNote}>30 min</span>
            </button>
          ))}
        </div>

        <PrimaryButton tone="light" label="Pick a café" onClick={toCoffee} />
        <GhostButton onDark onClick={() => router.push(`/chat/${matchId}` as Route)}>
          Just chat for now
        </GhostButton>
        <GhostButton onDark onClick={onDismiss}>
          Keep swiping
        </GhostButton>
      </article>
    </div>
  );
}
