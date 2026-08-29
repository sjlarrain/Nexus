'use client';

import { useEffect, useState } from 'react';
import type { ActivityEvent } from '@/lib/activity/feed';

/**
 * The "what happened while you were away" strip above the deck (BACKLOG E11.4).
 * Its own component so a failure here never stops the deck rendering.
 *
 * UNSTYLED ON PURPOSE (CLAUDE.md section 2).
 */

type Activity = { events: ActivityEvent[]; summary: string | null };

export default function ActivityStrip() {
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/activity')
      .then((response) => (response.ok ? (response.json() as Promise<Activity>) : null))
      .then((next) => {
        if (!cancelled && next) setActivity(next);
      })
      // Activity is a nicety. If it fails, the deck is still the deck.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!activity || activity.events.length === 0) return null;

  return (
    <section aria-label="Recent activity">
      {activity.summary ? <p>{activity.summary}</p> : null}
      <ul>
        {activity.events.slice(0, 5).map((event) => (
          <li key={`${event.kind}-${event.at}-${event.text}`}>
            {event.emphasis ? '★ ' : ''}
            {event.href ? <a href={event.href}>{event.text}</a> : event.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
