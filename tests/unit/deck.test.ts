import { describe, expect, it } from 'vitest';
import {
  directionsComplement,
  explain,
  passesFilters,
  rankDeck,
  WEIGHTS,
  type Candidate,
} from '@/lib/deck/rank';
import { emptyProfile, type Profile } from '@/lib/schemas/profile';

const NOW = 1_700_000_000_000;
const daysAgo = (n: number) => NOW - n * 86_400_000;

function profile(overrides: Partial<Profile> = {}): Profile {
  return { ...emptyProfile(), ...overrides };
}

function candidate(uid: string, overrides: Partial<Profile> = {}, lastActiveAt = NOW): Candidate {
  return { uid, profile: profile(overrides), lastActiveAt };
}

const viewer = profile({
  direction: 'looking',
  targetCompanies: ['Notion', 'Linear', 'Stripe'],
  industries: ['Software', 'Fintech'],
  lanes: ['Product Design'],
});

describe('direction complement', () => {
  it('pairs someone referring with someone looking', () => {
    expect(directionsComplement('refer', 'looking')).toBe(true);
    expect(directionsComplement('looking', 'refer')).toBe(true);
  });

  it('does not pair two people facing the same way', () => {
    expect(directionsComplement('refer', 'refer')).toBe(false);
    expect(directionsComplement('looking', 'looking')).toBe(false);
  });

  it('treats "both" as complementing anyone', () => {
    expect(directionsComplement('both', 'both')).toBe(true);
    expect(directionsComplement('both', 'refer')).toBe(true);
  });
});

describe('scoring', () => {
  it('rewards a door at a company I am targeting', () => {
    const score = explain(viewer, candidate('a', { referCompanies: ['Notion'] }), NOW);
    expect(score.doorOverlap).toBe(WEIGHTS.perDoorMatch);
  });

  it('caps door overlap so one person cannot dominate the deck', () => {
    const many = candidate('a', { referCompanies: ['Notion', 'Linear', 'Stripe'] });
    expect(explain(viewer, many, NOW).doorOverlap).toBe(WEIGHTS.doorMatchCap);
  });

  it('ignores doors at companies I am not targeting', () => {
    expect(explain(viewer, candidate('a', { referCompanies: ['Wendys'] }), NOW).doorOverlap).toBe(0);
  });

  it('matches company names case-insensitively', () => {
    expect(explain(viewer, candidate('a', { referCompanies: ['notion'] }), NOW).doorOverlap).toBe(
      WEIGHTS.perDoorMatch,
    );
  });

  it('scores industry and function overlap', () => {
    const score = explain(
      viewer,
      candidate('a', { industries: ['Software'], lanes: ['Product Design'] }),
      NOW,
    );
    expect(score.industryOverlap).toBe(WEIGHTS.perIndustry);
    expect(score.laneOverlap).toBe(WEIGHTS.perLane);
  });

  it('decays recency to zero over the window', () => {
    expect(explain(viewer, candidate('a', {}, NOW), NOW).recency).toBe(WEIGHTS.recencyMax);
    expect(explain(viewer, candidate('a', {}, daysAgo(30)), NOW).recency).toBe(0);
    const midway = explain(viewer, candidate('a', {}, daysAgo(7)), NOW).recency;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(WEIGHTS.recencyMax);
  });

  it('handles a candidate who has never been active', () => {
    expect(explain(viewer, candidate('a', {}, null as unknown as number), NOW).recency).toBe(0);
  });

  it('totals its own parts', () => {
    const score = explain(
      viewer,
      candidate('a', { referCompanies: ['Notion'], direction: 'refer', industries: ['Software'] }),
      NOW,
    );
    expect(score.total).toBe(
      score.doorOverlap + score.directionComplement + score.industryOverlap + score.laneOverlap + score.recency,
    );
  });
});

describe('filters', () => {
  const person = candidate('a', {
    industry: 'Software',
    industries: ['Fintech'],
    lane: 'Product Design',
    lanes: ['Product Management'],
    city: 'Austin, TX',
    direction: 'refer',
  });

  it('passes when nothing is filtered', () => {
    expect(passesFilters(person, {})).toBe(true);
  });

  it('matches the current industry or a wanted one', () => {
    expect(passesFilters(person, { industries: ['Software'] })).toBe(true);
    expect(passesFilters(person, { industries: ['Fintech'] })).toBe(true);
    expect(passesFilters(person, { industries: ['Biotech'] })).toBe(false);
  });

  it('matches the current function or a targeted one', () => {
    expect(passesFilters(person, { lanes: ['Product Design'] })).toBe(true);
    expect(passesFilters(person, { lanes: ['Sales'] })).toBe(false);
  });

  it('matches the stored "City, ST" value exactly', () => {
    expect(passesFilters(person, { cities: ['Austin, TX'] })).toBe(true);
    expect(passesFilters(person, { cities: ['Dallas, TX'] })).toBe(false);
  });

  it('filters on complementary direction, not equality', () => {
    expect(passesFilters(person, { direction: 'looking' })).toBe(true);
    expect(passesFilters(person, { direction: 'refer' })).toBe(false);
  });
});

describe('rankDeck', () => {
  const candidates: Candidate[] = [
    candidate('door-and-direction', { referCompanies: ['Notion', 'Linear'], direction: 'refer' }),
    candidate('direction-only', { direction: 'refer' }),
    candidate('nothing', { direction: 'looking' }, daysAgo(20)),
  ];

  it('puts the strongest match first', () => {
    const ranked = rankDeck(viewer, candidates, { now: NOW, seed: 1 });
    expect(ranked[0]?.uid).toBe('door-and-direction');
    expect(ranked.at(-1)?.uid).toBe('nothing');
  });

  it('is reproducible for a given seed', () => {
    const a = rankDeck(viewer, candidates, { now: NOW, seed: 42 }).map((c) => c.uid);
    const b = rankDeck(viewer, candidates, { now: NOW, seed: 42 }).map((c) => c.uid);
    expect(a).toEqual(b);
  });

  it('applies filters before ranking', () => {
    const ranked = rankDeck(viewer, candidates, {
      now: NOW,
      filters: { direction: 'looking' },
      seed: 1,
    });
    expect(ranked.map((c) => c.uid)).not.toContain('nothing');
  });

  it('returns every candidate when nothing is filtered', () => {
    expect(rankDeck(viewer, candidates, { now: NOW, seed: 1 })).toHaveLength(candidates.length);
  });

  it('keeps strong candidates ahead of weak ones despite the shuffle', () => {
    const many = [
      ...Array.from({ length: 5 }, (_, i) =>
        candidate(`strong-${i}`, { referCompanies: ['Notion', 'Linear', 'Stripe'], direction: 'refer' }),
      ),
      ...Array.from({ length: 5 }, (_, i) => candidate(`weak-${i}`, { direction: 'looking' }, daysAgo(20))),
    ];
    const ranked = rankDeck(viewer, many, { now: NOW, seed: 3, bandSize: 2 });
    expect(ranked.slice(0, 5).every((c) => c.uid.startsWith('strong'))).toBe(true);
  });

  it('handles an empty candidate list', () => {
    expect(rankDeck(viewer, [], { now: NOW })).toEqual([]);
  });
});
