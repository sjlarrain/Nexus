'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TIPS, hasSeenTips, markTipsSeen } from '@/lib/tips/tips';
import styles from './TipsTour.module.css';

type Rect = { top: number; left: number; width: number; height: number };

export type TourTargets = {
  card: RefObject<HTMLElement | null>;
  filters: RefObject<HTMLElement | null>;
  actions: RefObject<HTMLElement | null>;
};

function measure(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * First-run product tour over the deck (docs/mocks/planup-quick-tips.html): a
 * spotlight cut into a dark backdrop, plus a callout, one step per target.
 *
 * The spotlight comes from `getBoundingClientRect()` on the real elements rather
 * than the mock's hardcoded pixel values — its 382×812 frame is a fixed
 * presentation board, and this app runs at whatever size the device actually is.
 * The mock's callout sits beside the spot with a pointing arrow, sized to fit the
 * gap its fixed frame leaves; here the first step's spot is the whole card, which
 * on a real phone can run edge to edge and leave no such gap. So the callout is a
 * bottom sheet instead — the same pattern Filters and Activity already use — and
 * only the spotlight ring moves to say what step 1 through 3 is about.
 *
 * Only ever mounted once the deck has already loaded (the caller's own loading
 * gate), so the starting step is decided once, at mount, from whether `?tips=1`
 * is on the URL — how the profile screen's "Replay tips" link asks for it — or
 * this is the first visit.
 */
export default function TipsTour({ targets }: { targets: TourTargets }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const replay = searchParams.get('tips') === '1';

  const [step, setStep] = useState(() => (replay || !hasSeenTips() ? 1 : 0));
  const [rect, setRect] = useState<Rect | null>(null);

  const target = TIPS[step - 1]?.target ?? null;

  // Deferred rather than measured synchronously in the effect body, so the
  // setState call is never direct — a plain macrotask rather than
  // `requestAnimationFrame`, which a backgrounded tab can pause indefinitely and
  // this measurement does not depend on paint timing to be correct.
  useEffect(() => {
    const timer = setTimeout(() => {
      setRect(measure(target ? targets[target].current : null));
    }, 0);
    return () => clearTimeout(timer);
  }, [target, targets]);

  useEffect(() => {
    if (step === 0) return;
    function onResize(): void {
      setRect(measure(target ? targets[target].current : null));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [step, target, targets]);

  const finish = useCallback(() => {
    setStep(0);
    markTipsSeen();
    if (replay) router.replace('/deck');
  }, [replay, router]);

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
  const spot = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  function next(): void {
    if (step >= TIPS.length) finish();
    else setStep(step + 1);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Quick tips">
      <div className={styles.cutout} style={spot} />
      <div className={styles.ring} style={spot} />

      <div className={styles.sheet}>
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
    </div>
  );
}
