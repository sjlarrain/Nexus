'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import ActivityStrip from './activity-strip';
import MatchMoment from '@/components/MatchMoment';
import SwipeCard, { SwipeActions, deckClass, emptyClass } from '@/components/SwipeCard';
import FiltersSheet, {
  NO_FILTERS,
  filterSummary,
  filtersToQuery,
  type DeckFilterState,
} from './filters-sheet';
import { Chip, PillButton } from '@/components/ui';
import type { Card } from '@/lib/cards/card';
import type { SwipeAction } from '@/lib/schemas/entities';
import styles from './deck.module.css';

/**
 * The swipe deck (mock 1a, spec section 1).
 *
 * Two cards are rendered so the one underneath is already there when the top card
 * leaves. The exit animation is owned here rather than in the card, because a swipe
 * can come from either a drag or the button row.
 */

type DeckCard = Card & { score: number };

export default function DeckPage() {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** First load only. Refetching for a filter change must not blank the screen —
      the filter sheet is open on top of it. */
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState<SwipeAction | null>(null);
  const [matched, setMatched] = useState<{ matchId: string; card: Card } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DeckFilterState>(NO_FILTERS);
  const [myCity, setMyCity] = useState('');

  const fetchDeck = useCallback(async (): Promise<DeckCard[]> => {
    const response = await fetch(`/api/deck${filtersToQuery(filters)}`);
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'Could not load the deck.');
    }
    return (body as { cards: DeckCard[] }).cards;
  }, [filters]);

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
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDeck]);

  // Only so the location filter can offer a city by name rather than "my city".
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((response) => (response.ok ? (response.json() as Promise<{ profile: { city: string } }>) : null))
      .then((body) => {
        if (!cancelled && body) setMyCity(body.profile.city);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Plays the exit animation, then commits the swipe. */
  function intent(action: SwipeAction): void {
    if (leaving) return;
    setLeaving(action);
    window.setTimeout(() => {
      setLeaving(null);
      void commit(action);
    }, 320);
  }

  async function commit(action: SwipeAction): Promise<void> {
    const card = cards[0];
    if (!card) return;

    // Optimistic: the card has already animated away, so it must not come back.
    setCards((current) => current.slice(1));

    const response = await fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid: card.uid, action }),
    });
    const body: unknown = await response.json();

    if (!response.ok) {
      setError((body as { error?: string }).error ?? 'That swipe did not save.');
      fetchDeck()
        .then(setCards)
        .catch(() => {});
      return;
    }

    const result = body as { matched: boolean; matchId: string | null };
    if (result.matched && result.matchId) {
      setMatched({ matchId: result.matchId, card });
    }
  }

  if (!ready) {
    return (
      <AppShell>
        <p className={emptyClass}>Loading the deck…</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <p className={emptyClass} role="alert">
          {error} — <a href="/signin">sign in</a>
        </p>
      </AppShell>
    );
  }

  const [top, next] = cards;

  return (
    <AppShell
      actions={
        <>
          <PillButton dot onClick={() => setShowActivity((open) => !open)}>
            Activity
          </PillButton>
          <PillButton onClick={() => setShowFilters(true)}>Filters</PillButton>
        </>
      }
    >
      {showActivity ? <ActivityStrip onClose={() => setShowActivity(false)} /> : null}

      {/* The chips say what is on; tapping any of them opens the same sheet. */}
      <div className={styles.filters}>
        {filterSummary(filters).map((label) => (
          <button key={label} type="button" onClick={() => setShowFilters(true)}>
            <Chip pill>{label}</Chip>
          </button>
        ))}
      </div>

      <div className={deckClass}>
        {next ? (
          <SwipeCard key={next.uid} card={next} onIntent={() => {}} interactive={false} />
        ) : null}
        {top ? (
          <SwipeCard key={top.uid} card={top} onIntent={intent} leaving={leaving} />
        ) : (
          <p className={emptyClass}>Nobody left for now. Try widening your filters.</p>
        )}
      </div>

      {top ? <SwipeActions onIntent={intent} disabled={leaving !== null} /> : null}

      {showFilters ? (
        <FiltersSheet
          filters={filters}
          myCity={myCity}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      ) : null}

      {matched ? (
        <MatchMoment
          matchId={matched.matchId}
          counterpart={matched.card}
          onDismiss={() => setMatched(null)}
        />
      ) : null}
    </AppShell>
  );
}
