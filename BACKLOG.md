# BACKLOG — Warm Intro

Source of truth for scope: [`docs/planup.md`](docs/planup.md).
How we build it: [`docs/architecture.md`](docs/architecture.md).
Working rules: [`CLAUDE.md`](CLAUDE.md).

**Order matters.** Epics are listed in dependency order. Within an epic, items are
top-to-bottom. Tick a box only when the Definition of Done in `CLAUDE.md` §6 is met.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🔒 blocked on the owner ·
🎨 blocked on HTML mocks

---

## E0 — Foundations

- [ ] `E0.1` Scaffold Next.js App Router + TypeScript strict, `src/` layout
- [ ] `E0.2` ESLint + Prettier + `npm run typecheck` / `lint` / `test` scripts
- [ ] `E0.3` Vitest set up; one smoke test that actually runs in CI
- [ ] `E0.4` Folder skeleton per `CLAUDE.md` §4
- [ ] `E0.5` `.env.example` with every key the app reads, documented inline
- [ ] `E0.6` GitHub Actions: typecheck + lint + test on push
- [ ] `E0.7` Path aliases (`@/lib`, `@/server`) + lint rule forbidding `@/server`
      imports from client components

## E1 — Firebase & environment

- [ ] `E1.1` 🔒 Create Firebase project(s) — one project with emulator-only local dev,
      or separate dev/prod projects? Owner call.
- [ ] `E1.2` Client SDK init (`src/lib/firebase/client.ts`), singleton-safe under HMR
- [ ] `E1.3` Admin SDK init (`src/server/firebase/admin.ts`) from a base64 service
      account env var; never a JSON file on disk
- [ ] `E1.4` Firebase Emulator Suite (auth, firestore, storage) + `npm run dev:emul`
- [ ] `E1.5` Seed script: fixture users including Jordan Reyes and Daniel Okafor from
      the spec demo data, plus reference data
- [ ] `E1.6` `firestore.indexes.json` committed and deployed from CI

## E2 — Auth (onboarding step 0)

- [ ] `E2.1` Google sign-in + email sign-in via Firebase Auth
- [ ] `E2.2` Session: ID token to httpOnly session cookie, verified in route handlers
- [ ] `E2.3` `requireUser()` server helper returning a typed `AuthedUser`
- [ ] `E2.4` On first sign-in, create `users/{uid}` shell + `users/{uid}/private/meta`
- [ ] `E2.5` Route protection: unauthenticated to auth screen; authenticated but
      unpublished resumes onboarding at the saved step
- [ ] `E2.6` Sign-out and account deletion (removes profile, swipes, inbox, storage)

## E3 — Profile schema and persistence

Covers spec §4 (profile object) and §3 (gating).

- [ ] `E3.1` Zod schemas in `src/lib/schemas/profile.ts` mirroring spec §4 exactly,
      including `mode: 'working' | 'student' | 'looking'`
- [ ] `E3.2` Per-step gate refinements matching the §3 table, each returning the
      missing-field message used as the disabled button label
- [ ] `E3.3` Draft-state fields (`schoolDraft`, `referDraft`, ...) stay out of the
      persisted document — they are form state, not profile data
- [ ] `E3.4` `PATCH /api/profile` — partial, per-step, validated, idempotent
- [ ] `E3.5` "Save & exit": persist partial progress + `onboarding.step` on every step
      transition and on explicit save
- [ ] `E3.6` `POST /api/profile/publish` — full validation, sets `onboarding.completed`,
      makes the user visible in decks
- [ ] `E3.7` Unit tests for every row of the §3 gate table, pass and fail cases

## E4 — Reference data

- [ ] `E4.1` US states to cities dataset; city stored as `"City, ST"`; changing state
      clears city (spec §2 step 1)
- [ ] `E4.2` Industries, functions/lanes, years bands, course types (Undergraduate,
      MBA, MSBA, MS, PhD, Other)
- [ ] `E4.3` `openTo` options (Referrals, Mock interviews, Resume review, Career
      advice, Industry intel, Cofounder chat) and the interests taxonomy
- [ ] `E4.4` Company peer map (Figma to Notion, Canva, Adobe, Linear, Airtable, plus a
      fallback list) powering door suggestions and target-company suggestions
- [ ] `E4.5` `GET /api/refdata` with long cache headers; user-added companies merge
      into the same list so they render as already-selected (spec §6)

## E5 — Photos

- [ ] `E5.1` Storage layout `users/{uid}/photos/{slot}` for headshot / at-work /
      off-the-clock
- [ ] `E5.2` Client-side resize and compress before upload; reject oversized or
      non-image files
- [ ] `E5.3` Storage rules: owner-only write, signed-in read
- [ ] `E5.4` Photo count exposed for the "n of 3" pill hint (data side only)
- [ ] `E5.5` Delete/replace a slot, with orphan cleanup

## E6 — Deck and candidate feed

- [ ] `E6.1` `GET /api/deck` — exclusion set (self, already swiped, matched, blocked)
- [ ] `E6.2` Filters: industry, role, location, direction — server-side, paginated
- [ ] `E6.3` v1 ranking per `docs/architecture.md` §5, unit-tested and explainable
- [ ] `E6.4` Card payload shape: only the fields the card renders; role line composed
      by filtering empty parts before joining with " · " (spec §6)
- [ ] `E6.5` Prefetch + cursor so the deck never blocks on a swipe

## E7 — Swipes and matching

- [ ] `E7.1` `POST /api/swipe` accepting `yes` / `no` / `priority`
- [ ] `E7.2` Transactional mutual-match detection; deterministic `matchId` so
      simultaneous swipes cannot double-create a match
