import { describe, expect, it } from 'vitest';
import {
  badgeFor,
  collegesFor,
  composeRoleLine,
  deckLineFor,
  helpTagFor,
  roleLineFor,
  tagsFor,
  toCard,
} from '@/lib/cards/card';
import { emptyProfile, type Profile } from '@/lib/schemas/profile';

function profile(overrides: Partial<Profile> = {}): Profile {
  return { ...emptyProfile(), ...overrides };
}

describe('composeRoleLine', () => {
  it('joins the parts it has with the separator', () => {
    expect(composeRoleLine('Senior PM', 'DoorDash', 'Austin, TX')).toBe(
      'Senior PM · DoorDash · Austin, TX',
    );
  });

  // Spec section 6: a missing city must not leave a dangling separator.
  it('drops empty parts instead of leaving a dangling separator', () => {
    expect(composeRoleLine('Senior PM', 'DoorDash', '')).toBe('Senior PM · DoorDash');
    expect(composeRoleLine('', 'DoorDash', 'Austin, TX')).toBe('DoorDash · Austin, TX');
    expect(composeRoleLine('Senior PM', '', 'Austin, TX')).toBe('Senior PM · Austin, TX');
  });

  it('treats whitespace-only and nullish parts as empty', () => {
    expect(composeRoleLine('Senior PM', '   ', null, undefined, 'Austin, TX')).toBe(
      'Senior PM · Austin, TX',
    );
  });

  it('returns an empty string when it has nothing', () => {
    expect(composeRoleLine('', null, undefined)).toBe('');
  });
});

describe('roleLineFor', () => {
  it('leads with role and company for someone working', () => {
    const p = profile({
      mode: 'working',
      role: 'Product Designer',
      company: 'Figma',
      city: 'San Francisco, CA',
    });
    expect(roleLineFor(p)).toBe('Product Designer · Figma · San Francisco, CA');
  });

  it('leads with the school for a student, who has no title or function', () => {
    const p = profile({
      mode: 'student',
      schools: [{ name: 'Michigan', course: 'MBA', year: '2028' }],
      city: 'Ann Arbor, MI',
    });
    expect(roleLineFor(p)).toBe('Michigan · Ann Arbor, MI');
  });

  it('falls back to the inline school field for a student', () => {
    const p = profile({ mode: 'student', school2: 'NYU', city: 'New York, NY' });
    expect(roleLineFor(p)).toBe('NYU · New York, NY');
  });

  it('marks a past employer for someone looking out', () => {
    const p = profile({
      mode: 'looking',
      role: 'Senior PM',
      company: 'DoorDash',
      city: 'Austin, TX',
    });
    expect(roleLineFor(p)).toBe('Senior PM · ex-DoorDash · Austin, TX');
  });

  it('survives a half-filled profile mid-onboarding', () => {
    expect(roleLineFor(profile({ mode: null, role: 'Designer' }))).toBe('Designer');
  });
});

describe('badgeFor', () => {
  it.each([
    ['refer', 'Can refer'],
    ['looking', 'Looking'],
    ['both', 'Open both ways'],
  ] as const)('maps direction %s to %s', (direction, expected) => {
    expect(badgeFor({ direction, mode: 'working' })).toBe(expected);
  });

  it('prefers the student badge over direction', () => {
    expect(badgeFor({ direction: 'refer', mode: 'student' })).toBe('Student');
  });
});

describe('tagsFor', () => {
  it('deduplicates case-insensitively and respects the limit', () => {
    const p = profile({
      industry: ['Software'],
      lanes: ['Product Design', 'software'],
      interests: ['Coffee', 'Climbing', 'Film', 'Pottery', 'Running'],
    });
    const tags = tagsFor(p, 4);
    expect(tags).toEqual(['Software', 'Product Design', 'Coffee', 'Climbing']);
  });

  it('skips empty values', () => {
    expect(tagsFor(profile({ industry: [], lanes: [''], interests: ['Coffee'] }))).toEqual([
      'Coffee',
    ]);
  });
});

