'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AppShell from '@/components/AppShell';
import { Input, hatchClass } from '@/components/ui';
import { firebaseAuth, firebaseDb } from '@/lib/firebase/client';
import { headlineFor, suggest } from '@/lib/chat/suggest';
import { shortDate } from '@/lib/chat/when';
import { googleCalendarUrl } from '@/lib/booking/calendar';
import type { Booking, Message, Venue } from '@/lib/schemas/entities';
import type { Card } from '@/lib/cards/card';
import styles from '../chat.module.css';

/**
 * Chat with suggested replies (spec section 1).
 *
 * Reads are realtime: `onSnapshot` on the messages subcollection, which the security
 * rules allow for participants only. Writes go through the route handler, because a
 * message is two writes (BACKLOG E9.1, docs/decisions.md).
 *
 * Suggestions are recomputed locally from the same pure `suggest()` the server uses,
 * so they update the instant a message lands instead of after a round trip.
 */

type Thread = {
  matchId: string;
  counterpart: Card;
  matchedAt: number;
  messages: (Message & { id: string })[];
  booked: boolean;
  booking: (Booking & { id: string }) | null;
  cafeMentioned: string | null;
  venues: Venue[];
};

function formatSlot(startsAt: number): string {
  const date = new Date(startsAt);
  const day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `${day} · ${time}`;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const router = useRouter();

  const [thread, setThread] = useState<Thread | null>(null);
  const [live, setLive] = useState<(Message & { id: string })[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  // The mock lets the starter row be dismissed; it comes back on the next visit.
  const [startersHidden, setStartersHidden] = useState(false);
  const composer = useRef<HTMLInputElement>(null);

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

  // Every suggestion in a set comes from one rule, so the first one names the set.
  const headline = suggestions[0] ? headlineFor(suggestions[0].rule) : '';

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

  /** Cancels the confirmed coffee, then drops them straight onto the propose form —
      "reschedule" means picking a new time, not just seeing the old one is gone. */
  async function reschedule(bookingId: string): Promise<void> {
    setRescheduling(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        setError((body as { error?: string }).error ?? 'Could not reschedule that.');
        return;
      }
      router.push(`/chat/${matchId}/coffee`);
    } finally {
      setRescheduling(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <p className={styles.empty} role="alert">
          {error}
        </p>
      </AppShell>
    );
  }

  if (!thread) {
    return (
      <AppShell>
        <p className={styles.empty}>Loading…</p>
      </AppShell>
    );
  }

  const photo = thread.counterpart.photos[0];

  return (
    <AppShell fill>
      <div className={styles.thread}>
        <header className={styles.header}>
          <Link href="/chat" className={styles.back} aria-label="Back to conversations">
            ←
          </Link>
          <div className={`${styles.thumb} ${hatchClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo.url} alt="" /> : null}
          </div>
          <div className={styles.headerBody}>
            <h1 className={styles.rowName}>{thread.counterpart.name}</h1>
            <p className={styles.rowRole}>{thread.counterpart.deckLine}</p>
          </div>

          {/* The mock puts the whole coffee flow behind one pill in the header. */}
          <Link href={`/chat/${matchId}/coffee`} className={styles.coffeePill}>
            <span className={styles.coffeeMark} aria-hidden="true" />
            Coffee chat
          </Link>
        </header>

        <div className={styles.messages}>
          <p className={styles.matched}>
            You matched {shortDate(thread.matchedAt)}. Nobody can message before a mutual yes.
          </p>

          {messages.map((message) =>
            message.kind === 'system' ? (
              <p key={message.id} className={styles.system}>
                {message.text}
              </p>
            ) : (
              <div
                key={message.id}
                className={`${styles.bubble} ${
                  message.from === me ? styles.fromMe : styles.fromThem
                }`}
              >
                {message.text}
              </div>
            ),
          )}

          {thread.booking && thread.booking.status === 'confirmed'
            ? (() => {
                const confirmedBooking = thread.booking;
                const chosenSlot = confirmedBooking.chosenSlot;
                return (
                  <div className={styles.confirmed}>
                    <span className={styles.confirmedKicker}>Coffee chat confirmed</span>
                    <p className={styles.confirmedWhen}>
                      {chosenSlot === null ? 'Time to be picked' : formatSlot(chosenSlot)}
                    </p>
                    <p className={styles.confirmedWhere}>
                      {/* "Table for 2" is always literally true — a booking is always
                          exactly the two matched participants — not a reservation claim. */}
                      {confirmedBooking.venue
                        ? `${confirmedBooking.venue.name} · table for 2`
                        : 'Video call'}
                    </p>
                    {chosenSlot !== null ? (
                      <div className={styles.confirmedActions}>
                        <a
                          href={googleCalendarUrl({
                            startsAt: chosenSlot,
                            withName: thread.counterpart.name.split(' ')[0] ?? 'them',
                            where: confirmedBooking.venue?.name ?? null,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.confirmedAction}
                        >
                          Add to calendar
                        </a>
                        <button
                          type="button"
                          disabled={rescheduling}
                          className={styles.confirmedActionGhost}
                          onClick={() => void reschedule(confirmedBooking.id)}
                        >
                          {rescheduling ? 'Rescheduling…' : 'Reschedule'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })()
            : null}
        </div>

        {suggestions.length > 0 && !startersHidden ? (
          <div className={styles.starters}>
            <div className={styles.startersHead}>
              <span className={styles.startersLabel}>{headline}</span>
              <button
                type="button"
                className={styles.startersHide}
                onClick={() => setStartersHidden(true)}
              >
                Hide
              </button>
            </div>
            <div className={styles.starterRow}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.text}
                  type="button"
                  disabled={sending}
                  /* Fills the composer rather than sending: the whole point of a
                     suggestion is that you read it, change a word, and own it. */
                  onClick={() => {
                    setDraft(suggestion.text);
                    composer.current?.focus();
                  }}
                  className={`${styles.starter} ${suggestion.pinned ? styles.starterPinned : ''}`}
                >
                  {suggestion.short}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <Input
            ref={composer}
            className={styles.composerInput}
            value={draft}
            placeholder="Write your own message…"
            aria-label="Message"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className={styles.send}
            aria-label="Send"
            disabled={sending || !draft.trim()}
          >
            →
          </button>
        </form>
      </div>
    </AppShell>
  );
}