- [ ] `E7.3` Write `inbox/{them}/likes/{me}`; `priority` (swipe up) sorts to the top of
      their Likes (spec §1)
- [ ] `E7.4` Rate limiting and a daily swipe cap
- [ ] `E7.5` 🔒 Undo last swipe — in scope for v1?
- [ ] `E7.6` Tests: mutual yes, double-swipe race, self-swipe, swipe on a stale card

## E8 — Likes

- [ ] `E8.1` `GET /api/likes` — inbound likes, priority first, then recency
- [ ] `E8.2` Yes-back matches instantly and returns the match-moment payload
- [ ] `E8.3` Pass from the Likes screen removes the inbound like

## E9 — Chat

- [ ] `E9.1` `POST /api/matches/{id}/messages` plus a realtime `onSnapshot` read stream
- [ ] `E9.2` Rules: only participants read or write; no thread exists without a match
- [ ] `E9.3` `lastMessage` denormalised onto the match for the list view
- [ ] `E9.4` Read receipts / unread counts
- [ ] `E9.5` `suggest()` as a pure function implementing the six ordered rules in §1
- [ ] `E9.6` Cafe-name detection in a thread, shared with the booking screen's
      "Mentioned in your chat" pin
- [ ] `E9.7` Table-driven tests, one case per branch of `suggest()`
- [ ] `E9.8` Report / block a match

## E10 — Coffee booking

- [ ] `E10.1` 🔒 Pick a venue search provider (Google Places / Mapbox / Foursquare) —
      needs a billing decision
- [ ] `E10.2` `GET /api/venues?near=` returning three nearby venues, plus manual search
- [ ] `E10.3` Chat-mentioned cafe pinned first, tagged "Mentioned in your chat"
- [ ] `E10.4` Two 30-minute slot proposals; `POST /api/bookings` with a
      propose to accept to confirmed state machine
- [ ] `E10.5` System message posted into the thread on booking state changes
- [ ] `E10.6` Post-booking suggestion set becomes active (rule 2 of `suggest()`)
- [ ] `E10.7` Cancel and reschedule

## E11 — Profile screen and activity

- [ ] `E11.1` `GET /api/me` — card preview payload
- [ ] `E11.2` 🔒 Reply-rate computation — exact definition needed — and its storage
- [ ] `E11.3` Editable prompts `p1` / `p2` / `p3`
- [ ] `E11.4` Activity feed events (liked you, matched, message, booking)

## E12 — Security and abuse

- [ ] `E12.1` `firestore.rules` covering every collection in the data model
- [ ] `E12.2` Rules unit tests against the emulator — one per client-reachable path
- [ ] `E12.3` Storage rules tests
- [ ] `E12.4` Rate limits on swipe, message, booking, profile write
- [ ] `E12.5` Input sanitisation and length caps (headline 80, bio 300 per spec §2)
- [ ] `E12.6` Block list honoured by deck, likes, and chat
- [ ] `E12.7` PII review: nothing sensitive in `users/{uid}`; secrets in `private/`

## E13 — Integrations

- [ ] `E13.1` 🔒 LinkedIn Connect — real OAuth needs an approved LinkedIn app. Ships
      behind a feature flag with fixtures until then. Fills the URL field and imports
      the education entry; label flips to "Imported from LinkedIn · Refresh"
- [ ] `E13.2` 🔒 Transactional email (new match, new message, booking confirmed) —
      provider TBD

## E14 — Delivery

- [ ] `E14.1` Vercel project, preview deploys per branch, env vars per environment
- [ ] `E14.2` Firestore rules and indexes deployed from CI, not by hand
- [ ] `E14.3` Error tracking and structured server logs
- [ ] `E14.4` `README.md`: setup, emulators, seeding, deploy
- [ ] `E14.5` Smoke tests against a preview deploy

## E15 — UI 🎨 (blocked on HTML mocks)

Nothing here starts until the mocks land in `docs/mocks/`.

- [ ] `E15.1` Extract design tokens from the mocks (spec §5: ink `#17150f`, accent
      `#a2542a`, wash `#f6f4f0`, success `#2f7d5e`; Plus Jakarta Sans + IBM Plex Mono)
- [ ] `E15.2` Primitives: card, multi-select grid, input, primary button (disabled is
      ink at 28% with the validation message as the label), 44px touch targets
- [ ] `E15.3` Onboarding steps 0-5 wired to E3
- [ ] `E15.4` Deck with drag thresholds dx ±105 / dy −110, filters sheet, activity feed
- [ ] `E15.5` Likes, match moment, chat with suggested replies, booking, profile
- [ ] `E15.6` `flex-shrink: 0` on fixed-proportion blocks in scrolling step columns
      (spec §6 — the column squashes cards otherwise)
- [ ] `E15.7` Accessibility pass and mobile viewport testing

---

## Open questions for the owner

Tracked here until answered, then moved to `docs/decisions.md`.

1. **Environments** — one Firebase project with emulator-only local dev, or separate
   dev and prod projects?
2. **Web only?** Mobile web app (PWA) for now, or is a native shell planned? It
   changes auth and notification choices.
3. **Venue provider** — Google Places has the best data but needs billing enabled.
4. **LinkedIn** — v1 or stubbed behind a flag?
5. **Deck scope** — nationwide from day one, or city-scoped so the deck feels dense?
6. **Reply rate** — exact definition shown on the profile screen.
7. **Undo swipe** — in scope for v1?
8. **Email sign-in** — magic link or password?
