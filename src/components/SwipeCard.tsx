'use client';

import { useRef, useState } from 'react';
import { Badge, Chip, Dots, Meta, Quote, RefBox, hatchClass } from '@/components/ui';
import type { Card } from '@/lib/cards/card';
import type { SwipeAction } from '@/lib/schemas/entities';
import styles from './SwipeCard.module.css';

/**
 * The deck card (mock 1a) and its drag gesture.
 *
 * Thresholds are the spec's, not invented: dx > 105 yes, dx < -105 no, dy < -110
 * priority (docs/planup.md section 1). Vertical wins when it is the larger movement,
 * so a diagonal flick upward is still a priority ask.
 *
 * The card reports intent and the deck owns the exit animation, because the same
 * animation has to play whether the swipe came from a drag or from the button row —
 * which lives outside the card.
 *
 * The mock's "2 mutual" chip is deliberately absent: we have no connection graph,
 * and inventing one on a card about professional trust is worse than leaving it out
 * (docs/design.md).
 */

const THRESHOLD = { x: 105, up: -110 } as const;

type Point = { x: number; y: number };

/** Exported so the deck can label its own buttons the same way. */
export function verdictLabel(action: SwipeAction): string {
  return action === 'yes' ? 'Interested' : action === 'no' ? 'Pass' : 'Priority ask';
}

export default function SwipeCard({
  card,
  onIntent,
  leaving = null,
  interactive = true,
}: {
  card: Card;
  /** Fired when a drag passes the threshold. The deck decides what happens next. */
  onIntent: (action: SwipeAction) => void;
  /** Set by the deck to play the exit animation. */
  leaving?: SwipeAction | null;
  /** Cards below the top of the stack render but do not accept a gesture. */
  interactive?: boolean;
}) {
  const [photo, setPhoto] = useState(0);
  /** Photo URLs that 404 or time out; the hatch beneath shows through instead. */
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<Point | null>(null);
  const origin = useRef<Point | null>(null);

  const photos = card.photos;
  const current = photos[photo];

  function verdictFor(point: Point): SwipeAction | null {
    if (point.y <= THRESHOLD.up && Math.abs(point.y) > Math.abs(point.x)) return 'priority';
    if (point.x >= THRESHOLD.x) return 'yes';
    if (point.x <= -THRESHOLD.x) return 'no';
    return null;
  }

  function begin(event: React.PointerEvent<HTMLElement>): void {
    if (!interactive || leaving) return;
    origin.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: React.PointerEvent<HTMLElement>): void {
    if (!origin.current) return;
    setDrag({ x: event.clientX - origin.current.x, y: event.clientY - origin.current.y });
  }

  function end(): void {
    const point = drag;
    origin.current = null;
    setDrag(null);
    // Under the threshold the card simply springs back.
    if (point) {
      const verdict = verdictFor(point);
      if (verdict) onIntent(verdict);
    }
  }

  const verdict = drag ? verdictFor(drag) : null;
  const leavingClass =
    leaving === 'yes'
      ? styles.goneRight
      : leaving === 'no'
        ? styles.goneLeft
        : leaving === 'priority'
          ? styles.goneUp
          : '';

  return (
    <article
      className={`${styles.card} ${drag ? '' : styles.settling} ${leavingClass}`}
      style={
        drag
          ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 22}deg)` }
          : undefined
      }
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {verdict ? <span className={styles.verdict}>{verdictLabel(verdict)}</span> : null}

      <div
        className={`${styles.photo} ${hatchClass}`}
        onClick={() => photos.length > 1 && setPhoto((index) => (index + 1) % photos.length)}
        role={photos.length > 1 ? 'button' : undefined}
        aria-label={photos.length > 1 ? 'Next photo' : undefined}
      >
        {current && !broken.has(current.url) ? (
          /* Fixture photos are arbitrary external URLs; next/image would need every
             host allow-listed, and E5 will replace them with Storage uploads. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt=""
            className={styles.photoImage}
            onError={() => setBroken((set) => new Set(set).add(current.url))}
          />
        ) : null}
        {/* College left, what they will do right — the two things worth knowing
            before the photo is even read. */}
        {card.college || card.helpTag ? (
          <div className={styles.photoTags}>
            {card.college ? <span className={styles.collegeTag}>{card.college}</span> : null}
            {card.helpTag ? <span className={styles.helpTag}>{card.helpTag}</span> : null}
          </div>
        ) : null}
        {photos.length > 1 ? (
          <>
            <span className={styles.photoScrim} />
            <Meta className={styles.photoMeta}>
              photo {photo + 1} / {photos.length}
            </Meta>
            <span className={styles.photoDots}>
              <Dots count={photos.length} active={photo} />
            </span>
          </>
        ) : null}
      </div>

      <div className={styles.body}>
        {/* The direction badge moves off the photo, which now belongs to the college
            and help tags, and reads as the kicker it always was. Dropped when the help
            tag already says it: "Can refer" twice on one card reads as a bug. */}
        {card.badge && card.badge !== card.helpTag ? (
          <Badge className={styles.badge}>{card.badge}</Badge>
        ) : null}

        <div className={styles.nameRow}>
          <h2 className={styles.name}>{card.name}</h2>
          {card.city ? <Meta>{card.city}</Meta> : null}
        </div>
        <p className={styles.role}>{card.deckLine}</p>

        {card.doors.length > 0 ? (
          <RefBox label="Can refer into" value={card.doors.join(' · ')} />
        ) : null}

        {card.headline ? <Quote>{card.headline}</Quote> : null}

        {card.tags.length > 0 ? (
          <div className={styles.tags}>
            {card.tags.slice(0, 4).map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** The three gestures as buttons, for anyone who would rather tap (mock 1a). */
export function SwipeActions({
  onIntent,
  disabled,
}: {
  onIntent: (action: SwipeAction) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        disabled={disabled}
        className={`${styles.act} ${styles.pass}`}
        onClick={() => onIntent('no')}
      >
        Pass
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="Priority ask"
        className={`${styles.act} ${styles.boost}`}
        onClick={() => onIntent('priority')}
      >
        ↑
      </button>
      <button
        type="button"
        disabled={disabled}
        className={`${styles.act} ${styles.yes}`}
        onClick={() => onIntent('yes')}
      >
        Yes
      </button>
    </div>
  );
}

export const deckClass = styles.deck;
export const emptyClass = styles.empty;
