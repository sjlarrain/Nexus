'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Card } from '@/lib/cards/card';

/**
 * Likes — people who already said yes (spec section 1).
 * Saying yes back matches instantly.
 *
 * UNSTYLED ON PURPOSE (CLAUDE.md section 2).
 */

type LikeCard = Card & { priority: boolean; likedAt: number };

export default function LikesPage() {
  const [likes, setLikes] = useState<LikeCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState<{ matchId: string; name: string } | null>(null);

  const fetchLikes = useCallback(async (): Promise<LikeCard[]> => {
    const response = await fetch('/api/likes');
    const body: unknown = await response.json();
    if (!response.ok) throw new Error((body as { error?: string }).error ?? 'Could not load likes.');
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

  async function respond(card: LikeCard, action: 'yes' | 'no') {
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

    // Yes-back on an inbound like always matches, since they already said yes.
    const result = body as { matched: boolean; matchId: string | null };
    if (result.matched && result.matchId) {
      setMatched({ matchId: result.matchId, name: card.name });
    }
  }

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
      <h1>Likes</h1>

      {matched ? (
        <p role="status">
          You matched with {matched.name}. <a href={`/chat/${matched.matchId}`}>Say hello</a>
        </p>
      ) : null}

      {likes.length === 0 ? <p>Nobody is waiting on you.</p> : null}

      <ul>
        {likes.map((like) => (
          <li key={like.uid}>
            {/* A swipe-up is a priority ask and sorts to the top (spec §1). */}
            {like.priority ? <p>Priority ask</p> : null}
            <h2>{like.name}</h2>
            <p>{like.roleLine}</p>
            <p>{like.headline}</p>
            {like.doors.length > 0 ? <p>Can open doors at: {like.doors.join(', ')}</p> : null}

            <button type="button" onClick={() => void respond(like, 'no')}>
              Pass
            </button>
            <button type="button" onClick={() => void respond(like, 'yes')}>
              Yes back
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
