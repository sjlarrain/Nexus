import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { counterpartOf } from '@/lib/matching/match-id';
import { findCafeMention, orderVenuesForBooking } from '@/lib/chat/cafe';
import { postSystemMessage } from '@/server/chat/messages';
import { badRequest, forbidden, notFound } from '@/server/http/respond';
import type { Booking, Match, Message, Venue } from '@/lib/schemas/entities';

/**
 * Coffee booking (BACKLOG E10.2, E10.4–E10.7).
 *
 * A three-state machine — proposed → confirmed, or cancelled from either — kept on
 * the server because both sides read it and neither can be trusted to advance it.
 * Every transition posts a system message into the thread, which is what makes the
 * booking visible in the conversation rather than hidden behind a tab.
 */

const THIRTY_MINUTES = 30;

async function requireMatch(uid: string, matchId: string): Promise<Match> {
  const snapshot = await adminDb().collection('matches').doc(matchId).get();
  const match = snapshot.data() as Match | undefined;
  if (!match) throw notFound('No such conversation.');
  if (!match.participants.includes(uid)) throw forbidden('That is not your conversation.');
  return match;
}

/**
 * The three nearby venues plus anything named in the chat, ordered for the booking
 * screen. A cafe mentioned in the thread pins to the top tagged "Mentioned in your
 * chat" (spec section 1) — the same matcher that drives rule 1 of `suggest()`.
 */
export async function venuesForMatch(
  uid: string,
  matchId: string,
): Promise<{ venue: Venue; mentionedInChat: boolean }[]> {
  await requireMatch(uid, matchId);
  const db = adminDb();

  const [venueDocs, messageDocs] = await Promise.all([
    db.collection('venues').limit(25).get(),
    db.collection('matches').doc(matchId).collection('messages').orderBy('createdAt').get(),
  ]);

  const venues = venueDocs.docs.map((doc) => doc.data() as Venue);
  const messages = messageDocs.docs.map((doc) => doc.data() as Message);

  return orderVenuesForBooking(venues, findCafeMention(messages, venues));
}

export async function proposeBooking(
  uid: string,
  matchId: string,
  venueId: string,
  slots: number[],
): Promise<{ bookingId: string }> {
  const match = await requireMatch(uid, matchId);
  if (match.bookingId !== null) throw badRequest('This match already has a coffee booked.');
  if (slots.length === 0 || slots.length > 2) throw badRequest('Propose one or two times.');
  if (slots.some((startsAt) => startsAt < Date.now())) {
    throw badRequest('Those times are in the past.');
  }

  const db = adminDb();
  const venueDoc = await db.collection('venues').doc(venueId).get();
  const venue = venueDoc.data() as Venue | undefined;
  if (!venue) throw notFound('That venue is not on the list.');

  const now = Date.now();
  const bookingRef = db.collection('bookings').doc();

  const booking: Booking = {
    matchId,
    participants: match.participants,
    venue,
    slots: slots.map((startsAt) => ({ startsAt, durationMin: THIRTY_MINUTES })),
    chosenSlot: null,
    status: 'proposed',
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  await bookingRef.set(booking);
  await db.collection('matches').doc(matchId).update({ bookingId: bookingRef.id });
  await postSystemMessage(matchId, `A 30-minute coffee was proposed at ${venue.name}.`);

  return { bookingId: bookingRef.id };
}

export async function acceptBooking(
  uid: string,
  bookingId: string,
  startsAt: number,
): Promise<{ status: Booking['status']; chosenSlot: number }> {
  const db = adminDb();
  const ref = db.collection('bookings').doc(bookingId);
  const booking = (await ref.get()).data() as Booking | undefined;

  if (!booking) throw notFound('No such booking.');
  if (!booking.participants.includes(uid)) throw forbidden('That is not your booking.');
  if (booking.status !== 'proposed') throw badRequest('That booking is no longer open.');

  // Whoever proposed already picked their times; accepting is the other side's job.
  if (booking.createdBy === uid) throw badRequest('Wait for them to pick a time.');
  if (!booking.slots.some((slot) => slot.startsAt === startsAt)) {
    throw badRequest('That time was not one of the options.');
  }

  await ref.update({ status: 'confirmed', chosenSlot: startsAt, updatedAt: Date.now() });
  await postSystemMessage(
    booking.matchId,
    `Coffee is confirmed at ${booking.venue.name} for ${new Date(startsAt).toUTCString()}.`,
  );

  return { status: 'confirmed', chosenSlot: startsAt };
}

export async function cancelBooking(uid: string, bookingId: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection('bookings').doc(bookingId);
  const booking = (await ref.get()).data() as Booking | undefined;

  if (!booking) throw notFound('No such booking.');
  if (!booking.participants.includes(uid)) throw forbidden('That is not your booking.');
  if (booking.status === 'cancelled') return;

  await ref.update({ status: 'cancelled', updatedAt: Date.now() });
  // Clearing bookingId is what lets the pair propose a new time, and what puts
  // `suggest()` back on the cafe rule instead of the post-booking set.
  await db.collection('matches').doc(booking.matchId).update({ bookingId: null });
  await postSystemMessage(booking.matchId, 'The coffee was cancelled.');
}

export async function loadBooking(uid: string, bookingId: string): Promise<Booking> {
  const booking = (await adminDb().collection('bookings').doc(bookingId).get()).data() as
    | Booking
    | undefined;
  if (!booking) throw notFound('No such booking.');
  if (!booking.participants.includes(uid)) throw forbidden('That is not your booking.');
  return booking;
}

/** Two sensible 30-minute options: tomorrow and the day after, mid-morning. */
export function defaultSlots(now = Date.now()): number[] {
  const base = new Date(now);
  base.setHours(10, 0, 0, 0);
  const day = 86_400_000;
  return [base.getTime() + day, base.getTime() + 2 * day];
}

/** Who still has to act, for the booking screen's copy. */
export function waitingOn(booking: Booking, uid: string): 'you' | 'them' | null {
  if (booking.status !== 'proposed') return null;
  return booking.createdBy === uid ? 'them' : 'you';
}

export { counterpartOf };
