'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { Chip, Eyebrow, Input, PrimaryButton } from '@/components/ui';
import type { Booking, Venue } from '@/lib/schemas/entities';
import styles from './coffee.module.css';

/**
 * Coffee booking (spec section 1): three nearby venues, manual search below, two time
 * slots. A café named in the chat pins to the top tagged "Mentioned in your chat".
 *
 * The screen has two faces. With no booking it proposes; with one it shows the state
 * machine's next move — the other side picking a time, or you picking one. Without
 * that second face a proposal could never be accepted from the UI (BACKLOG E10.4).
 */

type VenueRow = { venue: Venue; mentionedInChat: boolean };
type Existing = (Booking & { id: string }) | null;

type VenuesResponse = {
  venues: VenueRow[];
  suggestedSlots: number[];
  booking: Existing;
  waitingOn: 'you' | 'them' | null;
};

function formatSlot(startsAt: number): string {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const searchParams = useSearchParams();
  const preselected = Number(searchParams.get('slot')) || null;

  const [data, setData] = useState<VenuesResponse | null>(null);
  const [search, setSearch] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<number | null>(preselected);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<VenuesResponse> => {
    const response = await fetch(`/api/matches/${matchId}/venues`);
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'Could not load venues.');
    }
    return body as VenuesResponse;
  }, [matchId]);

  const refresh = useCallback(async () => {
    const next = await load();
    setData(next);
    setVenueId((current) => current ?? next.venues[0]?.venue.id ?? null);
    setChosenSlot((current) => current ?? next.suggestedSlots[0] ?? null);
    return next;
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setVenueId(next.venues[0]?.venue.id ?? null);
        setChosenSlot((current) => current ?? next.suggestedSlots[0] ?? null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function act(body: unknown, path: string, done: string): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setMessage((payload as { error?: string }).error ?? 'That did not work.');
        return;
      }
      setMessage(done);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <p className={styles.sub} role="alert">
          {error}
        </p>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <p className={styles.sub}>Loading…</p>
      </AppShell>
    );
  }

  const { booking, waitingOn } = data;

  // Spec section 1: three nearby venues, with manual search below them.
  const nearby = data.venues.slice(0, 3);
  const term = search.trim().toLowerCase();
  const searched = term
    ? data.venues.filter((row) => row.venue.name.toLowerCase().includes(term))
    : [];

  function venueRow(row: VenueRow) {
    return (
      <button
        key={row.venue.id}
        type="button"
        aria-pressed={venueId === row.venue.id}
        onClick={() => setVenueId(row.venue.id)}
        className={`${styles.venue} ${venueId === row.venue.id ? styles.venueOn : ''}`}
      >
        <span>
          <span className={styles.venueName}>{row.venue.name}</span>
          {row.venue.address ? (
            <span className={styles.venueAddress}>{row.venue.address}</span>
          ) : null}
        </span>
        {row.mentionedInChat ? <Chip tone="amber">Mentioned in your chat</Chip> : null}
      </button>
    );
  }

  const back = (
    <Link href={`/chat/${matchId}`} className={styles.back} aria-label="Back to the chat">
      ←
    </Link>
  );

  /* ---------------------------------------------------------------- */
  /* A coffee already exists: show the state machine, not the form.    */
  /* ---------------------------------------------------------------- */
  if (booking) {
    const confirmed = booking.status === 'confirmed';

    return (
      <AppShell>
        <div className={styles.frame}>
          {back}
          <h1 className={styles.heading}>
            {confirmed ? 'You are on.' : waitingOn === 'you' ? 'Pick a time.' : 'Times sent.'}
          </h1>
          <p className={styles.sub}>
            {confirmed
              ? `${booking.venue.name} — 30 minutes.`
              : waitingOn === 'you'
                ? `They proposed ${booking.venue.name}. Choose one and it is booked.`
                : `Waiting for them to pick one of your times at ${booking.venue.name}.`}
          </p>

          <Eyebrow>{confirmed ? 'When' : 'Proposed times'}</Eyebrow>
          <div className={styles.sectionLabel} />

          {confirmed && booking.chosenSlot !== null ? (
            <div className={`${styles.slot} ${styles.slotOn}`}>
              <span className={styles.slotTime}>{formatSlot(booking.chosenSlot)}</span>
              <span className={styles.slotNote}>30 min</span>
            </div>
          ) : (
            booking.slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                disabled={waitingOn !== 'you' || busy}
                aria-pressed={chosenSlot === slot.startsAt}
                onClick={() => setChosenSlot(slot.startsAt)}
                className={`${styles.slot} ${chosenSlot === slot.startsAt ? styles.slotOn : ''}`}
              >
                <span className={styles.slotTime}>{formatSlot(slot.startsAt)}</span>
                <span className={styles.slotNote}>30 min</span>
              </button>
            ))
          )}

          {waitingOn === 'you' ? (
            <PrimaryButton
              label="Confirm this time"
              disabled={busy || chosenSlot === null}
              onClick={() =>
                void act(
                  { action: 'accept', startsAt: chosenSlot },
                  `/api/bookings/${booking.id}`,
                  'Booked. It is in the chat.',
                )
              }
            />
          ) : null}

          <button
            type="button"
            disabled={busy}
            className={styles.cancel}
            onClick={() =>
              void act({ action: 'cancel' }, `/api/bookings/${booking.id}`, 'Cancelled.')
            }
          >
            {confirmed ? 'Cancel this coffee' : 'Cancel and propose something else'}
          </button>

          {message ? (
            <p className={styles.status} role="status">
              {message}
            </p>
          ) : null}
        </div>
      </AppShell>
    );
  }

  /* ---------------------------------------------------------------- */
  /* No coffee yet: propose one.                                       */
  /* ---------------------------------------------------------------- */
  return (
    <AppShell>
      <div className={styles.frame}>
        {back}

        <h1 className={styles.heading}>Where should it be?</h1>
        <p className={styles.sub}>Thirty minutes, somewhere near both of you.</p>

        <Eyebrow>Nearby</Eyebrow>
        <div className={styles.sectionLabel} />
        {nearby.map(venueRow)}

        <Eyebrow>Search</Eyebrow>
        <div className={styles.sectionLabel} />
        <div className={styles.search}>
          <Input
            value={search}
            placeholder="Find a place"
            aria-label="Find a place"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {searched.map(venueRow)}

        <Eyebrow>Times</Eyebrow>
        <div className={styles.sectionLabel} />
        {data.suggestedSlots.map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={chosenSlot === slot}
            onClick={() => setChosenSlot(slot)}
            className={`${styles.slot} ${chosenSlot === slot ? styles.slotOn : ''}`}
          >
            <span className={styles.slotTime}>{formatSlot(slot)}</span>
            <span className={styles.slotNote}>30 min</span>
          </button>
        ))}

        <PrimaryButton
          label="Propose these times"
          disabled={!venueId || busy}
          onClick={() =>
            void act(
              { matchId, venueId, slots: data.suggestedSlots },
              '/api/bookings',
              'Sent. They pick one of the two times.',
            )
          }
        />

        {message ? (
          <p className={styles.status} role="status">
            {message}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
