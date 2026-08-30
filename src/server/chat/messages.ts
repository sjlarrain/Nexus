import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { counterpartOf } from '@/lib/matching/match-id';
import { profileSchema } from '@/lib/schemas/profile';
import { toCard, type Card } from '@/lib/cards/card';
import { suggest, type Suggestion } from '@/lib/chat/suggest';
import { findCafeMention } from '@/lib/chat/cafe';
import { LIMITS } from '@/lib/refdata/constants';
import { badRequest, forbidden, notFound } from '@/server/http/respond';
import type { Booking, Match, Message, Venue } from '@/lib/schemas/entities';

/**
 * Chat (BACKLOG E9.1, E9.3).
 *
 * Messages are written server-side even though a rule could check them, because the
 * write is really two writes: the message, and the `lastMessage` summary the match
 * list reads. Doing both in one batch is what keeps the list from going stale
 * (docs/decisions.md, 2026-08-28).
 */

async function requireMatch(uid: string, matchId: string): Promise<Match> {
  const snapshot = await adminDb().collection('matches').doc(matchId).get();
  const match = snapshot.data() as Match | undefined;
  if (!match) throw notFound('No such conversation.');
  if (!match.participants.includes(uid)) throw forbidden('That is not your conversation.');
  return match;
}

export async function sendMessage(
  uid: string,
  matchId: string,
  text: string,
): Promise<{ id: string; createdAt: number }> {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw badRequest('A message cannot be empty.');
  if (trimmed.length > LIMITS.messageChars) {
    throw badRequest(`A message cannot be longer than ${LIMITS.messageChars} characters.`);
  }

  const match = await requireMatch(uid, matchId);
  if (match.closedAt !== null) throw forbidden('This conversation is closed.');

  const db = adminDb();
  const now = Date.now();
  const matchRef = db.collection('matches').doc(matchId);
  const messageRef = matchRef.collection('messages').doc();

  const message: Message = { from: uid, text: trimmed, kind: 'text', createdAt: now };

  const batch = db.batch();
  batch.set(messageRef, message);
  batch.update(matchRef, { lastMessage: { text: trimmed, at: now, from: uid } });
  await batch.commit();

  return { id: messageRef.id, createdAt: now };
}

/** Booking state changes post a system message into the thread (BACKLOG E10.5). */
export async function postSystemMessage(matchId: string, text: string): Promise<void> {
  const db = adminDb();
  const now = Date.now();
  const matchRef = db.collection('matches').doc(matchId);

  const batch = db.batch();
  batch.set(matchRef.collection('messages').doc(), {
    from: 'system',
    text,
    kind: 'system',
    createdAt: now,
  } satisfies Message);
  batch.update(matchRef, { lastMessage: { text, at: now, from: 'system' } });
  await batch.commit();
}

export type Thread = {
  matchId: string;
  counterpart: Card;
  /** When the mutual yes happened — the thread opens with the date of it. */
  matchedAt: number;
  messages: (Message & { id: string })[];
  suggestions: Suggestion[];
  booked: boolean;
  /**
   * The booking itself, so the thread can show when and where rather than only that
   * something was booked (the confirmed card in the chat mock).
   */
  booking: (Booking & { id: string }) | null;
  cafeMentioned: string | null;
  /** Sent so the client can recompute suggestions locally as messages arrive. */
  venues: Venue[];
};

export async function loadThread(uid: string, matchId: string): Promise<Thread> {
  const match = await requireMatch(uid, matchId);
  const db = adminDb();

  const otherUid = counterpartOf(match.participants, uid);
  const [person, messageDocs, venueDocs] = await Promise.all([
    db.collection('users').doc(otherUid).get(),
    db.collection('matches').doc(matchId).collection('messages').orderBy('createdAt').get(),
    db.collection('venues').limit(25).get(),
  ]);

  const data = person.data();
  if (!data) throw notFound('That person is no longer available.');
  const profile = profileSchema.parse(data);

  const messages = messageDocs.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Message),
  }));
  const venues = venueDocs.docs.map((doc) => doc.data() as Venue);
  const booked = match.bookingId !== null;

  // A match can point at a booking that was since cancelled, so the row is read
  // rather than assumed from the pointer alone.
  const bookingDoc = match.bookingId
    ? await db.collection('bookings').doc(match.bookingId).get()
    : null;
  const bookingData = bookingDoc?.data() as Booking | undefined;

  return {
    matchId,
    counterpart: toCard(otherUid, profile),
    matchedAt: match.createdAt,
    messages,
    suggestions: suggest({
      messages,
      meUid: uid,
      theirName: profile.first,
      booked,
      knownVenues: venues,
    }),
    booked,
    booking:
      bookingData && bookingDoc ? { id: bookingDoc.id, ...bookingData } : null,
    cafeMentioned: booked ? null : (findCafeMention(messages, venues)?.name ?? null),
    venues,
  };
}

export type MatchSummary = {
  matchId: string;
  counterpart: Card;
  lastMessage: Match['lastMessage'];
  booked: boolean;
  createdAt: number;
};

export async function listMatches(uid: string): Promise<MatchSummary[]> {
  const db = adminDb();
  const snapshot = await db
    .collection('matches')
    .where('participants', 'array-contains', uid)
    .get();

  const summaries = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const match = doc.data() as Match;
      if (match.closedAt !== null) return null;

      const otherUid = counterpartOf(match.participants, uid);
      const person = await db.collection('users').doc(otherUid).get();
      const data = person.data();
      if (!data) return null;

      const parsed = profileSchema.safeParse(data);
      if (!parsed.success) return null;

      return {
        matchId: doc.id,
        counterpart: toCard(otherUid, parsed.data),
        lastMessage: match.lastMessage,
        booked: match.bookingId !== null,
        createdAt: match.createdAt,
      };
    }),
  );

  // Most recent conversation first; a match with no messages sorts on when it was made.
  return summaries
    .filter((summary) => summary !== null)
    .sort((a, b) => (b.lastMessage?.at ?? b.createdAt) - (a.lastMessage?.at ?? a.createdAt));
}
