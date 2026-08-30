import 'server-only';
import { adminDb } from '@/server/firebase/admin';
import { counterpartOf } from '@/lib/matching/match-id';
import { findCafeMention, orderVenuesForBooking } from '@/lib/chat/cafe';
import { postSystemMessage } from '@/server/chat/messages';
import { profileSchema } from '@/lib/schemas/profile';
import { badRequest, forbidden, notFound } from '@/server/http/respond';
import type { Booking, BookingMode, Match, Message, Venue } from '@/lib/schemas/entities';

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

/**
 * The other person's first name. The booking screen leads with "Book a coffee chat
 * with <name>" (chat mock), and this is the one thing on that screen the venues
 * payload did not already carry.
 */
export async function counterpartFirstName(uid: string, matchId: string): Promise<string> {
  const match = await requireMatch(uid, matchId);
  const person = await adminDb()
    .collection('users')
    .doc(counterpartOf(match.participants, uid))
    .get();

  const data = person.data();
  if (!data) return 'them';
  const parsed = profileSchema.safeParse(data);
  return parsed.success && parsed.data.first.trim().length > 0 ? parsed.data.first : 'them';
}

export async function proposeBooking(
  uid: string,
  matchId: string,
  mode: BookingMode,
  venueId: string | null,
  slots: number[],
): Promise<{ bookingId: string }> {
  const match = await requireMatch(uid, matchId);
  if (match.bookingId !== null) throw badRequest('This match already has a coffee booked.');
  if (slots.length === 0 || slots.length > 2) throw badRequest('Propose one or two times.');
  if (slots.some((startsAt) => startsAt < Date.now())) {
    throw badRequest('Those times are in the past.');
  }
  if (mode === 'in_person' && !venueId) throw badRequest('Pick a café for an in-person coffee.');

  const db = adminDb();

  let venue: Venue | null = null;
  if (mode === 'in_person' && venueId) {
    const venueDoc = await db.collection('venues').doc(venueId).get();
    venue = (venueDoc.data() as Venue | undefined) ?? null;
    if (!venue) throw notFound('That venue is not on the list.');
  }

  const now = Date.now();
  const bookingRef = db.collection('bookings').doc();

  const booking: Booking = {
    matchId,
    participants: match.participants,
    mode,
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
  await postSystemMessage(
    matchId,
    `A 30-minute coffee was proposed${venue ? ` at ${venue.name}` : ' — video call'}.`,
  );

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
    `Coffee is confirmed${booking.venue ? ` at ${booking.venue.name}` : ' over video call'} for ${new Date(startsAt).toUTCString()}.`,
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

/**
 * The booking attached to a match, if there is one. The booking screen needs this to
 * know whether to offer the propose form or the accept/cancel controls — without it
 * a proposed coffee has no way to be accepted from the UI.
 */
export async function bookingForMatch(
  uid: string,
  matchId: string,
): Promise<{ id: string; booking: Booking } | null> {
  const match = await requireMatch(uid, matchId);
  if (match.bookingId === null) return null;

  const snapshot = await adminDb().collection('bookings').doc(match.bookingId).get();
  const booking = snapshot.data() as Booking | undefined;
  // A match pointing at a booking that no longer exists is treated as unbooked
  // rather than an error, so the pair can simply propose again.
  if (!booking || booking.status === 'cancelled') return null;

  return { id: snapshot.id, booking };
}

export async function loadBooking(uid: string, bookingId: string): Promise<Booking> {
  const booking = (await adminDb().collection('bookings').doc(bookingId).get()).data() as
    Booking | undefined;
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