describe('toCard', () => {
  const p = profile({
    first: 'Jordan',
    last: 'Reyes',
    mode: 'working',
    role: 'Product Designer',
    company: 'Figma',
    city: 'San Francisco, CA',
    headline: 'Happy to refer designers.',
    direction: 'both',
    referCompanies: ['Notion'],
  });

  it('builds the name from first and last', () => {
    expect(toCard('u1', p).name).toBe('Jordan Reyes');
  });

  it('handles a missing last name without a trailing space', () => {
    expect(toCard('u1', { ...p, last: '' }).name).toBe('Jordan');
  });

  it('carries only card fields, never the whole profile', () => {
    const card = toCard('u1', { ...p, bio: 'secret-ish' });
    expect(Object.keys(card).sort()).toEqual(
      [
        'badge',
        'city',
        'colleges',
        'deckLine',
        'direction',
        'doors',
        'headline',
        'helpTag',
        'name',
        'openTo',
        'photos',
        'prompts',
        'roleLine',
        'tags',
        'uid',
      ].sort(),
    );
  });
});

/** Mock 1a lifts the city into the name row, so the deck line drops it. */
describe('deckLineFor', () => {
  it('reads role, employer and tenure', () => {
    const card = deckLineFor(
      profile({
        mode: 'working',
        role: 'Senior PM',
        company: 'DoorDash',
        years: '5-10',
        city: 'New York, NY',
      }),
    );
    expect(card).toBe('Senior PM · DoorDash · 5-10 yrs');
  });

  it('never contains the city', () => {
    const line = deckLineFor(
      profile({ mode: 'working', role: 'PM', company: 'Figma', city: 'San Francisco, CA' }),
    );
    expect(line).not.toContain('San Francisco');
  });

  it('marks a former employer when someone is looking', () => {
    const line = deckLineFor(
      profile({ mode: 'looking', role: 'PM', company: 'DoorDash', years: '5-10' }),
    );
    expect(line).toBe('PM · ex-DoorDash · 5-10 yrs');
  });

  it('leads a student with their school and graduation year', () => {
    const line = deckLineFor(profile({ mode: 'student', school2: 'NYU', gradYear: '2027' }));
    expect(line).toBe('NYU · 2027');
  });

  it('drops tenure when it is unset, without a dangling separator', () => {
    expect(deckLineFor(profile({ mode: 'working', role: 'PM', company: 'Figma', years: '' }))).toBe(
      'PM · Figma',
    );
  });
});

/* The two tags on the corners of the deck photo. */

describe('collegesFor', () => {
  it('lists every school from the step-1 list, not just the first', () => {
    const harvard = { name: 'Harvard Business School', course: 'MBA', year: '2027' };
    const duke = { name: 'Duke', course: 'Undergraduate', year: '2019' };
    expect(collegesFor(profile({ schools: [duke, harvard], school2: 'NYU' }))).toEqual([
      'Duke',
      'Harvard Business School',
    ]);
  });

  it('falls back to the inline student field when the list is empty', () => {
    expect(collegesFor(profile({ schools: [], school2: 'NYU' }))).toEqual(['NYU']);
  });

  it('is empty when there is no school at all', () => {
    expect(collegesFor(profile({ schools: [], school2: '   ' }))).toEqual([]);
  });

  it('drops a duplicate name', () => {
    const a = { name: 'UCLA', course: 'Undergraduate', year: '2019' };
    const b = { name: 'ucla', course: 'MBA', year: '2024' };
    expect(collegesFor(profile({ schools: [a, b], school2: '' }))).toEqual(['UCLA']);
  });
});

describe('helpTagFor', () => {
  it('reads a referral as the stronger offer', () => {
    const will = { Figma: 'Happy to chat', Stripe: 'Happy to refer' } as const;
    expect(helpTagFor({ will })).toBe('Can refer');
  });

  it('falls back to a chat', () => {
    expect(helpTagFor({ will: { Figma: 'Happy to chat' } })).toBe('Happy to chat');
  });

  it('is null when no door has been offered', () => {
    expect(helpTagFor({ will: {} })).toBeNull();
  });
});
