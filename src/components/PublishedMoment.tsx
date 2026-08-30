'use client';

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { PrimaryButton } from '@/components/ui';
import styles from './PublishedMoment.module.css';

/**
 * "Your card is live", as a popup over the review step rather than its own screen.
 *
 * Publishing is the end of a long form, so the confirmation still gets a beat of
 * celebration — but it dismisses itself after five seconds and carries on to the
 * deck, instead of parking the user on a screen whose only job is one button
 * (docs/decisions.md).
 */

const DISMISS_MS = 5000;

/** Piece colours, from the token palette in src/app/tokens.css. */
const CONFETTI_COLOURS = ['#e9b23c', '#3f6b4a', '#8a5a2b', '#14120f', '#f5e4b6'];

const PIECE_COUNT = 18;

/**
 * Deterministic rather than random: the burst looks the same every time, and there is
 * no server/client mismatch to reason about if this ever renders during hydration.
 */
const PIECES = Array.from({ length: PIECE_COUNT }, (_, index) => ({
  left: (index * 37) % 97,
  drift: ((index % 4) - 1.5) * 30,
  spin: index % 2 === 0 ? 520 : -430,
  delay: (index % 6) * 0.13,
  duration: 2.7 + (index % 5) * 0.22,
  colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
  round: index % 3 === 0,
}));

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeToMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Confetti that cannot move is just litter on the screen — globals.css kills every
 * animation under prefers-reduced-motion — so the pieces are not rendered at all.
 * The server snapshot is `false`: nothing animated until the client has read the query.
 */
function useMotionAllowed(): boolean {
  return useSyncExternalStore(
    subscribeToMotion,
    () => !window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export default function PublishedMoment({ onDismiss }: { onDismiss: () => void }) {
  // Through a ref so a re-render of the parent cannot restart the five seconds.
  const dismiss = useRef(onDismiss);
  const animate = useMotionAllowed();

  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), DISMISS_MS);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Your card is live">
      {animate ? (
        <div className={styles.confetti} aria-hidden="true">
          {PIECES.map((piece, index) => (
            <span
              key={index}
              className={`${styles.piece} ${piece.round ? styles.pieceRound : ''}`}
              /* Custom properties need the assertion; CSSProperties has no index signature. */
              style={
                {
                  left: `${piece.left}%`,
                  background: piece.colour,
                  '--drift': `${piece.drift}px`,
                  '--spin': `${piece.spin}deg`,
                  '--delay': `${piece.delay}s`,
                  '--duration': `${piece.duration}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <article className={styles.sheet}>
        <span className={styles.mark}>✓</span>
        <h2>Your card is live.</h2>
        <p>
          That is everything we needed. Start swiping to find people who can open a door — and who
          are looking for someone like you.
        </p>
        <PrimaryButton label="Start swiping" onClick={() => dismiss.current()} />
        <span className={styles.timer} aria-hidden="true">
          <span className={styles.timerFill} />
        </span>
      </article>
    </div>
  );
}
