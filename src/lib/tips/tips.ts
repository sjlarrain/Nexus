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

const STORAGE_KEY = 'warm-intro:tips-seen';

/**
 * Per-device only — there is no per-account "has this user seen the tour" field in
 * the profile, and adding one for a three-step tooltip is more state than the
 * feature is worth. A blocked store (private browsing) counts as seen, so the tour
 * fails quiet rather than nagging on every load.
 */
export function hasSeenTips(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTipsSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Worst case the tour reappears next visit — not worth surfacing an error for.
  }
}

export function clearTipsSeen(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
