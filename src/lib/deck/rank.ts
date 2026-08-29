import type { Profile } from '@/lib/schemas/profile';
import type { Direction } from '@/lib/refdata/constants';

/**
 * Deck ranking v1 — docs/architecture.md section 5.
 *
 * Deliberately simple and explainable: every point a candidate scores can be named,
 * which matters when the owner asks "why is this person first?". `explain()` returns
 * exactly that breakdown.
 *
 * Pure, so it is unit-testable without Firestore (BACKLOG E6.3).
 */

export type Candidate = {
  uid: string;
  profile: Profile;
  /** Epoch millis; older activity scores lower. */
  lastActiveAt: number | null;
};

export type DeckFilters = {
  industries?: readonly string[];
  lanes?: readonly string[];
  /** Matches on the stored "City, ST" value. */
  cities?: readonly string[];
  direction?: Direction;
};

export type ScoreBreakdown = {
  doorOverlap: number;
  directionComplement: number;
  industryOverlap: number;
  laneOverlap: number;
  recency: number;
  total: number;
};

export const WEIGHTS = {
  /** They can open a door at a company I am targeting. The whole point of the app. */
  perDoorMatch: 8,
  doorMatchCap: 24,
  /** One wants to refer, the other is looking. */
  directionComplement: 10,
  perIndustry: 3,
  perLane: 4,
  /** Active today scores full marks, decaying to zero over two weeks. */
  recencyMax: 6,
  recencyWindowDays: 14,
} as const;

const lower = (values: readonly string[]) => new Set(values.map((v) => v.trim().toLowerCase()));

function intersectionSize(a: readonly string[], b: readonly string[]): number {
  const setB = lower(b);
  let count = 0;
  for (const value of lower(a)) if (setB.has(value)) count += 1;
  return count;
}

/**
 * Directions complement when one side can refer and the other is looking. Someone
 * open "both" ways complements everyone, but scores the same as a clean match — the
 * intent is to reward the pairing, not the flexibility.
 */
export function directionsComplement(mine: Direction, theirs: Direction): boolean {
  if (mine === 'both' || theirs === 'both') return true;
  return mine !== theirs;
}

function recencyScore(lastActiveAt: number | null, now: number): number {
  if (lastActiveAt === null) return 0;
  const ageDays = (now - lastActiveAt) / 86_400_000;
  if (ageDays <= 0) return WEIGHTS.recencyMax;
  if (ageDays >= WEIGHTS.recencyWindowDays) return 0;
  const fraction = 1 - ageDays / WEIGHTS.recencyWindowDays;
  return Math.round(WEIGHTS.recencyMax * fraction * 100) / 100;
}

export function explain(viewer: Profile, candidate: Candidate, now = Date.now()): ScoreBreakdown {
  const doors = Math.min(
    intersectionSize(candidate.profile.referCompanies, viewer.targetCompanies) *
      WEIGHTS.perDoorMatch,
    WEIGHTS.doorMatchCap,
  );

  const direction = directionsComplement(viewer.direction, candidate.profile.direction)
    ? WEIGHTS.directionComplement
    : 0;

  const industry =
    intersectionSize(candidate.profile.industries, viewer.industries) * WEIGHTS.perIndustry;
  const lane = intersectionSize(candidate.profile.lanes, viewer.lanes) * WEIGHTS.perLane;
  const recency = recencyScore(candidate.lastActiveAt, now);

  return {
    doorOverlap: doors,
    directionComplement: direction,
    industryOverlap: industry,
    laneOverlap: lane,
    recency,
    total: doors + direction + industry + lane + recency,
  };
}

export function passesFilters(candidate: Candidate, filters: DeckFilters): boolean {
  const { profile } = candidate;

  if (filters.industries?.length) {
    const wanted = lower(filters.industries);
    const theirs = lower([profile.industry, ...profile.industries]);
    if (![...theirs].some((value) => wanted.has(value))) return false;
  }

  if (filters.lanes?.length) {
    const wanted = lower(filters.lanes);
    const theirs = lower([profile.lane, ...profile.lanes]);
    if (![...theirs].some((value) => wanted.has(value))) return false;
  }

  if (filters.cities?.length && !lower(filters.cities).has(profile.city.trim().toLowerCase())) {
    return false;
  }

  if (filters.direction && !directionsComplement(filters.direction, profile.direction)) {
    return false;
  }

  return true;
}

/** mulberry32 again — a seeded shuffle keeps the deck reproducible in tests. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    // Invariant: i and j are both valid indices of `out`.
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

export type RankedCandidate = Candidate & { score: ScoreBreakdown };

/**
 * Ranks, then shuffles *within* score bands so the deck is not byte-identical on
 * every refresh while still putting the best matches first
 * (docs/architecture.md section 5, step 4).
 */
export function rankDeck(
  viewer: Profile,
  candidates: readonly Candidate[],
  options: { filters?: DeckFilters; now?: number; seed?: number; bandSize?: number } = {},
): RankedCandidate[] {
  const now = options.now ?? Date.now();
  const bandSize = options.bandSize ?? 4;
  const random = seededRandom(options.seed ?? 1);

  const scored = candidates
    .filter((candidate) => passesFilters(candidate, options.filters ?? {}))
    .map((candidate) => ({ ...candidate, score: explain(viewer, candidate, now) }))
    .sort((a, b) => b.score.total - a.score.total || a.uid.localeCompare(b.uid));

  const out: RankedCandidate[] = [];
  const band: RankedCandidate[] = [];
  let bandFloor: number | null = null;

  const flush = () => {
    if (band.length > 0) out.push(...shuffle(band, random));
    band.length = 0;
  };

  for (const candidate of scored) {
    if (bandFloor === null || bandFloor - candidate.score.total <= bandSize) {
      bandFloor ??= candidate.score.total;
      band.push(candidate);
    } else {
      flush();
      bandFloor = candidate.score.total;
      band.push(candidate);
    }
  }
  flush();

  return out;
}
