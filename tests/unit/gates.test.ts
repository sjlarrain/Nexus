import { describe, expect, it } from 'vitest';
import { allStepsComplete, canPublish, gateForStep, statusForStep } from '@/lib/onboarding/gates';
import { emptyProfile, type Profile } from '@/lib/schemas/profile';
import { PHOTO_SLOTS } from '@/lib/refdata/constants';

/** One row of docs/planup.md section 3 per describe block. */

function withPhotos(): Pick<Profile, 'photos'> {
  return {
    photos: PHOTO_SLOTS.map((slot) => ({
      slot,
      url: `https://example.test/${slot}.jpg`,
      storagePath: `users/u1/photos/${slot}`,
    })),
  };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return { ...emptyProfile(), ...overrides };
}

const step1Complete = profile({
  ...withPhotos(),
  headline: 'Product Designer',
  city: 'Austin, TX',
});

describe('step 1 — 3 photos, headline, city', () => {
  it('fails on an empty profile and says what to do first', () => {
    const result = gateForStep(1, profile());
    expect(result.ok).toBe(false);
    expect(result.label).toBe('Add 3 photos');
    expect(result.missing).toEqual(['photos', 'headline', 'city']);
  });

  it('still fails with only two photos', () => {
    const two = withPhotos().photos.slice(0, 2);
    expect(gateForStep(1, profile({ ...step1Complete, photos: two })).missing).toContain('photos');
  });

  it('treats a whitespace-only headline as missing', () => {
    expect(gateForStep(1, profile({ ...step1Complete, headline: '   ' })).ok).toBe(false);
  });

  it('passes when all three are present', () => {
    expect(gateForStep(1, step1Complete)).toEqual({ ok: true, label: 'Continue', missing: [] });
  });
});

describe('step 2 — mode selection', () => {
  it('asks for a mode before anything else', () => {
    const result = gateForStep(2, profile());
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['mode']);
  });
});

describe('step 2 — working: company, title, industry', () => {
  const complete = profile({
    mode: 'working',
    company: 'Figma',
    role: 'Product Designer',
    industry: ['Information Technology'],
  });

  it('passes when complete', () => {
    expect(gateForStep(2, complete).ok).toBe(true);
  });

  it.each([
    ['company', { company: '' }],
    ['role', { role: '' }],
    ['industry', { industry: [] }],
  ])('fails when %s is missing', (id, override) => {
    const result = gateForStep(2, { ...complete, ...override });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(id);
  });

  it('does not require a function, years, or a door', () => {
    const bare = { ...complete, lane: [], years: '' as const, referCompanies: [] };
    expect(gateForStep(2, bare).ok).toBe(true);
  });
});

describe('step 2 — student: school and graduation, both required', () => {
  it('accepts a school added in step 1, graduation year and all', () => {
    const p = profile({
      mode: 'student',
      schools: [{ name: 'UT Austin', course: 'MBA', year: '2028' }],
    });
    expect(gateForStep(2, p).ok).toBe(true);
  });

  it('accepts the inline fields instead', () => {
    const p = profile({ mode: 'student', school2: 'UT Austin', gradYear: '2028' });
    expect(gateForStep(2, p).ok).toBe(true);
  });

  it('fails with no school at all', () => {
    const result = gateForStep(2, profile({ mode: 'student' }));
    expect(result.missing).toEqual(['school', 'gradYear']);
  });

  it('fails with a school but no graduation year', () => {
    const result = gateForStep(2, profile({ mode: 'student', school2: 'UT Austin' }));
    expect(result.missing).toEqual(['gradYear']);
  });

  it('does not ask a student for industry, company or function', () => {
    const p = profile({ mode: 'student', school2: 'UT Austin', gradYear: '2028' });
    expect(gateForStep(2, { ...p, company: '', industry: [], lane: [] }).ok).toBe(true);
  });
});

describe('step 2 — looking out: most recent company and title only', () => {
  const complete = profile({ mode: 'looking', company: 'DoorDash', role: 'Senior PM' });

  it('passes when complete', () => {
    expect(gateForStep(2, complete).ok).toBe(true);
  });

  it.each([
    ['company', { company: '' }],
    ['role', { role: '' }],
  ])('fails when %s is missing', (id, override) => {
    expect(gateForStep(2, { ...complete, ...override }).missing).toContain(id);
  });

  it('asks for nothing else', () => {
    const bare = { ...complete, lane: [], industry: [], years: '' as const, referCompanies: [] };
    expect(gateForStep(2, bare).ok).toBe(true);
  });
});

describe('step 3 — one industry and one role, both required', () => {
  const complete = profile({
    industries: ['Information Technology'],
    lanes: ['Engineering/Product Development'],
  });

  it('passes when complete', () => {
    expect(gateForStep(3, complete).ok).toBe(true);
  });

  it.each([
    ['industries', { industries: [] }],
    ['lanes', { lanes: [] }],
  ])('fails when %s is empty', (id, override) => {
    expect(gateForStep(3, { ...complete, ...override }).missing).toContain(id);
  });

  it('does not require a target company', () => {
    expect(gateForStep(3, { ...complete, targetCompanies: [] }).ok).toBe(true);
  });
});

describe('step 4 — everything but the bio', () => {
  const complete = profile({ interests: ['Coffee'], openTo: ['Referrals'] });

  it('no longer lets an untouched step 4 through', () => {
    const result = gateForStep(4, profile());
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['interests', 'openTo']);
  });

  it('passes with interests and openTo, and an empty bio', () => {
    expect(gateForStep(4, { ...complete, bio: '' }).ok).toBe(true);
  });

  it('reports the review status from the same gate', () => {
    expect(statusForStep(4, profile())).toBe('Needs work');
    expect(statusForStep(4, complete)).toBe('Complete');
  });

  it('labels step 5 as Publish', () => {
    expect(gateForStep(5, profile()).label).toBe('Publish');
  });
});

describe('publishing', () => {
  const publishable = profile({
    ...step1Complete,
    mode: 'working',
    company: 'Figma',
    role: 'Product Designer',
    industry: ['Information Technology'],
    industries: ['Information Technology'],
    lanes: ['Engineering/Product Development'],
    interests: ['Coffee'],
    openTo: ['Referrals'],
  });

  it('requires steps 1 through 4 to pass', () => {
    expect(canPublish(publishable).ok).toBe(true);
    expect(allStepsComplete(publishable)).toBe(true);
  });

  it('reports the earliest unmet requirement', () => {
    const result = canPublish({ ...publishable, city: '' });
    expect(result.ok).toBe(false);
    expect(result.label).toBe('Choose your city');
  });

  it('now requires step 4 as well', () => {
    const result = canPublish({ ...publishable, interests: [], openTo: [] });
    expect(result.ok).toBe(false);
    expect(result.label).toBe('Pick what you are into');
    expect(allStepsComplete({ ...publishable, interests: [] })).toBe(false);
  });
});
