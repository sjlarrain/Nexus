import { describe, expect, it } from 'vitest';
import { canPublish, gateForStep, statusForStep } from '@/lib/onboarding/gates';
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

const step1Complete = profile({ ...withPhotos(), headline: 'Product Designer', city: 'Austin, TX' });

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

describe('step 2 — working: company, title, industry, years, one door', () => {
  const complete = profile({
    mode: 'working',
    company: 'Figma',
    role: 'Product Designer',
    industry: 'Software',
    years: '4-6',
    referCompanies: ['Notion'],
  });

  it('passes when complete', () => {
    expect(gateForStep(2, complete).ok).toBe(true);
  });

  it.each([
    ['company', { company: '' }],
    ['role', { role: '' }],
    ['industry', { industry: '' }],
    ['years', { years: '' as const }],
    ['referCompanies', { referCompanies: [] }],
  ])('fails when %s is missing', (id, override) => {
    const result = gateForStep(2, { ...complete, ...override });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(id);
  });
});

describe('step 2 — student: a school and a function', () => {
  it('accepts a school added in step 1', () => {
    const p = profile({
      mode: 'student',
      lane: 'Design',
      schools: [{ name: 'UT Austin', course: 'MBA', year: '2028' }],
    });
    expect(gateForStep(2, p).ok).toBe(true);
  });

  it('accepts the inline school field instead', () => {
    const p = profile({ mode: 'student', lane: 'Design', school2: 'UT Austin' });
    expect(gateForStep(2, p).ok).toBe(true);
  });

  it('fails with no school at all', () => {
    const result = gateForStep(2, profile({ mode: 'student', lane: 'Design' }));
    expect(result.missing).toEqual(['school']);
  });

  it('does not require years or industry', () => {
    const p = profile({ mode: 'student', lane: 'Design', school2: 'UT Austin', years: '' });
    expect(gateForStep(2, p).ok).toBe(true);
  });
});

describe('step 2 — looking out: recent company, function, years', () => {
  const complete = profile({
    mode: 'looking',
    company: 'DoorDash',
    lane: 'Product',
    years: '7-10',
  });

  it('passes when complete', () => {
    expect(gateForStep(2, complete).ok).toBe(true);
  });

  it('does not require a title, unlike the working branch', () => {
    expect(gateForStep(2, { ...complete, role: '' }).ok).toBe(true);
  });

  it('does not require a door company, unlike the working branch', () => {
    expect(gateForStep(2, { ...complete, referCompanies: [] }).ok).toBe(true);
  });
});

describe('step 3 — one industry, one role, one target company', () => {
  const complete = profile({
    industries: ['Software'],
    lanes: ['Product'],
    targetCompanies: ['Notion'],
  });

  it('passes when complete', () => {
    expect(gateForStep(3, complete).ok).toBe(true);
  });

  it.each([
    ['industries', { industries: [] }],
    ['lanes', { lanes: [] }],
    ['targetCompanies', { targetCompanies: [] }],
  ])('fails when %s is empty', (id, override) => {
    expect(gateForStep(3, { ...complete, ...override }).missing).toContain(id);
  });
});

describe('steps 4 and 5 — nothing required', () => {
  it('lets an untouched step 4 through', () => {
    expect(gateForStep(4, profile()).ok).toBe(true);
  });

  it('reports step 4 as skipped when untouched, complete when filled', () => {
    expect(statusForStep(4, profile())).toBe('Skipped');
    expect(statusForStep(4, profile({ bio: 'Hi' }))).toBe('Complete');
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
    industry: 'Software',
    years: '4-6',
    referCompanies: ['Notion'],
    industries: ['Software'],
    lanes: ['Product'],
    targetCompanies: ['Notion'],
  });

  it('requires steps 1 through 3 to pass', () => {
    expect(canPublish(publishable).ok).toBe(true);
  });

  it('reports the earliest unmet requirement', () => {
    const result = canPublish({ ...publishable, city: '' });
    expect(result.ok).toBe(false);
    expect(result.label).toBe('Choose your city');
  });

  it('does not require step 4', () => {
    expect(canPublish({ ...publishable, bio: '', interests: [], openTo: [] }).ok).toBe(true);
  });
});
