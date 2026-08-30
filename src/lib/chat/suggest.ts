import type { Message, Venue } from '@/lib/schemas/entities';
import { findCafeMention, type CafeMention } from '@/lib/chat/cafe';

/**
 * Suggested replies — spec section 1.
 *
 * "`suggest()` picks a set based on conversation state, in this order:
 *   1. Cafe named in the thread and not yet booked -> cafe-specific suggestion pinned first.
 *   2. Booked -> post-booking prep suggestions.
 *   3. No messages -> three openers.
 *   4. Last message is yours -> strengthen-the-ask suggestions.
 *   5. Keyword match on their last message: meeting intent / work + portfolio /
 *      referral + loop -> matching set.
 *   6. Fallback generic set."
 *
 * Pure by design: no I/O, so it runs client-side for an instant feel and every branch
 * is table-testable (BACKLOG E9.5, E9.7).
 */

export type Suggestion = {
  text: string;
  /**
   * The chip label. The chip has room for three or four words; `text` is the whole
   * message it drops into the composer, where it can be read and edited before it is
   * sent. The two are deliberately different — a chip that showed the full sentence
   * would wrap to three lines and still not be the thing you send.
   */
  short: string;
  /** Which rule produced it — used by tests and useful for tuning later. */
  rule: SuggestRule;
  /** Rule 1 pins its cafe suggestion above everything else. */
  pinned?: boolean;
};

export type SuggestRule =
  | 'cafe'
  | 'booked'
  | 'openers'
  | 'strengthen'
  | 'meeting-intent'
  | 'work-portfolio'
  | 'referral-loop'
  | 'fallback';

export type SuggestContext = {
  messages: readonly Message[];
  /** The viewer, so "last message is yours" can be decided. */
  meUid: string;
  /** Their first name, for suggestions that address them directly. */
  theirName?: string;
  /** True once a coffee is confirmed — rule 2. */
  booked: boolean;
  knownVenues?: readonly Venue[];
};

const KEYWORDS = {
  meeting: [
    'coffee',
    'meet',
    'chat',
    'call',
    'catch up',
    'grab',
    'free',
    'available',
    'schedule',
    'calendar',
    'time',
    'when',
  ],
  work: ['work', 'project', 'portfolio', 'case study', 'design', 'shipped', 'built', 'site'],
  referral: ['refer', 'referral', 'role', 'opening', 'loop', 'interview', 'apply', 'hiring', 'req'],
} as const;

function lastFrom(
  messages: readonly Message[],
  predicate: (m: Message) => boolean,
): Message | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && predicate(message)) return message;
  }
  return null;
}

