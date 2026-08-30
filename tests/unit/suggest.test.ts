import { describe, expect, it } from 'vitest';
import { suggest, type SuggestContext } from '@/lib/chat/suggest';
import { findCafeMention, orderVenuesForBooking } from '@/lib/chat/cafe';
import type { Message, Venue } from '@/lib/schemas/entities';

const ME = 'me';
const THEM = 'them';

let clock = 1_000;
function msg(from: string, text: string): Message {
  clock += 1000;
  return { from, text, kind: 'text', createdAt: clock };
}

function context(overrides: Partial<SuggestContext> = {}): SuggestContext {
  return { messages: [], meUid: ME, booked: false, theirName: 'Daniel', ...overrides };
}

const VENUES: Venue[] = [
  {
    id: 'v1',
    name: 'Sightglass Coffee',
    address: '270 7th St',
    source: 'nearby',
    lat: null,
    lng: null,
  },
  {
    id: 'v2',
    name: 'Blue Bottle Coffee',
    address: '66 Mint St',
    source: 'nearby',
    lat: null,
    lng: null,
  },
  {
    id: 'v3',
    name: 'Ritual Coffee Roasters',
    address: '1026 Valencia St',
    source: 'nearby',
    lat: null,
    lng: null,
  },
];

/** The six rules of spec section 1, in the order they are meant to fire. */

describe('rule 1 — cafe named in the thread, not yet booked', () => {
  it('pins a cafe-specific suggestion first', () => {
    const result = suggest(
      context({ messages: [msg(THEM, 'Want to grab a coffee? Sightglass Coffee is close.')] }),
    );
    expect(result[0]?.rule).toBe('cafe');
    expect(result[0]?.pinned).toBe(true);
    expect(result[0]?.text).toContain('Sightglass Coffee');
  });

  it('beats rule 5 even though the message also has meeting keywords', () => {
    const result = suggest(
      context({ messages: [msg(THEM, 'free for coffee at Ritual Coffee Roasters?')] }),
    );
    expect(result[0]?.rule).toBe('cafe');
  });

  it('beats rule 4 even when the last message is mine', () => {
    const result = suggest(context({ messages: [msg(ME, 'How about Four Barrel Coffee?')] }));
    expect(result[0]?.rule).toBe('cafe');
  });

  it('stops applying once a booking exists — rule 2 takes over', () => {
    const result = suggest(
      context({ messages: [msg(THEM, 'Sightglass Coffee works')], booked: true }),
    );
    expect(result.every((s) => s.rule === 'booked')).toBe(true);
  });
});

describe('rule 2 — booked', () => {
  it('returns prep suggestions', () => {
    const result = suggest(context({ messages: [msg(THEM, 'see you then')], booked: true }));
    expect(result.every((s) => s.rule === 'booked')).toBe(true);
  });
});

describe('rule 3 — no messages', () => {
  it('returns exactly three openers', () => {
    const result = suggest(context());
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.rule === 'openers')).toBe(true);
  });

  it('addresses them by name when it has one', () => {
    expect(suggest(context()).every((s) => s.text.includes('Daniel'))).toBe(true);
  });

  it('degrades gracefully without a name', () => {
    const result = suggest(context({ theirName: undefined }));
    expect(result[0]?.text).toContain('there');
  });
});

describe('rule 4 — last message is mine', () => {
  it('suggests strengthening the ask', () => {
    const result = suggest(
      context({ messages: [msg(THEM, 'Nice to match'), msg(ME, 'Likewise, thanks!')] }),
    );
    expect(result.every((s) => s.rule === 'strengthen')).toBe(true);
  });
});

describe('rule 5 — keyword match on their last message', () => {
  it.each([
    ['are you free to meet next week?', 'meeting-intent'],
    ['loved your portfolio, especially the case study', 'work-portfolio'],
    ['I could refer you for that opening', 'referral-loop'],
  ] as const)('maps %j to %s', (text, rule) => {
    const result = suggest(context({ messages: [msg(THEM, text)] }));
    expect(result.every((s) => s.rule === rule)).toBe(true);
  });

  it('checks meeting intent before the other sets, as the spec orders them', () => {
    const result = suggest(context({ messages: [msg(THEM, 'free to chat about the role?')] }));
    expect(result[0]?.rule).toBe('meeting-intent');
  });

  it('reads their last message, not mine', () => {
    const result = suggest(
      context({
        messages: [msg(THEM, 'I could refer you'), msg(ME, 'thanks'), msg(THEM, 'anyway, hello')],
      }),
    );
    expect(result[0]?.rule).toBe('fallback');
  });
});

describe('rule 6 — fallback', () => {
  it('catches anything the keyword sets miss', () => {
    const result = suggest(context({ messages: [msg(THEM, 'Hello!')] }));
    expect(result.every((s) => s.rule === 'fallback')).toBe(true);
  });
});

describe('cafe detection', () => {
  it('finds a known venue by name', () => {
    const mention = findCafeMention([msg(THEM, 'blue bottle coffee is nearby')], VENUES);
    expect(mention?.venueId).toBe('v2');
    expect(mention?.name).toBe('Blue Bottle Coffee');
  });

  it('finds an unknown cafe by its suffix', () => {
    const mention = findCafeMention(
      [msg(THEM, 'There is a Gaslight Coffee Roasters nearby')],
      VENUES,
    );
    expect(mention?.name).toBe('Gaslight Coffee Roasters');
    expect(mention?.venueId).toBeNull();
  });

  it('prefers the most recent mention', () => {
    const mention = findCafeMention(
      [msg(THEM, 'Sightglass Coffee?'), msg(ME, 'or Blue Bottle Coffee?')],
      VENUES,
    );
    expect(mention?.name).toBe('Blue Bottle Coffee');
  });

  // The preposition rule is the eager one; this is the guard that keeps it honest.
  it('does not mistake an employer for a cafe', () => {
    expect(findCafeMention([msg(THEM, 'I work at DoorDash in Austin')], VENUES)).toBeNull();
  });

  it('returns null for an empty thread', () => {
    expect(findCafeMention([], VENUES)).toBeNull();
  });
});

describe('venue ordering for the booking screen', () => {
  it('pins the mentioned cafe first and tags it', () => {
    const mention = findCafeMention([msg(THEM, 'Ritual Coffee Roasters works')], VENUES);
    const ordered = orderVenuesForBooking(VENUES, mention);
    expect(ordered[0]?.venue.name).toBe('Ritual Coffee Roasters');
    expect(ordered[0]?.mentionedInChat).toBe(true);
    expect(ordered.slice(1).every((v) => !v.mentionedInChat)).toBe(true);
  });

  it('pins a cafe we do not stock yet', () => {
    const mention = findCafeMention([msg(THEM, 'Gaslight Coffee Roasters?')], VENUES);
    const ordered = orderVenuesForBooking(VENUES, mention);
    expect(ordered[0]?.venue.name).toBe('Gaslight Coffee Roasters');
    expect(ordered[0]?.venue.source).toBe('chat-mention');
    expect(ordered).toHaveLength(VENUES.length + 1);
  });

  it('leaves the list alone when nothing was mentioned', () => {
    const ordered = orderVenuesForBooking(VENUES, null);
    expect(ordered.map((v) => v.venue.id)).toEqual(['v1', 'v2', 'v3']);
    expect(ordered.every((v) => !v.mentionedInChat)).toBe(true);
  });
});
