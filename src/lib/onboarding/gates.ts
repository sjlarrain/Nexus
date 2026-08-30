import { LIMITS, PHOTO_SLOTS } from '@/lib/refdata/constants';
import type { Profile } from '@/lib/schemas/profile';

/**
 * The gate table from docs/planup.md section 3.
 *
 * "The Continue button is disabled until the step's gate passes, and its label states
 * what is missing" — so a gate returns the button label, not just a boolean. The
 * `missing` list is what the tests assert against and what the UI can use to
 * highlight fields.
 */

export type GateResult = {
  ok: boolean;
  /** What the Continue button should say right now. */
  label: string;
  /** Machine-readable ids of unmet requirements, in the order they appear on screen. */
  missing: string[];
};

type Requirement = {
  id: string;
  /** Button label shown while this requirement is the first one unmet. */
  label: string;
  met: (p: Profile) => boolean;
};

const CONTINUE = 'Continue';

function evaluate(requirements: Requirement[], profile: Profile, passLabel = CONTINUE): GateResult {
  const unmet = requirements.filter((r) => !r.met(profile));
  const first = unmet[0];
  return first
    ? { ok: false, label: first.label, missing: unmet.map((r) => r.id) }
    : { ok: true, label: passLabel, missing: [] };
}

const hasAllPhotos = (p: Profile): boolean => {
  const slots = new Set(p.photos.map((photo) => photo.slot));
  return PHOTO_SLOTS.every((slot) => slots.has(slot));
};

/** A student satisfies the school requirement from step 1 or the inline field. */
const hasSchool = (p: Profile): boolean => p.schools.length > 0 || p.school2.trim().length > 0;

/** Graduation year, autopopulated from the step-1 school unless edited inline. */
const hasGradYear = (p: Profile): boolean =>
  p.gradYear.trim().length > 0 || (p.schools[0]?.year.trim().length ?? 0) > 0;

const step1: Requirement[] = [
  { id: 'photos', label: `Add ${LIMITS.photos} photos`, met: hasAllPhotos },
  { id: 'headline', label: 'Add a headline', met: (p) => p.headline.trim().length > 0 },
  { id: 'city', label: 'Choose your city', met: (p) => p.city.trim().length > 0 },
];

/**
 * Company, Title and Industry only. Function, years and doors are all optional since
 * the PM's onboarding revision — a card that names where someone sits is enough to
 * publish, and the rest sharpens the match rather than gating it.
 */
const step2Working: Requirement[] = [
  { id: 'company', label: 'Add your company', met: (p) => p.company.trim().length > 0 },
  { id: 'role', label: 'Add your title', met: (p) => p.role.trim().length > 0 },
  { id: 'industry', label: 'Pick an industry', met: (p) => p.industry.length > 0 },
];

/** Students answer two questions, and both are required. */
const step2Student: Requirement[] = [
  { id: 'school', label: 'Add your school', met: hasSchool },
  { id: 'gradYear', label: 'Add your graduation year', met: hasGradYear },
];

/** Someone looking out is asked for their most recent seat and nothing else. */
const step2Looking: Requirement[] = [
  { id: 'company', label: 'Add your most recent company', met: (p) => p.company.trim().length > 0 },
  { id: 'role', label: 'Add your most recent title', met: (p) => p.role.trim().length > 0 },
];

const step3: Requirement[] = [
  { id: 'industries', label: 'Pick an industry', met: (p) => p.industries.length > 0 },
  { id: 'lanes', label: 'Pick a role', met: (p) => p.lanes.length > 0 },
];

/** Everything on "a little colour" is required now except the bio. */
const step4: Requirement[] = [
  { id: 'interests', label: 'Pick what you are into', met: (p) => p.interests.length > 0 },
  { id: 'openTo', label: 'Pick what you are open to', met: (p) => p.openTo.length > 0 },
];

/**
 * Step 2 branches on the selected mode, so no mode means nothing to validate yet.
 * The spec's "Only the relevant questions expand" is the same idea in the UI.
 */
function gateStep2(profile: Profile): GateResult {
  switch (profile.mode) {
    case 'working':
      return evaluate(step2Working, profile);
    case 'student':
      return evaluate(step2Student, profile);
    case 'looking':
      return evaluate(step2Looking, profile);
    case null:
      return { ok: false, label: 'Pick where you are today', missing: ['mode'] };
  }
}

export function gateForStep(step: number, profile: Profile): GateResult {
  switch (step) {
    case 1:
      return evaluate(step1, profile);
    case 2:
      return gateStep2(profile);
    case 3:
      return evaluate(step3, profile);
    case 4:
      return evaluate(step4, profile);
    case 5:
      return { ok: true, label: 'Publish', missing: [] };
    default:
      return { ok: true, label: CONTINUE, missing: [] };
  }
}

/** Every gate that must pass before a profile may be published (BACKLOG E3.6). */
export function canPublish(profile: Profile): GateResult {
  for (const step of [1, 2, 3, 4]) {
    const result = gateForStep(step, profile);
    if (!result.ok) return result;
  }
  return { ok: true, label: 'Publish', missing: [] };
}

/** Step summary status for the step-5 review rows (spec section 2, step 5). */
export type StepStatus = 'Complete' | 'Needs work';

export function statusForStep(step: number, profile: Profile): StepStatus {
  return gateForStep(step, profile).ok ? 'Complete' : 'Needs work';
}

/** True when every section of the review list is green (BACKLOG E3.9). */
export function allStepsComplete(profile: Profile): boolean {
  return [1, 2, 3, 4].every((step) => gateForStep(step, profile).ok);
}
