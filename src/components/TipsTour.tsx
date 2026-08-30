'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TIPS, dismissTips, tipsPending } from '@/lib/tips/tips';
import styles from './TipsTour.module.css';

type Rect = { top: number; left: number; width: number; height: number };

export type TourTargets = {
  card: RefObject<HTMLElement | null>;
  filters: RefObject<HTMLElement | null>;
  actions: RefObject<HTMLElement | null>;
};

/** Generous estimate of the callout's own height, used only to decide how much of a
    tall target to leave visible above it — see the note below. */
const CALLOUT_HEIGHT = 210;
const GAP = 14;
const MIN_SPOT_HEIGHT = 48;

function measure(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * The product tour over the deck (docs/mocks/planup-quick-tips.html): a spotlight ring
 * around the real element, plus a callout beside it — never a fixed panel that could
 * cover the very thing being pointed at.
 *
 * It runs once, after the card is published and not before — `tipsPending()` in
 * src/lib/tips/tips.ts says why — or on demand with `?tips=1`.
 *
 * Each target is scrolled into view first (the deck card is often taller than the
 * screen), then the callout goes below it if there is room, above it if there is
 * not but there is room up there instead (the swipe row, scrolled near the bottom),
 * or — only for something taller than the screen either way, i.e. the card — below
 * a spot capped to what still fits above the callout. Capping the *top* of the spot
 * instead was tried and rejected: it hid exactly the part of the card the first tip
 * is describing, to buy room that would only place the callout over the app's own
 * header.
 */
export default function TipsTour({ targets }: { targets: TourTargets }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const replay = searchParams.get('tips') === '1';

  const [step, setStep] = useState(() => (replay || tipsPending() ? 1 : 0));
  const [rect, setRect] = useState<Rect | null>(null);

  const target = TIPS[step - 1]?.target ?? null;

  const finish = useCallback(() => {
    setStep(0);
    dismissTips();
    if (replay) router.replace('/deck');
  }, [replay, router]);

  // Deferred so the setState is never called synchronously inside the effect body,
  // and so the scroll (instant, but still a layout pass) settles before measuring.
  useEffect(() => {
    if (step === 0) return;
    const timer = setTimeout(() => {
      const el = target ? targets[target].current : null;
      // A target that is not on screen — the swipe row when the deck has run out —
      // has nothing to point at, so the tour steps over it rather than stalling on
      // a spotlight it cannot measure.
      if (!el) {
        if (step >= TIPS.length) finish();
        else setStep(step + 1);
        return;
      }
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
      setRect(measure(el));
    }, 0);
    return () => clearTimeout(timer);
  }, [step, target, targets, finish]);

  useEffect(() => {
    if (step === 0) return;
    function onResize(): void {
      setRect(measure(target ? targets[target].current : null));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [step, target, targets]);

  useEffect(() => {
    if (step === 0) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, finish]);

  if (step === 0 || !rect) return null;

  const tip = TIPS[step - 1];
  if (!tip) return null;

  const pad = 6;
  const viewportH = window.innerHeight;
  const spotTop = rect.top - pad;
  const spotLeft = rect.left - pad;
  const spotWidth = rect.width + pad * 2;
  const spotBottomRaw = rect.top + rect.height + pad;

  const spaceBelow = viewportH - spotBottomRaw;
  const spaceAbove = spotTop;

  // Three cases, in order: the target fits with room to spare below it, the same
  // above it, or (a target taller than the screen — the deck card) it doesn't fit
  // either way, so its bottom edge is capped to leave room for the callout below.
  // Capping the *top* instead was tried and rejected: it hid exactly the part of
  // the card the first tip is describing, to buy room that would only place the
  // callout over the app's own header.
  let spotBottom = spotBottomRaw;
  let calloutTop: number;
  let below: boolean;

  if (spaceBelow >= CALLOUT_HEIGHT + GAP) {
    calloutTop = spotBottomRaw + GAP;
    below = true;
  } else if (spaceAbove >= CALLOUT_HEIGHT + GAP) {
    calloutTop = spotTop - GAP - CALLOUT_HEIGHT;
    below = false;
  } else {
    spotBottom = Math.max(spotTop + MIN_SPOT_HEIGHT, viewportH - CALLOUT_HEIGHT - GAP);
    calloutTop = spotBottom + GAP;
    below = true;
  }

  const spotHeight = spotBottom - spotTop;

  function next(): void {
    if (step >= TIPS.length) finish();
    else setStep(step + 1);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Quick tips">
      <div
        className={styles.cutout}
        style={{ top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight }}
      />
      <div
        className={styles.ring}
        style={{ top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight }}
      />

      <div className={styles.calloutWrap} style={{ top: calloutTop }}>
        {below ? <span className={styles.arrowUp} /> : null}
        <div className={styles.callout}>
          <div className={styles.head}>
            <span className={styles.eyebrow}>
              {tip.eyebrow} · {step} of {TIPS.length}
            </span>
            <button type="button" className={styles.skip} onClick={finish}>
              Skip
            </button>
          </div>
          <p className={styles.title}>{tip.title}</p>
          <p className={styles.body}>{tip.body}</p>
          <div className={styles.foot}>
            <div className={styles.dots}>
              {TIPS.map((item, index) => (
                <span key={item.eyebrow} className={index === step - 1 ? styles.dotOn : styles.dot} />
              ))}
            </div>
            <button type="button" className={styles.next} onClick={next}>
              {step >= TIPS.length ? 'Start swiping' : 'Next'}
            </button>
          </div>
        </div>
        {below ? null : <span className={styles.arrowDown} />}
      </div>
    </div>
  );
}
