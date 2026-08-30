import type { Profile } from '@/lib/schemas/profile';
import type { Photo } from '@/lib/schemas/profile';
import type { Direction } from '@/lib/refdata/constants';

/**
 * The card payload — the only shape of another person the client ever receives.
 * Deliberately narrower than the profile: no email, no swipe history, no drafts.
 */
export type Card = {
  uid: string;
  name: string;
  /** "Senior PM · DoorDash · Austin, TX" — see composeRoleLine. */
  roleLine: string;
  /**
   * The deck card splits these out: mock 1a puts the city in the name row and the
   * role line reads "Senior PM · DoorDash · 6 yrs". `roleLine` is kept as it was for
   * every other screen, which shows the city inline.
   */
  deckLine: string;
  city: string;
  headline: string;
  photos: Photo[];
  badge: string | null;
  /** Top-left of the deck photo: where they studied. */
  college: string | null;
  /** Top-right of the deck photo: what they will actually do for someone. */
  helpTag: string | null;
  tags: string[];
  direction: Direction;
  doors: string[];
  openTo: string[];
  prompts: { p1: string; p2: string; p3: string };
};

/**
 * Spec section 6: "The card's role line is composed by filtering empty parts before
 * joining with ' · ' so a missing city never leaves a dangling separator."
 */
export function composeRoleLine(...parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** The kicker above the name: what this person is here for. */
export function badgeFor(profile: Pick<Profile, 'direction' | 'mode'>): string | null {
  if (profile.mode === 'student') return 'Student';
  switch (profile.direction) {
    case 'refer':
      return 'Can refer';
    case 'looking':
      return 'Looking';
    case 'both':
      return 'Open both ways';
  }
}

/**
 * The school shown on the deck card. Step 1's list is the source of truth; the flat
 * field is the student fallback filled in on step 2 (docs/decisions.md).
 */
export function collegeFor(profile: Pick<Profile, 'schools' | 'school2'>): string | null {
  const name = (profile.schools[0]?.name ?? profile.school2).trim();
  return name.length > 0 ? name : null;
}

/**
 * What this person will actually do, from the per-company answers on step 2 — not
 * from `direction`, which is only what they came here for. A referral is the stronger
 * offer, so one "Happy to refer" outranks any number of "Happy to chat".
 */
export function helpTagFor(profile: Pick<Profile, 'will'>): string | null {
  const kinds = Object.values(profile.will);
  if (kinds.includes('Happy to refer')) return 'Can refer';
  if (kinds.includes('Happy to chat')) return 'Happy to chat';
  return null;
}

/**
 * The role line differs by mode: a student leads with their school — they are no
 * longer asked for a company, title or function — and someone looking out leads with
 * where they were most recently.
 */
export function roleLineFor(profile: Profile): string {
  const school = profile.schools[0]?.name ?? profile.school2;

  switch (profile.mode) {
    case 'student':
      return composeRoleLine(school, profile.city);
    case 'looking':
      return composeRoleLine(profile.role, `ex-${profile.company}`, profile.city);
    case 'working':
    case null:
      return composeRoleLine(profile.role, profile.company, profile.city);
  }
}

/**
 * The deck card's role line (mock 1a): role, employer and tenure, with the city
 * lifted out into the name row. Same mode rules as `roleLineFor`, minus the city.
 */
export function deckLineFor(profile: Profile): string {
  const school = profile.schools[0]?.name ?? profile.school2;
  const years = profile.years.trim() ? `${profile.years} yrs` : '';

  switch (profile.mode) {
    case 'student':
      return composeRoleLine(school, profile.gradYear);
    case 'looking':
      return composeRoleLine(profile.role, `ex-${profile.company}`, years);
    case 'working':
    case null:
      return composeRoleLine(profile.role, profile.company, years);
  }
}

/** Small set of chips under the card: what they do and what they are into. */
export function tagsFor(profile: Profile, limit = 5): string[] {
  const tags = [...profile.industry, ...profile.lanes, ...profile.interests];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const value = tag.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

export function toCard(uid: string, profile: Profile): Card {
  return {
    uid,
    name: [profile.first, profile.last]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' '),
    roleLine: roleLineFor(profile),
    deckLine: deckLineFor(profile),
    city: profile.city,
    headline: profile.headline,
    photos: profile.photos,
    badge: badgeFor(profile),
    college: collegeFor(profile),
    helpTag: helpTagFor(profile),
    tags: tagsFor(profile),
    direction: profile.direction,
    doors: profile.referCompanies,
    openTo: profile.openTo,
    prompts: { p1: profile.p1, p2: profile.p2, p3: profile.p3 },
  };
}
