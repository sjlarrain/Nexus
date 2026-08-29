import { z } from 'zod';
import {
  COURSE_TYPES,
  DIRECTIONS,
  HELP_KINDS,
  LIMITS,
  MODES,
  OPEN_TO,
  PHOTO_SLOTS,
  YEARS_BANDS,
} from '@/lib/refdata/constants';

/**
 * The profile object from docs/planup.md section 4, as the single definition used by
 * the onboarding forms, the route handlers, and the tests.
 *
 * Draft fields from the spec (`schoolDraft`, `yearDraft`, `courseDraft`, `referDraft`,
 * `targetDraft`, `interestDraft`) are deliberately absent: they are add-form state,
 * not profile data, and never reach Firestore (BACKLOG E3.3).
 */

const trimmed = (max: number) => z.string().trim().max(max);

export const photoSchema = z.object({
  slot: z.enum(PHOTO_SLOTS),
  url: z.string().url(),
  storagePath: z.string().min(1),
});
export type Photo = z.infer<typeof photoSchema>;

export const schoolSchema = z.object({
  name: trimmed(120).min(1),
  course: z.enum(COURSE_TYPES),
  /** Batch/graduation year, e.g. "2028" — renders as "MBA Class of 2028". */
  year: z.string().regex(/^\d{4}$/, 'Year must be four digits'),
});
export type School = z.infer<typeof schoolSchema>;

/** "City, ST" — the spec stores the state in the city string (section 2, step 1). */
export const citySchema = z
  .string()
  .regex(/^.+, [A-Z]{2}$/, 'City must be stored as "City, ST"');

export const profileSchema = z.object({
  // --- step 1: who are you ---
  first: trimmed(60),
  last: trimmed(60),
  photos: z.array(photoSchema).max(LIMITS.photos),
  headline: trimmed(LIMITS.headlineChars),
  city: z.union([citySchema, z.literal('')]),
  stateName: trimmed(60),
  linkedin: z.union([z.string().url(), z.literal('')]),
  linkedinImported: z.boolean(),
  schools: z.array(schoolSchema).max(LIMITS.schools),

  // --- step 2: where are you today ---
  mode: z.enum(MODES).nullable(),
  company: trimmed(120),
  role: trimmed(120),
  industry: trimmed(80),
  /** "Function" in the UI; `lane` in the spec's data model. */
  lane: trimmed(80),
  years: z.union([z.enum(YEARS_BANDS), z.literal('')]),
  /** Student inline fallback when no step-1 school exists. */
  school2: trimmed(120),
  gradYear: z.union([z.string().regex(/^\d{4}$/), z.literal('')]),
  /** Doors: companies the user can open, plus how they will help with each. */
  referCompanies: z.array(trimmed(120).min(1)),
  will: z.record(z.string(), z.enum(HELP_KINDS)),

  // --- step 3: what are you looking for ---
  industries: z.array(trimmed(80).min(1)).max(LIMITS.industries),
  lanes: z.array(trimmed(80).min(1)).max(LIMITS.roles),
  targetCompanies: z.array(trimmed(120).min(1)),

  // --- step 4: a little color (skippable) ---
  interests: z.array(trimmed(60).min(1)).max(LIMITS.interests),
  openTo: z.array(z.enum(OPEN_TO)),
  bio: trimmed(LIMITS.bioChars),

  // --- card ---
  direction: z.enum(DIRECTIONS),
  p1: trimmed(300),
  p2: trimmed(300),
  p3: trimmed(300),
});

export type Profile = z.infer<typeof profileSchema>;

/** A partial profile, which is what every step of onboarding actually submits. */
export const profilePatchSchema = profileSchema.partial();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** Server-owned fields. Clients cannot write these (see firestore.rules). */
export const profileMetaSchema = z.object({
  onboarding: z.object({
    step: z.number().int().min(0).max(5),
    completed: z.boolean(),
    publishedAt: z.number().nullable(),
  }),
  stats: z.object({
    replyRate: z.number().min(0).max(1).nullable(),
    lastActiveAt: z.number().nullable(),
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ProfileMeta = z.infer<typeof profileMetaSchema>;

export const userDocSchema = profileSchema.and(profileMetaSchema);
export type UserDoc = z.infer<typeof userDocSchema>;

/** An empty profile — the shape written on first sign-in (BACKLOG E2.4). */
export function emptyProfile(): Profile {
  return {
    first: '',
    last: '',
    photos: [],
    headline: '',
    city: '',
    stateName: '',
    linkedin: '',
    linkedinImported: false,
    schools: [],
    mode: null,
    company: '',
    role: '',
    industry: '',
    lane: '',
    years: '',
    school2: '',
    gradYear: '',
    referCompanies: [],
    will: {},
    industries: [],
    lanes: [],
    targetCompanies: [],
    interests: [],
    openTo: [],
    bio: '',
    direction: 'both',
    p1: '',
    p2: '',
    p3: '',
  };
}
