/**
 * Who has already liked a new account (BACKLOG E1b.9).
 *
 * Pure and separate from the Firestore writes because this is the part with a rule in
 * it, and the rule was wrong once already: measuring the share against whoever was
 * left after the account's swipe history quietly delivered 27 people where 32 were
 * asked for. Everything here is unit tested; `demo-matches.ts` only writes what this
 * returns.
 *
 * The mode changed once too. It used to create finished matches outright, which left
 * a fresh account staring at forty threads it had done nothing to earn. Now the
 * seeded population *likes* the new account and stops there: the deck still shows
 * every one of them (`excludedUids` filters on the viewer's own swipes, not on
 * inbound ones), so the first right-swipe finds the counter-swipe already waiting and
 * `recordSwipe` turns it into a match inside its transaction. Chat starts empty and
 * fills as they swipe, which is the demo worth showing.
 */

/** The share of the seeded population that has already liked a new account. */
export const DEMO_LIKE_SHARE = 0.7;

export type DemoPlan = {
  /** Inbound likes to drop in the account's inbox. */
  toLike: string[];
};

export type DemoPlanInput = {
  /** Every seeded, published uid except the account itself, in a stable order. */
  eligible: readonly string[];
  /** Seeded uids this account has already swiped on, in either direction. */
  alreadySwiped?: ReadonlySet<string>;
  /** Fraction of `eligible` that should have liked the account. */
  share: number;
};

export function planDemoLikes({
  eligible,
  alreadySwiped = new Set<string>(),
  share,
}: DemoPlanInput): DemoPlan {
  if (eligible.length === 0) return { toLike: [] };

  // The share is of the whole seeded population, not of the untouched remainder: an
  // account that has been demoed on has already passed on people, and measuring
  // against what is left hands back less than was asked for.
  const target = Math.min(eligible.length, Math.ceil(eligible.length * share));

  /*
   * Only people this account has never swiped on. Someone it already said yes to
   * cannot be given a like here: that is a mutual yes with no match document, a state
   * `recordSwipe` never produces and nothing downstream knows how to repair. Someone
   * it passed on is skipped for the same reason in reverse — the pass deleted their
   * like, and writing it back would resurrect a card the user already dismissed.
   *
   * So an account part-way through the deck gets fewer than the share asks for. That
   * is the honest number: the alternative is manufacturing matches this mode exists
   * to stop making. A fresh account — the case this is for — has swiped on nobody.
   */
  const untouched = eligible.filter((uid) => !alreadySwiped.has(uid));

  return { toLike: untouched.slice(0, target) };
}
