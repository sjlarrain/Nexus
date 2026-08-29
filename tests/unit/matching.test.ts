import { describe, expect, it } from 'vitest';
import { counterpartOf, matchIdFor, pairKey, swipeIdFor } from '@/lib/matching/match-id';
import { suggestCompanies, industryForCompany, knownCompanies } from '@/lib/refdata/peer-map';
import { citiesForState, formatCity, parseCity, stateCodeForName } from '@/lib/refdata/locations';
import { generateFixture, generatePopulation, demoViewer } from '@/lib/fixtures/generate';
import { profileSchema } from '@/lib/schemas/profile';
import { canPublish } from '@/lib/onboarding/gates';

describe('match ids', () => {
  // The reason the id is derived rather than random: simultaneous mutual swipes.
  it('is the same whichever way round the pair is given', () => {
    expect(matchIdFor('alice', 'bob')).toBe(matchIdFor('bob', 'alice'));
  });

  it('differs between different pairs', () => {
    expect(matchIdFor('alice', 'bob')).not.toBe(matchIdFor('alice', 'carol'));
  });

  it('refuses a self-match', () => {
    expect(() => matchIdFor('alice', 'alice')).toThrow();
  });

  it('sorts the pair', () => {
    expect(pairKey('bob', 'alice')).toEqual(['alice', 'bob']);
    expect(pairKey('alice', 'bob')).toEqual(['alice', 'bob']);
  });

  it('keeps swipe ids directional, unlike match ids', () => {
    expect(swipeIdFor('alice', 'bob')).not.toBe(swipeIdFor('bob', 'alice'));
  });

  it('finds the other participant', () => {
    expect(counterpartOf(['alice', 'bob'], 'alice')).toBe('bob');
    expect(() => counterpartOf(['alice', 'bob'], 'carol')).toThrow();
  });
});

describe('company suggestions', () => {
  it('uses the peer map named in the spec', () => {
    expect(suggestCompanies('Figma', [], 5)).toEqual([
      'Notion',
      'Canva',
      'Adobe',
      'Linear',
      'Airtable',
    ]);
  });

  // Spec section 6: a company the user adds must render as an already-selected cell.
  it('puts user-added companies first so they render as selected', () => {
    const result = suggestCompanies('Figma', ['Vercel'], 5);
    expect(result[0]).toBe('Vercel');
    expect(result).toContain('Notion');
  });

  it('never suggests the employer itself', () => {
    expect(suggestCompanies('Notion', [], 10)).not.toContain('Notion');
  });

  it('falls back for an unknown employer instead of returning nothing', () => {
    const result = suggestCompanies('Some Tiny Startup', [], 5);
    expect(result.length).toBe(5);
  });

  it('does not drop selections that exceed the limit', () => {
    const selected = ['A', 'B', 'C', 'D', 'E', 'F'];
    expect(suggestCompanies('Figma', selected, 3)).toEqual(expect.arrayContaining(selected));
  });

  it('deduplicates case-insensitively', () => {
    const result = suggestCompanies('Figma', ['notion'], 5);
    expect(result.filter((c) => c.toLowerCase() === 'notion')).toHaveLength(1);
  });

  it('knows every company it can suggest', () => {
    expect(knownCompanies()).toContain('Figma');
    expect(industryForCompany('Stripe')).toBe('Fintech');
  });
});

describe('locations', () => {
  it('stores a city as "City, ST"', () => {
    expect(formatCity('Austin', 'TX')).toBe('Austin, TX');
  });

  it('round-trips through parseCity', () => {
    expect(parseCity('Austin, TX')).toEqual({ city: 'Austin', state: 'TX' });
  });

  it('rejects malformed or unknown values', () => {
    expect(parseCity('Austin')).toBeNull();
    expect(parseCity('Austin, ZZ')).toBeNull();
  });

  it('maps a state name back to its code', () => {
    expect(stateCodeForName('Texas')).toBe('TX');
    expect(stateCodeForName('Atlantis')).toBeNull();
  });

  it('returns an empty list for an unknown state rather than throwing', () => {
    expect(citiesForState('ZZ')).toEqual([]);
  });
});

describe('fixtures', () => {
  it('is deterministic for a given seed', () => {
    expect(generateFixture(7)).toEqual(generateFixture(7));
  });

  it('produces distinct people', () => {
    const people = generatePopulation(20);
    expect(new Set(people.map((p) => p.uid)).size).toBe(20);
  });

  it('produces profiles that pass their own schema', () => {
    for (const person of generatePopulation(25)) {
      const result = profileSchema.safeParse(person.profile);
      expect(result.success, `${person.uid}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  // A seeded person who cannot publish would never appear in a deck.
  it('produces profiles that are publishable', () => {
    for (const person of generatePopulation(25)) {
      const result = canPublish(person.profile);
      expect(result.ok, `${person.uid}: ${result.label}`).toBe(true);
    }
  });

  it('gives the demo viewer a complete, publishable profile', () => {
    const jordan = demoViewer();
    expect(profileSchema.safeParse(jordan.profile).success).toBe(true);
    expect(canPublish(jordan.profile).ok).toBe(true);
    expect(jordan.profile.company).toBe('Figma');
  });
});
