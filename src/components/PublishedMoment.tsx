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

const PIECE_COUNT = 70;

/**
 * Deterministic rather than random: the burst looks the same every time, and there is
 * no server/client mismatch to reason about if this ever renders during hydration.
 *
 * The spread numbers are coprime-ish multiples so the pieces do not fall in visible
 * columns or in step with each other. Everything lands inside three seconds — the
 * longest delay plus the longest duration is 0.6 + 2.4.
 */
const PIECES = Array.from({ length: PIECE_COUNT }, (_, index) => ({
  left: (index * 37) % 97,
  drift: (((index * 13) % 9) - 4) * 22,
  spin: (index % 2 === 0 ? 1 : -1) * (400 + ((index * 53) % 420)),
  delay: ((index * 7) % 13) * 0.05,
  duration: 1.8 + ((index * 11) % 7) * 0.1,
  colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
  round: index % 4 === 0,
  /* Three sizes, so the burst has depth rather than reading as one flat sheet. */
  scale: 0.75 + ((index * 17) % 5) * 0.22,
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
                  '--scale': `${piece.scale}`,
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
