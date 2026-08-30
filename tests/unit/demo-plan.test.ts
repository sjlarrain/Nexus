import { describe, expect, it } from 'vitest';
import { DEMO_MATCH_SHARE, planDemoMatches } from '@/lib/matching/demo-plan';

/**
 * The rule this file guards got shipped wrong once: the share was taken of whoever
 * was left after the account's swipe history, so an account that had been demoed on
 * received 27 matches where 32 were asked for, and nothing said so.
 */

const population = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `demo-${String(index + 1).padStart(3, '0')}`);

describe('planDemoMatches', () => {
  it('matches at least 70% of the population', () => {
    const eligible = population(42);
    const { toMatch } = planDemoMatches({ eligible, share: DEMO_MATCH_SHARE });
    expect(toMatch.length / eligible.length).toBeGreaterThanOrEqual(0.7);
    expect(toMatch).toHaveLength(32);
  });

  it('takes the share of the whole population, not of the untouched remainder', () => {
    const eligible = population(42);
    // Six already swiped on: the naive version returned ceil(36 * 0.75) = 27.
    const alreadySwiped = new Set(eligible.slice(0, 6));
    const { toMatch } = planDemoMatches({ eligible, alreadySwiped, share: DEMO_MATCH_SHARE });
    expect(toMatch).toHaveLength(32);
    expect(toMatch.length / eligible.length).toBeGreaterThanOrEqual(0.7);
  });

  it('prefers people not yet swiped on, and only tops up from the rest', () => {
    const eligible = population(10);
    const alreadySwiped = new Set(['demo-001', 'demo-002']);
    const { toMatch } = planDemoMatches({ eligible, alreadySwiped, share: 0.75 });

    expect(toMatch).toHaveLength(8);
    // The eight are the untouched ones first; the two seen sit at the tail.
    expect(toMatch.slice(0, 8)).toEqual([
      'demo-003',
      'demo-004',
      'demo-005',
      'demo-006',
      'demo-007',
      'demo-008',
      'demo-009',
      'demo-010',
    ]);
  });

  it('never asks for more people than exist', () => {
    const eligible = population(3);
    const { toMatch, toLike } = planDemoMatches({ eligible, share: 1.5 });
    expect(toMatch).toHaveLength(3);
    expect(toLike).toHaveLength(0);
  });

  it('leaves some of the population unmatched, so the deck is not empty', () => {
    const eligible = population(42);
    const { toMatch, toLike } = planDemoMatches({ eligible, share: DEMO_MATCH_SHARE });
    const untouched = eligible.length - toMatch.length - toLike.length;
    expect(toLike.length).toBeGreaterThan(0);
    expect(untouched).toBeGreaterThan(0);
  });

  it('never puts the same person in both lists', () => {
    const eligible = population(42);
    const { toMatch, toLike } = planDemoMatches({ eligible, share: DEMO_MATCH_SHARE });
    const overlap = toMatch.filter((uid) => toLike.includes(uid));
    expect(overlap).toEqual([]);
  });

  it('is deterministic for the same input', () => {
    const eligible = population(42);
    const first = planDemoMatches({ eligible, share: DEMO_MATCH_SHARE });
    const second = planDemoMatches({ eligible, share: DEMO_MATCH_SHARE });
    expect(second).toEqual(first);
  });

  it('copes with an empty population', () => {
    expect(planDemoMatches({ eligible: [], share: DEMO_MATCH_SHARE })).toEqual({
      toMatch: [],
      toLike: [],
    });
  });
});
