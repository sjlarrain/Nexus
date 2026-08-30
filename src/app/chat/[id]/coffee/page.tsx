'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { Chip, Input, PrimaryButton, hatchClass } from '@/components/ui';
import { BOOKING_MODES, type Booking, type BookingMode, type Venue } from '@/lib/schemas/entities';
import styles from './coffee.module.css';

/**
 * Coffee booking (spec section 1): video call or in person, three nearby venues with
 * manual search below, two time slots. A café named in the chat pins to the top
 * tagged "Mentioned in your chat".
 *
 * The screen has two faces. With no booking it proposes; with one it shows the state
 * machine's next move — the other side picking a time, or you picking one. Without
 * that second face a proposal could never be accepted from the UI (BACKLOG E10.4).
 *
 * Laid out after docs/mocks/planup-quick-tips.html's booking screen. Two things in
 * that mock are still not built, for the same reason MatchMoment drops its price
 * range: they would be promises the app cannot keep (docs/design.md).
 *
 *   · prices and "for two"   — `venueSchema` carries no pricing
 *   · payment and OpenTable  — there is no payment provider and no OpenTable
 *                              integration; the flow is propose-then-accept, free,
 *                              and the note under the slots says so plainly
 */

const MODE_LABEL: Record<BookingMode, string> = { video: 'Video call', in_person: 'In person' };

type VenueRow = { venue: Venue; mentionedInChat: boolean };
type Existing = (Booking & { id: string }) | null;

type VenuesResponse = {
  venues: VenueRow[];
  theirName: string;
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
  const [mode, setMode] = useState<BookingMode>('in_person');
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
        <span className={`${styles.venueThumb} ${hatchClass}`} aria-hidden="true" />
        <span className={styles.venueBody}>
          <span className={styles.venueName}>{row.venue.name}</span>
          {row.venue.address ? (
            <span className={styles.venueAddress}>{row.venue.address}</span>
          ) : null}
        </span>
        {row.mentionedInChat ? <Chip tone="amber">In your chat</Chip> : null}
      </button>
    );
  }

  const back = (
    <div className={styles.topRow}>
      <Link href={`/chat/${matchId}`} className={styles.back} aria-label="Back to the chat">
        ←
      </Link>
      <span className={styles.topNote}>One screen, one tap for them</span>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /* A coffee already exists: show the state machine, not the form.    */
  /* ---------------------------------------------------------------- */
  if (booking) {
    const confirmed = booking.status === 'confirmed';
    // "at Devoción, Williamsburg" for an in-person coffee, "over video call" for one.
    const at = booking.venue ? `at ${booking.venue.name}` : 'over video call';
    const label = booking.venue ? booking.venue.name : 'video call';

    return (
      <AppShell>
        <div className={styles.frame}>
          {back}
          <h1 className={styles.heading}>
            {confirmed ? 'You are on.' : waitingOn === 'you' ? 'Pick a time.' : 'Times sent.'}
          </h1>
          <p className={styles.sub}>
            {confirmed
              ? `${label} — 30 minutes.`
              : waitingOn === 'you'
                ? `They proposed a coffee ${at}. Choose one and it is booked.`
                : `Waiting for them to pick one of your times ${at}.`}
          </p>

          <p className={styles.kicker}>
            {confirmed ? 'When' : 'Proposed times'} · your local time
          </p>

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

        <h1 className={styles.heading}>Book a coffee chat with {data.theirName}</h1>
        <p className={styles.sub}>
          Thirty minutes, {mode === 'video' ? 'over video' : 'somewhere near both of you'}.{' '}
          {data.theirName} picks one of your times and it is booked.
        </p>

        <div className={styles.modeRow} role="group" aria-label="Video call or in person">
          {BOOKING_MODES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              className={`${styles.modeBtn} ${mode === option ? styles.modeOn : ''}`}
              onClick={() => setMode(option)}
            >
              {MODE_LABEL[option]}
            </button>
          ))}
        </div>

        {mode === 'in_person' ? (
          <>
            <p className={styles.kicker}>Cafés near you both</p>
            {nearby.map(venueRow)}

            <div className={styles.search}>
              <Input
                value={search}
                placeholder="Search a café or neighbourhood…"
                aria-label="Search a café or neighbourhood"
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                type="button"
                className={styles.clear}
                disabled={search.length === 0}
                onClick={() => setSearch('')}
              >
                Clear
              </button>
            </div>
            {term ? (
              <p className={styles.searchHint}>
                {searched.length === 0
                  ? `Nothing matching “${search}”.`
                  : `${searched.length} match${searched.length === 1 ? '' : 'es'}.`}
              </p>
            ) : null}
            {searched.map(venueRow)}
          </>
        ) : null}

        <p className={styles.kicker}>Slots · your local time</p>
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

        <p className={styles.note}>
          Nothing is charged — {data.theirName} gets these times in the chat and confirms one.
        </p>

        <PrimaryButton
          className={styles.cta}
          label={mode === 'in_person' ? 'Reserve table' : 'Send these times'}
          disabled={(mode === 'in_person' && !venueId) || busy}
          onClick={() =>
            void act(
              { matchId, mode, venueId: mode === 'in_person' ? venueId : null, slots: data.suggestedSlots },
              '/api/bookings',
              'Sent. They pick one of the two times.',
            )
          }
        />

        <p className={styles.footnote}>Either of you can cancel this from here.</p>

        {message ? (
          <p className={styles.status} role="status">
            {message}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
