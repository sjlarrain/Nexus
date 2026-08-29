import { z } from 'zod';
import { LIMITS } from '@/lib/refdata/constants';

/**
 * Everything that is not the profile: swipes, likes, matches, messages, bookings.
 * Mirrors the collections in docs/architecture.md section 3.
 */

const uid = z.string().min(1).max(128);
const millis = z.number().int().nonnegative();

/** Right = yes, left = no, up = priority ask (spec section 1). */
export const SWIPE_ACTIONS = ['yes', 'no', 'priority'] as const;
export const swipeActionSchema = z.enum(SWIPE_ACTIONS);
export type SwipeAction = z.infer<typeof swipeActionSchema>;

export const swipeSchema = z.object({
  from: uid,
  to: uid,
  action: swipeActionSchema,
  createdAt: millis,
});
export type Swipe = z.infer<typeof swipeSchema>;

/**
 * The denormalised "who liked me" row. Written server-side as the mirror of someone
 * else's swipe, so the Likes screen is one indexed query.
 */
export const inboundLikeSchema = z.object({
  fromUid: uid,
  /** True when they swiped up — sorts to the top of the Likes list (spec section 1). */
  priority: z.boolean(),
  createdAt: millis,
});
export type InboundLike = z.infer<typeof inboundLikeSchema>;

export const lastMessageSchema = z.object({
  text: z.string(),
  at: millis,
  from: uid,
});

export const matchSchema = z.object({
  /** Always sorted, so the pair is order-independent. */
  participants: z.tuple([uid, uid]),
  createdAt: millis,
  lastMessage: lastMessageSchema.nullable(),
  bookingId: z.string().nullable(),
  /** Set when either side reports or blocks; hides the match from both. */
  closedAt: millis.nullable(),
});
export type Match = z.infer<typeof matchSchema>;

export const MESSAGE_KINDS = ['text', 'system'] as const;

export const messageSchema = z.object({
  from: uid,
  text: z.string().min(1).max(LIMITS.messageChars),
  kind: z.enum(MESSAGE_KINDS),
  createdAt: millis,
});
export type Message = z.infer<typeof messageSchema>;

export const venueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string(),
  /** Where the venue came from, so the UI can tag it. */
  source: z.enum(['nearby', 'search', 'chat-mention']),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type Venue = z.infer<typeof venueSchema>;

/**
 * Booking state machine (BACKLOG E10.4). One side proposes a venue and two slots,
 * the other accepts one; either may cancel.
 */
export const BOOKING_STATUSES = ['proposed', 'confirmed', 'cancelled'] as const;

export const bookingSchema = z.object({
  matchId: z.string().min(1),
  participants: z.tuple([uid, uid]),
  venue: venueSchema,
  /** Proposed options; `chosenSlot` points at the accepted one. */
  slots: z
    .array(z.object({ startsAt: millis, durationMin: z.literal(30) }))
    .min(1)
    .max(2),
  chosenSlot: millis.nullable(),
  status: z.enum(BOOKING_STATUSES),
  createdBy: uid,
  createdAt: millis,
  updatedAt: millis,
});
export type Booking = z.infer<typeof bookingSchema>;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
