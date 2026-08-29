'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Card } from '@/lib/cards/card';

/**
 * The swipe deck (spec section 1).
 *
 * UNSTYLED ON PURPOSE — see CLAUDE.md section 2. There is no drag gesture here yet
 * either: the thresholds (dx ±105, dy −110) belong with the real card component once
 * the mocks land. Buttons stand in for the three gestures so the write path,
 * match detection, and exclusion logic can be exercised end to end.
 */

type DeckCard = Card & { score: number };

export default function DeckPage() {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState<string | null>(null);

  /** Fetches without touching state, so callers decide when to render. */
  const fetchDeck = useCallback(async (): Promise<DeckCard[]> => {
    const response = await fetch('/api/deck');
    const body: unknown = await response.json();
    if (!response.ok) throw new Error((body as { error?: string }).error ?? 'Could not load the deck.');
    return (body as { cards: DeckCard[] }).cards;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDeck()
      .then((next) => {
        if (!cancelled) setCards(next);
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
  }, [fetchDeck]);

  async function swipe(targetUid: string, action: 'yes' | 'no' | 'priority') {
    // Optimistic: the card leaves immediately, as a swipe should feel instant.
    setCards((current) => current.filter((card) => card.uid !== targetUid));

    const response = await fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid, action }),
    });
    const body: unknown = await response.json();

    if (!response.ok) {
      setError((body as { error?: string }).error ?? 'That swipe did not save.');
      fetchDeck().then(setCards).catch(() => {});
      return;
    }

    if ((body as { matched: boolean }).matched) {
      setMatched((body as { matchId: string }).matchId);
    }
  }

  if (loading) return <main>Loading the deck...</main>;
  if (error) return <main role="alert">{error} — <a href="/signin">sign in</a></main>;

  return (
    <main>
      <h1>Deck</h1>

      {matched ? (
        <p role="status">
          It is a match. <a href={`/chat/${matched}`}>Open the chat</a>
        </p>
      ) : null}

      {cards.length === 0 ? <p>Nobody left for now.</p> : null}

      <ul>
        {cards.map((card) => (
          <li key={card.uid}>
            <h2>{card.name}</h2>
            <p>{card.roleLine}</p>
            <p>{card.headline}</p>
            {card.badge ? <p>{card.badge}</p> : null}
            {card.doors.length > 0 ? <p>Can open doors at: {card.doors.join(', ')}</p> : null}
            <p>{card.tags.join(' · ')}</p>

            <button type="button" onClick={() => void swipe(card.uid, 'no')}>
              Pass
            </button>
            <button type="button" onClick={() => void swipe(card.uid, 'yes')}>
              Interested
            </button>
            <button type="button" onClick={() => void swipe(card.uid, 'priority')}>
              Priority ask
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
