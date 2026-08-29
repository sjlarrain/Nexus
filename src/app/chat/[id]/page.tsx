'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, firebaseDb } from '@/lib/firebase/client';
import { suggest } from '@/lib/chat/suggest';
import type { Message, Venue } from '@/lib/schemas/entities';
import type { Card } from '@/lib/cards/card';

/**
 * Chat with suggested replies (spec section 1).
 *
 * Reads are realtime: `onSnapshot` on the messages subcollection, which the security
 * rules allow for participants only. Writes go through the route handler, because a
 * message is two writes (BACKLOG E9.1, docs/decisions.md).
 *
 * Suggestions are recomputed locally from the same pure `suggest()` the server uses,
 * so they update the instant a message lands instead of after a round trip.
 *
 * UNSTYLED ON PURPOSE (CLAUDE.md section 2).
 */

type Thread = {
  matchId: string;
  counterpart: Card;
  messages: (Message & { id: string })[];
  booked: boolean;
  cafeMentioned: string | null;
  venues: Venue[];
};

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);

  const [thread, setThread] = useState<Thread | null>(null);
  const [live, setLive] = useState<(Message & { id: string })[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [threadResponse, meResponse] = await Promise.all([
      fetch(`/api/matches/${matchId}`),
      fetch('/api/auth/session'),
    ]);
    const body: unknown = await threadResponse.json();
    if (!threadResponse.ok) {
      throw new Error((body as { error?: string }).error ?? 'Could not open that chat.');
    }
    const session = (await meResponse.json()) as { uid?: string };
    return { thread: body as Thread, uid: session.uid ?? null };
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ thread: next, uid }) => {
        if (cancelled) return;
        setThread(next);
        setMe(uid);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  /**
   * Live message stream.
   *
   * Gated on auth state on purpose: the SDK restores the signed-in user from
   * IndexedDB asynchronously, so subscribing on mount races that restore and the
   * listen is rejected by the security rules. Waiting for the first auth callback
   * is what makes the subscription reliable on a cold load.
   */
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;

      if (!user) {
        setLive(null);
        return;
      }

      unsubscribeSnapshot = onSnapshot(
        query(collection(firebaseDb(), 'matches', matchId, 'messages'), orderBy('createdAt')),
        (snapshot) => {
          setLive(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Message) })));
        },
        () => {
          // Realtime is a nicety; the thread still works by refetching after a send.
          setLive(null);
        },
      );
    });

    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  }, [matchId]);

  // Memoised so the suggestion recompute below is not triggered by a new array
  // identity on every render.
  const messages = useMemo(() => live ?? thread?.messages ?? [], [live, thread]);

  const suggestions = useMemo(() => {
    if (!thread || !me) return [];
    return suggest({
      messages,
      meUid: me,
      theirName: thread.counterpart.name.split(' ')[0],
      booked: thread.booked,
      knownVenues: thread.venues,
    });
  }, [thread, me, messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    setSending(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        setError((body as { error?: string }).error ?? 'That message did not send.');
        return;
      }
      setDraft('');
      // Always refetch: the live stream may be unavailable, and a thread that does
      // not show the message you just sent is worse than one extra request.
      setThread((await load()).thread);
    } finally {
      setSending(false);
    }
  }

  if (error) return <main role="alert">{error}</main>;
  if (!thread) return <main>Loading...</main>;

  return (
    <main>
      <h1>{thread.counterpart.name}</h1>
      <p>{thread.counterpart.roleLine}</p>

      {thread.booked ? (
        <p>
          Coffee is booked. <a href={`/chat/${matchId}/coffee`}>See the details</a>
        </p>
      ) : thread.cafeMentioned ? (
        <p>
          {thread.cafeMentioned} came up in this chat.{' '}
          <a href={`/chat/${matchId}/coffee`}>Book it</a>
        </p>
      ) : (
        <p>
          <a href={`/chat/${matchId}/coffee`}>Set up a coffee</a>
        </p>
      )}

      <ol>
        {messages.map((message) => (
          <li key={message.id}>
            <strong>
              {message.kind === 'system'
                ? '—'
                : message.from === me
                  ? 'You'
                  : thread.counterpart.name}
            </strong>{' '}
            {message.text}
          </li>
        ))}
      </ol>

      <h2>Suggested replies</h2>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.text}>
            <button type="button" disabled={sending} onClick={() => void send(suggestion.text)}>
              {suggestion.pinned ? '★ ' : ''}
              {suggestion.text}
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label>
          Message
          <input value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button type="submit" disabled={sending || draft.trim().length === 0}>
          Send
        </button>
      </form>
    </main>
  );
}
