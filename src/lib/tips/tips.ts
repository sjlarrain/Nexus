/**
 * The first-run product tour (docs/mocks/planup-quick-tips.html): three spotlighted
 * steps over the deck screen — the card, the Filters button, then the swipe row.
 */

export type TipTarget = 'card' | 'filters' | 'actions';

export type Tip = {
  eyebrow: string;
  title: string;
  body: string;
  target: TipTarget;
};

export const TIPS: Tip[] = [
  {
    eyebrow: 'The profile',
    title: 'This is what people see',
    body: 'Role, company, years, where they’re at, and what they’re hoping to get referred into — everything you need before you decide.',
    target: 'card',
  },
  {
    eyebrow: 'Filters',
    title: 'Narrow who you see',
    body: 'Filter the deck by industry, role, company, school or location, so you only swipe on people worth a look.',
    target: 'filters',
  },
  {
    eyebrow: 'Swiping',
    title: 'Right, left, or up',
    body: 'Swipe right (or tap Yes) if you’re interested, left (or Pass) to skip, up (or the arrow) to send a priority ask that jumps to the top of their list.',
    target: 'actions',
  },
];

const STORAGE_KEY = 'warm-intro:tips';

/**
 * The tour is *armed* by publishing a card, not by the first sight of the deck.
 *
 * Arriving on the deck is not the moment to teach the deck: Save & exit drops an
 * unfinished profile there, and a tour spent on that visit is a tour the user never
 * gets when it matters. Publishing is the one point where somebody is definitely
 * done setting up and definitely about to swipe, so `armTips()` is called there and
 * the tour fires on the very next deck render.
 *
 * Per-device only — there is no per-account "has this user seen the tour" field in
 * the profile, and adding one for a three-step tooltip is more state than the
 * feature is worth. A blocked store (private browsing) simply never arms, so the
 * tour fails quiet rather than looping.
 */
export function armTips(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'pending');
  } catch {
    // Worst case the tour never runs — not worth surfacing an error for.
  }
}

export function tipsPending(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'pending';
  } catch {
    return false;
  }
}

/** Finished or skipped: the tour is spent until something arms it again. */
export function dismissTips(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'done');
  } catch {
    // ignore
  }
}