function hasAny(text: string, words: readonly string[]): boolean {
  const haystack = text.toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function name(context: SuggestContext): string {
  return context.theirName?.trim() || 'there';
}

function cafeSuggestions(mention: CafeMention): Suggestion[] {
  return [
    {
      short: 'Send times',
      text: `${mention.name} works for me — shall I send some times?`,
      rule: 'cafe',
      pinned: true,
    },
    {
      short: 'Suggest Thursday',
      text: `Love ${mention.name}. How is Thursday morning?`,
      rule: 'cafe',
    },
    { short: 'Offer to book', text: 'Want me to book it for 30 minutes?', rule: 'cafe' },
  ];
}

function bookedSuggestions(): Suggestion[] {
  return [
    {
      short: 'Ask what to read',
      text: 'Looking forward to it. Anything you want me to read up on first?',
      rule: 'booked',
    },
    {
      short: 'Promise questions',
      text: 'I will bring a couple of specific questions rather than winging it.',
      rule: 'booked',
    },
    { short: 'Confirm you are coming', text: 'See you there — I will grab a table.', rule: 'booked' },
  ];
}

function openers(context: SuggestContext): Suggestion[] {
  const them = name(context);
  return [
    {
      short: 'Why they said yes',
      text: `Hi ${them} — what made you say yes to this one?`,
      rule: 'openers',
    },
    {
      short: 'Ask for 20 minutes',
      text: `Hi ${them}, I would love 20 minutes on how you got into your role.`,
      rule: 'openers',
    },
    {
      short: 'Offer to help first',
      text: `Hi ${them} — happy to be useful first. What are you working on?`,
      rule: 'openers',
    },
  ];
}

function strengthen(): Suggestion[] {
  return [
    {
      short: 'Name your target',
      text: 'To make it concrete: I am targeting product roles and can share a one-pager.',
      rule: 'strengthen',
    },
    {
      short: 'Take the pressure off',
      text: 'No rush at all — happy to work around your week.',
      rule: 'strengthen',
    },
    {
      short: 'Offer questions instead',
      text: 'If it is easier, I can send three specific questions instead of a call.',
      rule: 'strengthen',
    },
  ];
}

function meetingIntent(): Suggestion[] {
  return [
    {
      short: 'Say yes to coffee',
      text: 'Yes — a 30-minute coffee would be great. Want me to pick a spot?',
      rule: 'meeting-intent',
    },
    {
      short: 'Give your mornings',
      text: 'I am free most mornings this week. What suits you?',
      rule: 'meeting-intent',
    },
    {
      short: 'Offer a call',
      text: 'Happy to do a call instead if that is easier.',
      rule: 'meeting-intent',
    },
  ];
}

function workPortfolio(): Suggestion[] {
  return [
    {
      short: 'Name the project',
      text: 'Here is the case study I am proudest of — happy to walk you through it.',
      rule: 'work-portfolio',
    },
    {
      short: 'Ask what stood out',
      text: 'Thank you. What stood out, and what would you have pushed on?',
      rule: 'work-portfolio',
    },
    {
      short: 'What to lead with',
      text: 'I would love your read on which of these to lead with.',
      rule: 'work-portfolio',
    },
  ];
}

function referralLoop(): Suggestion[] {
  return [
    {
      short: 'Ask what they need',
      text: 'That would mean a lot. What do you need from me to make the referral easy?',
      rule: 'referral-loop',
    },
    {
      short: 'Offer a blurb',
      text: 'Happy to send a short blurb you can paste straight into the form.',
      rule: 'referral-loop',
    },
    {
      short: 'Ask about the loop',
      text: 'What does the loop look like from the inside?',
      rule: 'referral-loop',
    },
  ];
}

function fallback(): Suggestion[] {
  return [
    { short: 'Say thanks', text: 'That is really useful, thank you.', rule: 'fallback' },
    { short: 'Ask their path', text: 'How did you end up on that path?', rule: 'fallback' },
    { short: 'Offer help', text: 'Anything I can help with on your side?', rule: 'fallback' },
  ];
}

/**
 * The line above the chips, saying why these three and not others. The mock words it
 * as a state plus an instruction — "they asked about your work · answer with
 * specifics" — which is also the honest description of what each rule matched on.
 */
export function headlineFor(rule: SuggestRule): string {
  switch (rule) {
    case 'cafe':
      return 'A café came up · offer a time';
    case 'booked':
      return 'Coffee is booked · turn up well';
    case 'openers':
      return 'First message · make it easy to say yes';
    case 'strengthen':
      return 'You spoke last · make the ask concrete';
    case 'meeting-intent':
      return 'They want to meet · pick a time';
    case 'work-portfolio':
      return 'They asked about your work · answer with specifics';
    case 'referral-loop':
      return 'A referral is on the table · make it easy';
    case 'fallback':
      return 'Keep it going';
  }
}

export function suggest(context: SuggestContext): Suggestion[] {
  const { messages, meUid, booked } = context;

  // Rule 1 — a cafe named in the thread, and no booking yet.
  const mention = booked ? null : findCafeMention(messages, context.knownVenues ?? []);
  if (mention) return cafeSuggestions(mention);

  // Rule 2 — already booked.
  if (booked) return bookedSuggestions();

  // Rule 3 — nothing said yet.
  const conversation = messages.filter((message) => message.kind === 'text');
  if (conversation.length === 0) return openers(context);

  // Rule 4 — the ball is in their court.
  const last = conversation[conversation.length - 1];
  if (last && last.from === meUid) return strengthen();

  // Rule 5 — react to what they actually said.
  const theirLast = lastFrom(conversation, (message) => message.from !== meUid);
  if (theirLast) {
    const text = theirLast.text;
    if (hasAny(text, KEYWORDS.meeting)) return meetingIntent();
    if (hasAny(text, KEYWORDS.work)) return workPortfolio();
    if (hasAny(text, KEYWORDS.referral)) return referralLoop();
  }

  // Rule 6.
  return fallback();
}
