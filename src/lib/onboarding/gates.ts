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

const step1: Requirement[] = [
  { id: 'photos', label: `Add ${LIMITS.photos} photos`, met: hasAllPhotos },
  { id: 'headline', label: 'Add a headline', met: (p) => p.headline.trim().length > 0 },
  { id: 'city', label: 'Choose your city', met: (p) => p.city.trim().length > 0 },
];

const step2Working: Requirement[] = [
  { id: 'company', label: 'Add your company', met: (p) => p.company.trim().length > 0 },
  { id: 'role', label: 'Add your title', met: (p) => p.role.trim().length > 0 },
  { id: 'industry', label: 'Pick an industry', met: (p) => p.industry.trim().length > 0 },
  { id: 'years', label: 'Pick your years of experience', met: (p) => p.years.length > 0 },
  {
    id: 'referCompanies',
    label: 'Pick at least one company you can open a door at',
    met: (p) => p.referCompanies.length > 0,
  },
];

const step2Student: Requirement[] = [
  { id: 'school', label: 'Add your school', met: hasSchool },
  { id: 'lane', label: 'Pick a function', met: (p) => p.lane.trim().length > 0 },
];

const step2Looking: Requirement[] = [
  { id: 'company', label: 'Add your most recent company', met: (p) => p.company.trim().length > 0 },
  { id: 'lane', label: 'Pick a function', met: (p) => p.lane.trim().length > 0 },
  { id: 'years', label: 'Pick your years of experience', met: (p) => p.years.length > 0 },
];

const step3: Requirement[] = [
  { id: 'industries', label: 'Pick an industry', met: (p) => p.industries.length > 0 },
  { id: 'lanes', label: 'Pick a role', met: (p) => p.lanes.length > 0 },
  {
    id: 'targetCompanies',
    label: 'Pick a target company',
    met: (p) => p.targetCompanies.length > 0,
  },
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
      // Skippable by design (spec section 3).
      return { ok: true, label: CONTINUE, missing: [] };
    case 5:
      return { ok: true, label: 'Publish', missing: [] };
    default:
      return { ok: true, label: CONTINUE, missing: [] };
  }
}

/** Every gate that must pass before a profile may be published (BACKLOG E3.6). */
export function canPublish(profile: Profile): GateResult {
  for (const step of [1, 2, 3]) {
    const result = gateForStep(step, profile);
    if (!result.ok) return result;
  }
  return { ok: true, label: 'Publish', missing: [] };
}

/** Step summary status for the step-5 review rows (spec section 2, step 5). */
export type StepStatus = 'Complete' | 'Needs work' | 'Skipped';

export function statusForStep(step: number, profile: Profile): StepStatus {
  if (step === 4) {
    const touched =
      profile.interests.length > 0 || profile.openTo.length > 0 || profile.bio.trim().length > 0;
    return touched ? 'Complete' : 'Skipped';
  }
  return gateForStep(step, profile).ok ? 'Complete' : 'Needs work';
}
