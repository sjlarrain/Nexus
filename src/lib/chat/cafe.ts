import type { Message } from '@/lib/schemas/entities';
import type { Venue } from '@/lib/schemas/entities';

/**
 * Finds a cafe named in a chat thread.
 *
 * Two consumers share this (spec section 1 and section 4): rule 1 of `suggest()`
 * pins a cafe-specific reply, and the booking screen pins the same venue to the top
 * tagged "Mentioned in your chat". One matcher, so they can never disagree.
 */

export type CafeMention = {
  name: string;
  /** Index of the message it was found in, so the UI can point at it. */
  messageIndex: number;
  /** Set when the mention resolved to a venue we already know about. */
  venueId: string | null;
};

/**
 * Words that make a preceding capitalised phrase a cafe rather than a company.
 * "Sightglass Coffee" is a cafe; "Blue Bottle" alone is ambiguous until it appears
 * in the known-venue list.
 */
const CAFE_SUFFIXES = [
  'Coffee',
  'Coffee Roasters',
  'Roasters',
  'Cafe',
  'Café',
  'Coffeehouse',
  'Coffee House',
  'Espresso',
  'Bakery',
  'Tea House',
];

const SUFFIX_PATTERN = new RegExp(
  // One to three capitalised words, then a cafe-ish suffix.
  `\\b((?:[A-Z][\\w'’-]+ ){1,3}(?:${CAFE_SUFFIXES.map((s) => s.replace(/ /g, '\\s')).join('|')}))\\b`,
  'g',
);

/** "let's meet at Verve" — a name introduced by a preposition. */
const PREPOSITION_PATTERN = /\b(?:at|to|near|by)\s+([A-Z][\w'’-]+(?:\s[A-Z][\w'’-]+){0,2})\b/g;

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Scans newest-first: the most recent suggestion is the one worth acting on.
 * `knownVenues` lets a bare name ("Verve") match when we already know it is a cafe.
 */
export function findCafeMention(
  messages: readonly Message[],
  knownVenues: readonly Venue[] = [],
): CafeMention | null {
  const byName = new Map(knownVenues.map((venue) => [normalise(venue.name), venue]));

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.kind !== 'text') continue;

    // A known venue named anywhere in the message wins outright.
    for (const [name, venue] of byName) {
      if (normalise(message.text).includes(name)) {
        return { name: venue.name, messageIndex: index, venueId: venue.id };
      }
    }

    for (const pattern of [SUFFIX_PATTERN, PREPOSITION_PATTERN]) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(message.text)) !== null) {
        const captured = match[1]?.trim();
        if (!captured) continue;
        if (pattern === PREPOSITION_PATTERN && !looksLikeVenue(captured)) continue;
        const known = byName.get(normalise(captured));
        return {
          name: known?.name ?? captured,
          messageIndex: index,
          venueId: known?.id ?? null,
        };
      }
    }
  }

  return null;
}

/**
 * Guards the preposition rule, which is otherwise far too eager — "at DoorDash"
 * is not a coffee shop.
 */
function looksLikeVenue(candidate: string): boolean {
  return CAFE_SUFFIXES.some((suffix) => candidate.toLowerCase().includes(suffix.toLowerCase()));
}

/**
 * Orders venues for the booking screen: the one named in the chat first, tagged
 * so the UI can label it (spec section 1, coffee booking).
 */
export function orderVenuesForBooking(
  venues: readonly Venue[],
  mention: CafeMention | null,
): { venue: Venue; mentionedInChat: boolean }[] {
  if (!mention) return venues.map((venue) => ({ venue, mentionedInChat: false }));

  const isMentioned = (venue: Venue) =>
    venue.id === mention.venueId || normalise(venue.name) === normalise(mention.name);

  const pinned = venues.filter(isMentioned);
  const rest = venues.filter((venue) => !isMentioned(venue));

  // A cafe named in chat that we do not stock yet still belongs at the top.
  if (pinned.length === 0) {
    return [
      {
        venue: {
          id: mention.venueId ?? `chat-${normalise(mention.name).replace(/\s/g, '-')}`,
          name: mention.name,
          address: '',
          source: 'chat-mention',
          lat: null,
          lng: null,
        },
        mentionedInChat: true,
      },
      ...rest.map((venue) => ({ venue, mentionedInChat: false })),
    ];
  }

  return [
    ...pinned.map((venue) => ({ venue, mentionedInChat: true })),
    ...rest.map((venue) => ({ venue, mentionedInChat: false })),
  ];
}
