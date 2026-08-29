/**
 * Fixed option sets from docs/planup.md. These are compile-time constants rather
 * than Firestore documents because the spec names them exactly and the schemas
 * validate against them.
 */

/** Spec section 2, step 1: three required photos, each with a fixed role. */
export const PHOTO_SLOTS = ['headshot', 'at-work', 'off-the-clock'] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

export const PHOTO_SLOT_LABELS: Record<PhotoSlot, string> = {
  headshot: 'Headshot',
  'at-work': 'At work',
  'off-the-clock': 'Off the clock',
};

/** Spec section 2, step 1: course chips on the add-school form. */
export const COURSE_TYPES = ['Undergraduate', 'MBA', 'MSBA', 'MS', 'PhD', 'Other'] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

/** Spec section 2, step 2: the three mutually exclusive CTAs. */
export const MODES = ['working', 'student', 'looking'] as const;
export type Mode = (typeof MODES)[number];

/** Spec section 2, step 2: the "How you can help" row on each door company. */
export const HELP_KINDS = ['Happy to refer', 'Happy to chat'] as const;
export type HelpKind = (typeof HELP_KINDS)[number];

/** Spec section 4: which way round the user is facing. */
export const DIRECTIONS = ['refer', 'looking', 'both'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Spec section 2, step 4: "You are open to". */
export const OPEN_TO = [
  'Referrals',
  'Mock interviews',
  'Resume review',
  'Career advice',
  'Industry intel',
  'Cofounder chat',
] as const;
export type OpenTo = (typeof OPEN_TO)[number];

export const YEARS_BANDS = ['0-1', '2-3', '4-6', '7-10', '10+'] as const;
export type YearsBand = (typeof YEARS_BANDS)[number];

/** Caps that surface in the UI as the "n of m" pill hint (spec section 6). */
export const LIMITS = {
  photos: 3,
  schools: 3,
  headlineChars: 80,
  bioChars: 300,
  industries: 3,
  roles: 3,
  interests: 6,
  messageChars: 2000,
} as const;
