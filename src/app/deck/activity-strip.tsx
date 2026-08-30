'use client';

import { useEffect, useState } from 'react';
import { relativeWhen } from '@/lib/chat/when';
import type { ActivityEvent } from '@/lib/activity/feed';
import styles from './activity.module.css';

/**
 * "What happened while you were away" (BACKLOG E11.4), in the shape of the Activity
 * panel in docs/mocks/planup-profile.unpacked.html: a heading, a Close, and rows of
 * dot, line, and when.
 *
 * Its own component so a failure here never stops the deck rendering — activity is a
 * nicety, and a deck that will not load because of it is a bad trade.
 */

type Activity = { events: ActivityEvent[]; summary: string | null };

export default function ActivityStrip({ onClose }: { onClose: () => void }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/activity')
      .then((response) => (response.ok ? (response.json() as Promise<Activity>) : null))
      .then((next) => {
        if (cancelled) return;
        if (next) setActivity(next);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const events = activity?.events ?? [];

  return (
    <section className={styles.panel} aria-label="Recent activity">
      <div className={styles.head}>
        <h2 className={styles.title}>Activity</h2>
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>

      {activity?.summary ? <p className={styles.summary}>{activity.summary}</p> : null}

      {failed ? <p className={styles.empty}>Could not load your activity.</p> : null}
      {!failed && activity === null ? <p className={styles.empty}>Loading…</p> : null}
      {!failed && activity !== null && events.length === 0 ? (
        <p className={styles.empty}>Nothing new since you were last here.</p>
      ) : null}

      <div className={styles.rows}>
        {events.slice(0, 8).map((event) => {
          const body = (
            <>
              <span className={`${styles.dot} ${event.emphasis ? styles.dotOn : ''}`} />
              <span className={styles.rowBody}>
                <span className={styles.rowText}>{event.text}</span>
                <span className={styles.rowWhen}>{relativeWhen(event.at)}</span>
              </span>
            </>
          );

          return event.href ? (
            <a key={`${event.kind}-${event.at}-${event.text}`} href={event.href} className={styles.row}>
              {body}
            </a>
          ) : (
            <div key={`${event.kind}-${event.at}-${event.text}`} className={styles.row}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
