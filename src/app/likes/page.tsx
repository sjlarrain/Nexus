'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import MatchMoment from '@/components/MatchMoment';
import { Card, Chip, hatchClass } from '@/components/ui';
import type { Card as CardType } from '@/lib/cards/card';
import styles from './likes.module.css';

/**
 * Likes — people who already said yes (spec section 1). Saying yes back matches
 * instantly, which is why the match moment is raised from here as well as the deck.
 *
 * A swipe-up arrives as a priority ask and sorts to the top, marked with the amber
 * chip the mock reserves for exactly that kind of emphasis.
 */

type LikeCard = CardType & { priority: boolean; likedAt: number };

export default function LikesPage() {
  const [likes, setLikes] = useState<LikeCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState<{ matchId: string; card: CardType } | null>(null);

  const fetchLikes = useCallback(async (): Promise<LikeCard[]> => {
    const response = await fetch('/api/likes');
    const body: unknown = await response.json();
    if (!response.ok)
      throw new Error((body as { error?: string }).error ?? 'Could not load likes.');
    return (body as { likes: LikeCard[] }).likes;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLikes()
      .then((next) => {
        if (!cancelled) setLikes(next);
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
  }, [fetchLikes]);

  async function respond(card: LikeCard, action: 'yes' | 'no'): Promise<void> {
    setLikes((current) => current.filter((like) => like.uid !== card.uid));

    const response = await fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid: card.uid, action }),
    });
    const body: unknown = await response.json();

    if (!response.ok) {
      setError((body as { error?: string }).error ?? 'That did not save.');
      return;
    }

    // Yes-back on an inbound like always matches: they already said yes.
    const result = body as { matched: boolean; matchId: string | null };
    if (result.matched && result.matchId) {
      setMatched({ matchId: result.matchId, card });
    }
  }

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
      {likes.length === 0 ? (
        <p className={styles.empty}>Nobody is waiting on you yet. Keep swiping.</p>
      ) : null}

      <div className={styles.list}>
        {likes.map((like) => {
          const photo = like.photos[0];
          return (
            <Card key={like.uid} className={styles.row}>
              <div className={`${styles.thumb} ${hatchClass}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo ? <img src={photo.url} alt="" /> : null}
              </div>

              <div className={styles.body}>
                {like.priority ? (
                  <div className={styles.priority}>
                    <Chip tone="amber">Priority ask</Chip>
                  </div>
                ) : null}

                <h2 className={styles.name}>{like.name}</h2>
                <p className={styles.role}>{like.deckLine}</p>
                {like.headline ? <p className={styles.headline}>{like.headline}</p> : null}

                <div className={styles.buttons}>
                  <button
                    type="button"
                    className={styles.pass}
                    onClick={() => void respond(like, 'no')}
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    className={styles.yes}
                    onClick={() => void respond(like, 'yes')}
                  >
                    Yes back
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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
