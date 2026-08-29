import { createHash } from 'node:crypto';

/**
 * A match id derived from the pair, not generated.
 *
 * Two people can swipe yes on each other at the same instant. If the id were random,
 * both requests would create a match and the pair would end up with two threads.
 * Deriving it means the second write is an idempotent overwrite of the first
 * (docs/architecture.md section 4).
 */

/** Sorted so the pair is order-independent. */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function matchIdFor(a: string, b: string): string {
  if (a === b) throw new Error('A user cannot match with themselves.');
  const [first, second] = pairKey(a, b);
  return createHash('sha256').update(`${first}__${second}`).digest('hex').slice(0, 32);
}

/** Document id for a swipe: directional, unlike the match id. */
export function swipeIdFor(from: string, to: string): string {
  return `${from}__${to}`;
}

/** The other participant, given one of them. */
export function counterpartOf(participants: readonly [string, string], me: string): string {
  const [a, b] = participants;
  if (me === a) return b;
  if (me === b) return a;
  throw new Error('User is not a participant of this match.');
}
