'use client';

import { use, useCallback, useEffect, useState } from 'react';
import type { Venue } from '@/lib/schemas/entities';

/**
 * Coffee booking (spec section 1): three nearby venues, manual search below, two time
 * slots. A cafe named in the chat pins to the top tagged "Mentioned in your chat".
 *
 * UNSTYLED ON PURPOSE (CLAUDE.md section 2). The venue list is seeded rather than
 * fetched from a places API — see docs/decisions.md.
 */

type VenueRow = { venue: Venue; mentionedInChat: boolean };

export default function CoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params);

  const [rows, setRows] = useState<VenueRow[]>([]);
  const [slots, setSlots] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [chosenVenue, setChosenVenue] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setChosenVenue(data.venues[0]?.venue.id ?? null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError((caught as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function propose() {
    if (!chosenVenue) return;
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, venueId: chosenVenue, slots }),
    });
    const body: unknown = await response.json();
    setMessage(
      response.ok
        ? 'Sent. They pick one of the two times.'
        : ((body as { error?: string }).error ?? 'Could not propose that.'),
    );
  }

  if (error) return <main role="alert">{error}</main>;

  // Spec §1: three nearby venues, with manual search below them.
  const nearby = rows.slice(0, 3);
  const searched =
    search.trim().length > 0
      ? rows.filter((row) => row.venue.name.toLowerCase().includes(search.trim().toLowerCase()))
      : [];

  return (
    <main>
      <h1>Coffee</h1>
      <p>
        <a href={`/chat/${matchId}`}>Back to the chat</a>
      </p>

      <h2>Nearby</h2>
      <ul>
        {nearby.map((row) => (
          <li key={row.venue.id}>
            <label>
              <input
                type="radio"
                name="venue"
                checked={chosenVenue === row.venue.id}
                onChange={() => setChosenVenue(row.venue.id)}
              />
              {row.venue.name} {row.venue.address ? `— ${row.venue.address}` : ''}
              {row.mentionedInChat ? ' · Mentioned in your chat' : ''}
            </label>
          </li>
        ))}
      </ul>

      <h2>Search</h2>
      <label>
        Find a place
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <ul>
        {searched.map((row) => (
          <li key={row.venue.id}>
            <label>
              <input
                type="radio"
                name="venue"
                checked={chosenVenue === row.venue.id}
                onChange={() => setChosenVenue(row.venue.id)}
              />
              {row.venue.name}
            </label>
          </li>
        ))}
      </ul>

      <h2>Times</h2>
      <ul>
        {slots.map((slot) => (
          <li key={slot}>{new Date(slot).toLocaleString()} — 30 minutes</li>
        ))}
      </ul>

      <button type="button" disabled={!chosenVenue} onClick={() => void propose()}>
        Propose these times
      </button>

      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
