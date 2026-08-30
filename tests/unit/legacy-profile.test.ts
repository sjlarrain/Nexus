import { describe, expect, it } from 'vitest';
import { emptyProfile, profileSchema } from '@/lib/schemas/profile';
import { landingRouteFor } from '@/lib/onboarding/landing';

/**
 * Documents written before `industry`/`lane` became multi-select and before the years
 * bands were cut to three.
 *
 * These are not hypothetical: profiles in the deployed project are in exactly this
 * shape, and until the coercion existed every one of them failed validation on read —
 * which took out `/api/me`, and with it the profile and onboarding screens.
 */

/** A published profile as it was stored before the onboarding revision. */
function legacyRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...emptyProfile(),
    first: 'Sam',
    last: 'Rivera',
    photos: (['headshot', 'at-work', 'off-the-clock'] as const).map((slot) => ({
      slot,
      url: `https://example.test/${slot}.jpg`,
      storagePath: `users/u1/photos/${slot}`,
    })),
    headline: 'Product Designer at Figma',
    city: 'Austin, TX',
    mode: 'working',
    company: 'Figma',
    role: 'Product Designer',
    // The three fields whose shape changed.
    industry: 'Software',
    lane: 'Product Design',
    years: '4-6',
    industries: ['Fintech'],
    lanes: ['Product Management'],
    onboarding: { step: 5, completed: true, publishedAt: 1 },
    ...overrides,
  };
}

describe('legacy documents still parse', () => {
  it('lifts a scalar industry and lane into one-item arrays', () => {
    const parsed = profileSchema.parse(legacyRecord());
    expect(parsed.industry).toEqual(['Software']);
    expect(parsed.lane).toEqual(['Product Design']);
  });

  it('treats an empty scalar as an empty list, not a one-item list of ""', () => {
    const parsed = profileSchema.parse(legacyRecord({ industry: '', lane: '   ' }));
    expect(parsed.industry).toEqual([]);
    expect(parsed.lane).toEqual([]);
  });

  it('survives the field being absent or null', () => {
    const parsed = profileSchema.parse(legacyRecord({ industry: null, lane: undefined }));
    expect(parsed.industry).toEqual([]);
    expect(parsed.lane).toEqual([]);
  });

  it('leaves an already-migrated array alone', () => {
    const parsed = profileSchema.parse(legacyRecord({ industry: ['Energy', 'Utilities'] }));
    expect(parsed.industry).toEqual(['Energy', 'Utilities']);
  });

  it.each([
    ['0-1', '0-5'],
    ['2-3', '0-5'],
    ['4-6', '5-10'],
    ['7-10', '5-10'],
    ['10+', '10+'],
    ['', ''],
  ])('maps the retired years band %s onto %s', (stored, expected) => {
    expect(profileSchema.parse(legacyRecord({ years: stored })).years).toBe(expected);
  });

  it('still rejects a genuinely invalid value', () => {
    expect(profileSchema.safeParse(legacyRecord({ years: 'ages' })).success).toBe(false);
    expect(profileSchema.safeParse(legacyRecord({ city: 'Austin' })).success).toBe(false);
  });
});

describe('landingRouteFor', () => {
  const complete = {
    ...profileSchema.parse(legacyRecord()),
    interests: ['Coffee'],
    openTo: ['Referrals' as const],
  };

  it('sends a signed-in user mid-onboarding back to their step', () => {
    const user = { ...complete, onboarding: { step: 3, completed: false } };
    expect(landingRouteFor(user)).toBe('/onboarding/3');
  });

  it('sends a genuinely complete published user to the deck', () => {
    expect(landingRouteFor({ ...complete, onboarding: { step: 5, completed: true } })).toBe(
      '/deck',
    );
  });

  it('does not strand a published profile that no longer passes the gates', () => {
    // Published before step 4 became mandatory: the flag says complete, the gates
    // disagree, and /deck would be a dead end.
    const stale = {
      ...complete,
      interests: [],
      openTo: [],
      onboarding: { step: 5, completed: true },
    };
    expect(landingRouteFor(stale)).toBe('/onboarding/4');
  });

  it('names the earliest failing step, not the last', () => {
    const stale = {
      ...complete,
      city: '',
      interests: [],
      onboarding: { step: 5, completed: true },
    };
    expect(landingRouteFor(stale)).toBe('/onboarding/1');
  });

  it('falls back to the top of onboarding for an unparseable document', () => {
    const broken = { onboarding: { step: 5, completed: true }, city: 'not a city' };
    expect(landingRouteFor(broken)).toBe('/onboarding/1');
  });
});
