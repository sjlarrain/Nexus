/**
 * Who a new account gets auto-matched with (BACKLOG E1b.9).
 *
 * Pure and separate from the Firestore writes because this is the part with a rule in
 * it, and the rule was wrong once already: measuring the share against whoever was
 * left after the account's swipe history quietly delivered 27 matches where 32 were
 * asked for. Everything here is unit tested; `demo-matches.ts` only writes what this
 * returns.
 */

/** The share of the seeded population a new account is matched with. */
export const DEMO_MATCH_SHARE = 0.75;

export type DemoPlan = {
  /** Mutual matches to create. */
  toMatch: string[];
  /** Inbound likes to drop in the account's inbox. */
  toLike: string[];
};

export type DemoPlanInput = {
  /** Every seeded, published uid except the account itself, in a stable order. */
  eligible: readonly string[];
  /** Seeded uids this account has already swiped on, in either direction. */
  alreadySwiped?: ReadonlySet<string>;
  /** Fraction of `eligible` to match with. */
  share: number;
};

export function planDemoMatches({
  eligible,
  alreadySwiped = new Set<string>(),
  share,
}: DemoPlanInput): DemoPlan {
  if (eligible.length === 0) return { toMatch: [], toLike: [] };

  // The share is of the whole seeded population, not of the untouched remainder: an
  // account that has been demoed on has already passed on people, and measuring
  // against what is left hands back less than was asked for.
  const target = Math.min(eligible.length, Math.ceil(eligible.length * share));

  // Prefer people not yet seen; someone already passed on is pulled in only to make
  // up the number, which overwrites that pass. Fine for seeded people.
  const untouched = eligible.filter((uid) => !alreadySwiped.has(uid));
  const seen = eligible.filter((uid) => alreadySwiped.has(uid));
  const ordered = [...untouched, ...seen];

  const toMatch = ordered.slice(0, target);
  // Half of what is left arrives as an inbound like, so the Likes screen has
  // something to accept or pass on; the rest stay in the deck to swipe through.
  const remainder = ordered.slice(target);
  const toLike = remainder.slice(0, Math.ceil(remainder.length / 2));

  return { toMatch, toLike };
}
