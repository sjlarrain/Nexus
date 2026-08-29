import type { BookingStatus } from '@/lib/schemas/entities';

/**
 * Activity feed (BACKLOG E11.4) — the strip on the deck screen that tells you what
 * happened while you were away.
 *
 * Read-only and derived: every event below is reconstructed from data another feature
 * already writes (inbox likes, match creation, `lastMessage`, bookings). There is no
 * events collection, so nothing here can drift out of sync with the thing it
 * describes, and no write path had to change to add it.
 *
 * Pure so the ordering and the copy are table-testable.
 */

export type ActivityKind = 'like' | 'match' | 'message' | 'booking';

export type ActivityEvent = {
  kind: ActivityKind;
  at: number;
  text: string;
  /** Where tapping the row goes; null when there is nowhere useful to send them. */
  href: string | null;
  /** A priority ask is the one row worth shouting about (spec section 1). */
  emphasis: boolean;
};

export type ActivityInput = {
  uid: string;
  likes: readonly { name: string; priority: boolean; createdAt: number }[];
  matches: readonly {
    matchId: string;
    name: string;
    createdAt: number;
    lastMessage: { text: string; at: number; from: string } | null;
  }[];
  bookings: readonly {
    matchId: string;
    name: string;
    venueName: string;
    status: BookingStatus;
    updatedAt: number;
  }[];
};

/** Keeps a one-line preview from swallowing the row. */
function preview(text: string, max = 60): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function bookingText(name: string, venueName: string, status: BookingStatus): string {
  switch (status) {
    case 'proposed':
      return `${name} proposed a coffee at ${venueName}`;
    case 'confirmed':
      return `Coffee with ${name} is confirmed at ${venueName}`;
    case 'cancelled':
      return `The coffee with ${name} was cancelled`;
  }
}

export function buildActivity(input: ActivityInput, limit = 20): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const like of input.likes) {
    events.push({
      kind: 'like',
      at: like.createdAt,
      text: like.priority ? `${like.name} sent you a priority ask` : `${like.name} liked you`,
      href: '/likes',
      emphasis: like.priority,
    });
  }

  for (const match of input.matches) {
    events.push({
      kind: 'match',
      at: match.createdAt,
      text: `You matched with ${match.name}`,
      href: `/chat/${match.matchId}`,
      emphasis: false,
    });

    // Only their messages are activity. Your own last message is not news to you.
    const last = match.lastMessage;
    if (last && last.from !== input.uid && last.from !== 'system') {
      events.push({
        kind: 'message',
        at: last.at,
        text: `${match.name}: ${preview(last.text)}`,
        href: `/chat/${match.matchId}`,
        emphasis: false,
      });
    }
  }

  for (const booking of input.bookings) {
    events.push({
      kind: 'booking',
      at: booking.updatedAt,
      text: bookingText(booking.name, booking.venueName, booking.status),
      href: `/chat/${booking.matchId}/coffee`,
      emphasis: false,
    });
  }

  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** "3 people liked you" — the collapsed headline above the feed. */
export function activitySummary(events: readonly ActivityEvent[]): string | null {
  const likes = events.filter((event) => event.kind === 'like').length;
  const messages = events.filter((event) => event.kind === 'message').length;

  const parts: string[] = [];
  if (likes > 0) parts.push(likes === 1 ? '1 person liked you' : `${likes} people liked you`);
  if (messages > 0) parts.push(messages === 1 ? '1 new message' : `${messages} new messages`);

  return parts.length === 0 ? null : parts.join(' · ');
}
