# Architecture — Warm Intro

Companion to `docs/planup.md` (product spec, source of truth). This file explains
*how* we build it. Every decision here is provisional until ticked in
`docs/decisions.md`.

---

## 1. Topology

```
        Browser (Next.js client, mobile-first PWA)
              |                        |
   Firebase JS SDK (auth,        fetch -> Next.js Route Handlers
   realtime Firestore reads,           (Vercel serverless, firebase-admin)
   Storage upload)                            |
              |                               |
              +----------- Firestore / Storage ------------+
                     (guarded by firestore.rules)
```

Two write paths, deliberately:

- **Client SDK direct** for things that are cheap, per-user, and fully expressible
  in security rules: own profile edits, chat messages inside a match, read
  subscriptions (deck refresh, likes, message stream).
- **Server route handlers** for anything requiring privilege or invariants a client
  cannot be trusted with: swipe recording + mutual-match creation, opening a chat
  thread, booking a coffee, reading another user's card, LinkedIn import, moderation.

Rule of thumb: if a malicious client could forge it into a lie about *another* user,
it goes through the server.

## 2. Why this and not the alternatives

| Decision | Chosen | Rejected because |
| --- | --- | --- |
| Backend runtime | Next.js Route Handlers on Vercel | Firebase Cloud Functions needs the Blaze plan and splits deploys across two providers; Vercel already hosts the app. Revisit if we need Firestore triggers (see §7). |
| Realtime chat | Firestore `onSnapshot` | A socket server would need a stateful host, which Vercel is not. |
| Auth | Firebase Auth | Comes free with the stack; Google + email is exactly what step 0 asks for. |
| Validation | Zod, shared | One definition of "a profile" for form gating, route handlers, and tests. The onboarding gate table (spec §3) is literally a Zod refinement per step. |

## 3. Firestore data model

Collection names are plural, document ids are opaque.

```
users/{uid}
  # public card surface — readable by any signed-in, onboarded user
  first, last, headline, photos[3], city, stateName, mode,
  company, role, industry, lane, years, schools[], linkedin,
  referCompanies[], will{}, industries[], lanes[], targetCompanies[],
  interests[], openTo[], bio, direction, prompts{p1,p2,p3},
  onboarding{ step, completed, publishedAt },
  stats{ replyRate, lastActiveAt }, createdAt, updatedAt

users/{uid}/private/meta
  # never readable by anyone else
  email, authProviders[], linkedinTokenRef, flags{}

swipes/{uid}__{targetUid}
  from, to, action: 'yes' | 'no' | 'priority', createdAt
  # write: server only. Read: neither party (server reads via admin).

inbox/{uid}/likes/{fromUid}
  # denormalised "who liked me", written server-side on an inbound yes.
  fromUid, action, priority: boolean, createdAt
  # 'priority' (swipe up) sorts to the top of the Likes list — spec §1.

matches/{matchId}            # matchId = sorted uid pair, hashed
  participants: [uidA, uidB], createdAt,
  lastMessage{ text, at, from }, booking{ ref, status } | null

matches/{matchId}/messages/{messageId}
  from, text, createdAt, kind: 'text' | 'system'

bookings/{bookingId}
  matchId, participants[], venue{ id, name, address, source },
  slot{ startsAt, durationMin: 30 }, status, createdBy, createdAt

venues/{venueId}             # cache of resolved places
refdata/{docId}              # states+cities, industries, functions, peer map
```

Notes:

- `matchId` is derived (`sha1(uidA + '__' + uidB)` with uids sorted) so a mutual yes
  is idempotent — two simultaneous swipes cannot create two matches.
- `inbox/{uid}/likes` exists so the Likes screen is one indexed query instead of a
  scan of `swipes`. It is written by the server in the same transaction as the swipe.
- Nothing in `users/{uid}` is secret; anything secret goes to the `private`
  subcollection. This keeps the rules simple.

## 4. Matching flow

1. Client calls `POST /api/swipe { targetUid, action }`.
2. Server verifies the caller's ID token, validates `action`, and runs a transaction:
   - write `swipes/{me}__{them}`
   - if `action !== 'no'`, write `inbox/{them}/likes/{me}`
   - read `swipes/{them}__{me}`; if it is a yes/priority, create `matches/{matchId}`
     (idempotent), delete both inbox like docs, and return `{ matched: true, matchId }`.
3. Client shows the match moment and can now open the chat.

**No chat before a mutual yes** (spec §1) is enforced by rules: message writes
require the caller's uid to be in `matches/{matchId}.participants`.

## 5. Deck / candidate feed

`GET /api/deck` returns a page of candidate cards. v1 ranking, deliberately simple
and explainable:

1. exclude self, already-swiped, already-matched, blocked
2. hard filter on the Filters sheet (industry, role, location, direction)
3. score = door overlap (their `referCompanies` ∩ my `targetCompanies`)
   + direction complement (`refer` ↔ `looking`)
   + industry/function overlap + recency of activity
4. shuffle within score bands so the deck does not look deterministic

Swipe thresholds (dx ±105, dy −110) are client-side UI constants and live with the
deck component, not the API.

## 6. Suggested replies

`suggest()` from spec §1 is a **pure function** in `src/lib/chat/suggest.ts`:
`(thread, match, booking) => Suggestion[]`, ordered by the six rules in the spec.
Pure = table-testable, no I/O, runs client-side for instant feel. Café detection
(rule 1) uses a venue-name matcher over the thread; the same matcher feeds the
"Mentioned in your chat" pin on the booking screen.

## 7. Deferred / open

- **Scheduled + trigger work** (activity feed fan-out, reply-rate recompute, stale
  match cleanup). Options: Vercel Cron, or move to Cloud Functions if we need true
  Firestore triggers. Decide when the first one is actually needed.
- **Push notifications** (FCM) — out of scope until the mocks show where they surface.
- **Venue search provider** — Google Places vs Mapbox vs Foursquare. Needs a billing
  decision from the owner.
- **LinkedIn import** — real OAuth requires an approved LinkedIn app. Until then the
  Connect row is stubbed behind a feature flag with fixture data.
