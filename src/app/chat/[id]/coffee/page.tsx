'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { Chip, Eyebrow, Input, PrimaryButton } from '@/components/ui';
import type { Venue } from '@/lib/schemas/entities';
import styles from './coffee.module.css';

/**
 * Coffee booking (spec section 1): three nearby venues, manual search below, two time
 * slots. A café named in the chat pins to the top tagged "Mentioned in your chat".
 *
 * The match moment can hand a slot over in the query string, so picking a time there
 * is not thrown away here.
 */

type VenueRow = { venue: Venue; mentionedInChat: boolean };

export default function CoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);
  const searchParams = useSearchParams();
  const preselected = Number(searchParams.get('slot')) || null;

  const [rows, setRows] = useState<VenueRow[]>([]);
  const [slots, setSlots] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<number | null>(preselected);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/matches/${matchId}/venues`);
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'Could not load venues.');
    }
    return body as { venues: VenueRow[]; suggestedSlots: number[] };
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setRows(data.venues);
        setSlots(data.suggestedSlots);
        setVenueId(data.venues[0]?.venue.id ?? null);
        setChosenSlot((current) => current ?? data.suggestedSlots[0] ?? null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function propose(): Promise<void> {
    if (!venueId) return;
    setBusy(true);
    try {
      // Both times go over; the other side picks one (BACKLOG E10.4).
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, venueId, slots }),
      });
      const body: unknown = await response.json();
      setMessage(
        response.ok
          ? 'Sent. They pick one of the two times.'
          : ((body as { error?: string }).error ?? 'Could not propose that.'),
      );
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

  // Spec section 1: three nearby venues, with manual search below them.
  const nearby = rows.slice(0, 3);
  const term = search.trim().toLowerCase();
  const searched = term
    ? rows.filter((row) => row.venue.name.toLowerCase().includes(term))
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

  return (
    <AppShell>
      <div className={styles.frame}>
        <Link href={`/chat/${matchId}`} className={styles.back} aria-label="Back to the chat">
          ←
        </Link>

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
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={chosenSlot === slot}
            onClick={() => setChosenSlot(slot)}
            className={`${styles.slot} ${chosenSlot === slot ? styles.slotOn : ''}`}
          >
            <span className={styles.slotTime}>
              {new Date(slot).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <span className={styles.slotNote}>30 min</span>
          </button>
        ))}

        <PrimaryButton
          label="Propose these times"
          disabled={!venueId || busy}
          onClick={() => void propose()}
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
