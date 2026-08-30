'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { hatchClass } from '@/components/ui';
import { relativeWhen } from '@/lib/chat/when';
import type { Card as CardType } from '@/lib/cards/card';
import styles from './chat.module.css';

/**
 * Conversation list, in the shape of docs/mocks/planup-chat-prototype.html: a
 * "Conversations" heading over flat rows of avatar, name, when, and the last line
 * said. The rows are not cards in the mock — the hairline between screens does the
 * separating, and a hover fill is the only chrome a row gets.
 */

type MatchSummary = {
  matchId: string;
  counterpart: CardType;
  lastMessage: { text: string; at: number; from: string } | null;
  booked: boolean;
  createdAt: number;
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async (): Promise<MatchSummary[]> => {
    const response = await fetch('/api/matches');
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'Could not load conversations.');
    }
    return (body as { matches: MatchSummary[] }).matches;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMatches()
      .then((next) => {
        if (!cancelled) setMatches(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError((caught as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMatches]);

  if (loading) {
    return (
      <AppShell>
        <p className={styles.empty}>Loading…</p>
      </AppShell>
    );
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

  return (
    <AppShell>
      <div className={styles.list}>
        <h1 className={styles.listHeading}>Conversations</h1>

        {matches.length === 0 ? (
          <p className={styles.empty}>No matches yet. Try the deck.</p>
        ) : null}

        {matches.map((match) => {
          const photo = match.counterpart.photos[0];
          // A thread with nothing said in it is as old as the match itself.
          const at = match.lastMessage?.at ?? match.createdAt;
          return (
            <Link key={match.matchId} href={`/chat/${match.matchId}`} className={styles.row}>
              <div className={`${styles.thumb} ${hatchClass}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo ? <img src={photo.url} alt="" /> : null}
              </div>

              <div className={styles.rowBody}>
                <div className={styles.rowTop}>
                  <h2 className={styles.rowName}>{match.counterpart.name}</h2>
                  <span className={styles.rowWhen}>{relativeWhen(at)}</span>
                </div>
                <p className={styles.preview}>
                  {match.booked ? <span className={styles.coffeeDot} aria-hidden="true" /> : null}
                  {match.lastMessage ? match.lastMessage.text : 'You matched. Say something.'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
