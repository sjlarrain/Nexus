import { describe, expect, it } from 'vitest';
import { DEMO_LIKE_SHARE, planDemoLikes } from '@/lib/matching/demo-plan';

/**
 * The rule this file guards got shipped wrong once: the share was taken of whoever
 * was left after the account's swipe history, so an account that had been demoed on
 * received 27 people where 32 were asked for, and nothing said so.
 */

const population = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `demo-${String(index + 1).padStart(3, '0')}`);

describe('planDemoLikes', () => {
  it('has 70% of the population like a new account', () => {
    const eligible = population(42);
    const { toLike } = planDemoLikes({ eligible, share: DEMO_LIKE_SHARE });
    expect(toLike.length / eligible.length).toBeGreaterThanOrEqual(0.7);
    expect(toLike).toHaveLength(30);
  });

  it('takes the share of the whole population, not of the untouched remainder', () => {
    const eligible = population(42);
    // The naive version measured against what was left and came up short.
    const { toLike } = planDemoLikes({ eligible, share: DEMO_LIKE_SHARE });
    expect(toLike).toHaveLength(Math.ceil(42 * DEMO_LIKE_SHARE));
  });

  it('never manufactures a like from someone the account already swiped on', () => {
    const eligible = population(10);
    // A yes here would be a mutual yes with no match document; a no was a deliberate
    // dismissal. Neither may be resurrected as an inbound like.
    const alreadySwiped = new Set(['demo-001', 'demo-002']);
    const { toLike } = planDemoLikes({ eligible, alreadySwiped, share: DEMO_LIKE_SHARE });

    expect(toLike).not.toContain('demo-001');
    expect(toLike).not.toContain('demo-002');
    expect(toLike).toEqual([
      'demo-003',
      'demo-004',
      'demo-005',
      'demo-006',
      'demo-007',
      'demo-008',
      'demo-009',
    ]);
  });

  it('gives a part-way-through account fewer rather than a manufactured match', () => {
    const eligible = population(10);
    // Only two left untouched, but the share asks for seven.
    const alreadySwiped = new Set(eligible.slice(0, 8));
    const { toLike } = planDemoLikes({ eligible, alreadySwiped, share: DEMO_LIKE_SHARE });
    expect(toLike).toEqual(['demo-009', 'demo-010']);
  });

  it('never asks for more people than exist', () => {
    const eligible = population(3);
    const { toLike } = planDemoLikes({ eligible, share: 1.5 });
    expect(toLike).toHaveLength(3);
  });

  it('leaves some of the population unliked, so the deck holds fresh cards too', () => {
    const eligible = population(42);
    const { toLike } = planDemoLikes({ eligible, share: DEMO_LIKE_SHARE });
    expect(eligible.length - toLike.length).toBeGreaterThan(0);
  });

  it('creates no matches — every thread has to be swiped for', () => {
    const eligible = population(42);
    const plan = planDemoLikes({ eligible, share: DEMO_LIKE_SHARE });
    expect(Object.keys(plan)).toEqual(['toLike']);
  });

  it('is deterministic for the same input', () => {
    const eligible = population(42);
    const first = planDemoLikes({ eligible, share: DEMO_LIKE_SHARE });
    const second = planDemoLikes({ eligible, share: DEMO_LIKE_SHARE });
    expect(second).toEqual(first);
  });

  it('copes with an empty population', () => {
    expect(planDemoLikes({ eligible: [], share: DEMO_LIKE_SHARE })).toEqual({ toLike: [] });
  });
});
