'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Card } from '@/lib/cards/card';

/** Conversation list. UNSTYLED ON PURPOSE (CLAUDE.md section 2). */

type MatchSummary = {
  matchId: string;
  counterpart: Card;
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

  if (loading) return <main>Loading...</main>;
  if (error) {
    return (
      <main role="alert">
        {error} — <a href="/signin">sign in</a>
      </main>
    );
  }

  return (
    <main>
      <h1>Conversations</h1>
      {matches.length === 0 ? <p>No matches yet. Try the deck.</p> : null}
      <ul>
        {matches.map((match) => (
          <li key={match.matchId}>
            <a href={`/chat/${match.matchId}`}>
              <strong>{match.counterpart.name}</strong>
            </a>
            <p>{match.counterpart.roleLine}</p>
            <p>{match.lastMessage ? match.lastMessage.text : 'You matched. Say something.'}</p>
            {match.booked ? <p>Coffee booked</p> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
