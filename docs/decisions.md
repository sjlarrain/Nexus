# Decision log

Append-only. Newest at the bottom. One entry per decision that would be annoying to
reverse. Format: date · decision · why · who decided.

---

## 2026-08-28 — Repository bootstrap
**Decision:** TypeScript + Next.js (App Router) on Vercel, Firebase for auth /
Firestore / Storage, `firebase-admin` inside Next.js route handlers for privileged
writes. No Cloud Functions for now.
**Why:** Stack was set by the owner (TypeScript, Firebase, Vercel). Keeping the
server on Vercel avoids a second deploy target and the Blaze-plan requirement.
**Decided by:** Claude, pending owner confirmation.

## 2026-08-28 — No UI design work yet
**Decision:** Backend, data model, and business logic first. UI stays unstyled until
the owner delivers HTML mocks.
**Why:** Owner instruction — mocks define the visual language.
**Decided by:** Owner.

## Open — awaiting owner
- Web-only vs. native shell later (affects auth + push choices).
- Venue search provider and who pays for it.
- Whether LinkedIn import ships in v1 or stays stubbed.
- Whether the deck is US-nationwide from day one or city-scoped for density.

## 2026-08-28 — Environments: one Firebase project + local emulators
**Decision:** A single Firebase project serves the deployed (build-a-thon demo) app.
All local development runs against the **Firebase Emulator Suite** — a fake Firebase
that runs on this machine. A single seed script can target either one.
**Why:** the owner needs large volumes of simulated data and wants to reshape it
freely. The emulator makes that safe and instant: wipe it, reseed it, export a
snapshot, re-import it — no cost, no risk to the demo data. The one real project
still exists so the Vercel deploy has something to talk to during the event.
**Decided by:** Claude, after the owner explained the build-a-thon context.

## 2026-08-28 — Platform: mobile web / PWA only
**Decision:** Next.js mobile-first PWA. No native shell in scope.
**Decided by:** Owner.

## 2026-08-28 — Email sign-in: email + password
**Decision:** Firebase Auth email/password (plus Google). Requires a password reset
flow and password rules in E2.
**Decided by:** Owner.

## 2026-08-28 — No CSS framework (no Tailwind)
**Decision:** Plain CSS (CSS Modules + a global token sheet). No Tailwind.
**Why:** the design arrives as HTML mocks with real CSS. Translating that into
utility classes loses fidelity and costs time; extracting tokens from the mocks into
CSS custom properties keeps it one-to-one.
**Decided by:** Claude — reversible, flagging it here only.

## 2026-08-28 — Client writes only where rules can fully check them
**Decision:** Clients write their own profile and chat messages directly via the
Firebase SDK. Everything else — swipes, matches, bookings, inbox likes — goes through
Next.js route handlers using the Admin SDK, and is denied in `firestore.rules`.
**Why:** those writes assert something about *another* user, which a client cannot be
trusted with. It also keeps the rules small enough to read.
**Decided by:** Claude.

## 2026-08-28 — Firebase project `nexus-6c806`
**Decision:** Single project `nexus-6c806` (owner-created). Web config and a
base64-encoded service account live in `.env.local`, which is git-ignored.
**Note:** the service-account JSON file sits in the repo root. `.gitignore` was
widened to `*firebase-adminsdk*.json` — the original `firebase-adminsdk*.json`
pattern did not match the downloaded filename, which starts with the project id.
Verified with `git check-ignore`; the key was never staged or committed.
**Decided by:** Owner supplied the project; Claude wired it.

## 2026-08-28 — No Java on this machine, so no Firestore emulator
**Decision:** Develop against the real `nexus-6c806` project for the build-a-thon.
Emulator config stays in `firebase.json` for later.
**Why:** the Firestore emulator requires a JDK, which is not installed and would be a
system-wide install outside the project folder. For a demo project with seeded fake
data the cloud project is an acceptable target, and it is three clicks away.
**Decided by:** Claude, flagged to the owner.

## 2026-08-28 — Ship without Firebase Storage
**Decision:** No Cloud Storage bucket for now. Profile photos are URLs; the fixture
generator points at a deterministic placeholder service. The Storage rules and the
`users/{uid}/photos/{slot}` layout stay written and ready.
**Why:** new Firebase projects need the Blaze plan to use Storage, and the owner
cannot upgrade the project right now. Nothing in the demo depends on it — the deck,
likes, chat, and booking all work on URL-backed photos. Real uploads (BACKLOG E5) are
the only thing deferred.
**Cost if upgraded later:** Blaze needs a card on file but has a free monthly tier
(about 5 GB stored, 1 GB/day downloaded). A demo of this size would sit inside it and
bill nothing.
**Decided by:** Owner constraint; Claude adjusted the plan.

## 2026-08-28 — The service account cannot manage project config
**Decision:** Rules and indexes are not deployed from scripts yet.
`scripts/deploy-rules.ts` is written and correct but returns
`PERMISSION_DENIED (IAM_PERMISSION_DENIED)`; index creation returns the same. The
service account can read and write **data** but cannot manage **configuration**.
**Two ways out, owner's choice:**
1. `npx firebase login` once, then `npx firebase deploy --only firestore:rules,firestore:indexes`.
2. Grant the `firebase-adminsdk-fbsvc@nexus-6c806` service account the *Firebase Rules
   Admin* and *Cloud Datastore Index Admin* roles, after which `npm run deploy:rules`
   works headlessly and can run in CI.
**Consequence until then:** the database is in production mode, so direct client SDK
reads are denied. Server route handlers use the Admin SDK and are unaffected.
Queries needing composite indexes are sorted in memory instead.
**Decided by:** Claude, flagged to the owner.

## 2026-08-28 — Rules and indexes deployed
**Decision:** Deployed via `npx firebase deploy` after the owner ran `firebase login`.
Composite indexes: `likes(priority, createdAt)` and `matches(participants, lastMessage.at)`.
**Note:** the original `firestore.indexes.json` also declared a single-field index on
`messages.createdAt`. Firestore rejects those — single-field indexes are created
automatically — so it was removed. Only composites belong in that file.
**Still true:** the service account itself cannot deploy rules or indexes
(`scripts/deploy-rules.ts` returns PERMISSION_DENIED). Granting it *Firebase Rules
Admin* and *Cloud Datastore Index Admin* would make deploys work headlessly in CI.
**Decided by:** Owner authenticated; Claude deployed.

## 2026-08-28 — Product decisions (owner)
**Deck scope:** nationwide, with a same-city scoring bonus so local people surface
first. Rationale: referrals work remotely, but a coffee does not — this keeps the deck
full while putting people you can actually meet on top.

**LinkedIn Connect:** stubbed behind a feature flag with fixture data. It fills the
URL field, imports one education entry, and flips the label to "Imported from
LinkedIn · Refresh" exactly as spec §2 describes. Real OAuth needs an approved
LinkedIn app, which is not a same-day process; the UI does not change when it lands.

**Venues:** a seeded list of real San Francisco cafes, stored in `venues/`. No API
key, no billing, no rate limits. Google Places remains the upgrade path (BACKLOG
E10.1) and only the loader changes.

**Reply rate:** replies ÷ conversations started with you, over the last 30 days —
"of the people who messaged you first, how many did you answer". It is the trust
signal the product sells, and it does not punish a user for matches where neither
side spoke.

**Undo swipe:** cut from v1 (Claude's default, not contradicted). Revisit after the
demo.

## 2026-08-28 — Messages are server-written, not client-written
**Decision:** `firestore.rules` denies client writes to `matches/{id}/messages`.
Sending a message goes through `POST /api/matches/{id}/messages`.
**Why:** a message is really two writes — the message document and the `lastMessage`
summary the match list reads. Only the server can do both in one batch. Allowing a
client-side create would leave that summary stale and the match list wrong.
**Cost:** a message round-trips to a route handler instead of straight to Firestore.
Clients still read the thread live via `onSnapshot`, so incoming messages are instant;
only the send is server-mediated.
**Decided by:** Claude.

## 2026-08-29 — Verified end to end in a browser
Signed in as the seeded Jordan Reyes at `/signin`, landed on `/deck` with live data,
and swiped. The swipe reached Firestore as `demo-jordan__demo-028`. Chain confirmed:
Firebase JS SDK → `POST /api/auth/session` → httpOnly session cookie → route handler
→ Firestore transaction. Demo data was reseeded afterwards to clear the test swipe.

`scripts/verify-swipe.ts` covers the concurrency invariant separately: 16 checks
against the real database, including two genuinely simultaneous mutual yes swipes
producing exactly one match document.

## 2026-08-29 — Reply rate is computed on read, not incremented on write

**Decision.** `stats.replyRate` is recomputed from the messages themselves whenever
`GET /api/me` is called, and the result is cached back onto the user document.

**Why.** The alternative — incrementing a counter on every message — needs a
transaction to be safe under two people sending at once, and goes wrong permanently
if a match is closed or a message is removed. Recomputing is a handful of reads on a
demo-sized population and is always correct. The cached number stays on the document
so the deck and the card can read one field without walking every thread.

**Definition** (owner's, recorded earlier): replies ÷ conversations *started with
you*. Threads you opened yourself, and matches nobody spoke in, are excluded — they
say nothing about whether you reply. System messages from bookings count as neither
an opener nor a reply.

## 2026-08-29 — The activity feed is derived, not an events collection

**Decision.** `GET /api/activity` reconstructs events from inbox likes, match
creation, `lastMessage` and bookings. There is no `events` collection.

**Why.** An events collection would mean every existing write path had to also
append an event, which is a second thing to get right and a second thing to keep
consistent. Deriving means the feed cannot drift from the thing it describes, and
adding it changed no write path at all. If the feed ever needs read state per event,
that is the point to revisit this.

## 2026-08-29 — Prompts are free text, with neutral labels

**Decision** (owner, 2026-08-29). `p1`/`p2`/`p3` are **free text** — three short lines
the user writes themselves, not answers to a fixed question set and not a prompt
library they pick from. `PROMPT_LABELS` names them "Prompt one/two/three" for now.

**Why.** The spec names the three fields but never says what they ask. The seeded
population already stores free text in them ("The intro I wish someone had made for
me", "Coffee order"), so free text is also the reading that needs no re-seeding.
Inventing questions would have meant re-seeding the moment the mocks contradicted
them.

**Consequence.** The labels are positional, not product copy, so the mocks can rename
them without touching the schema, the fixtures, or any write path. If prompts ever
become a pick-from list, that is a new constant plus a validation rule — not a change
to the stored shape.

## 2026-08-29 — Rules are verified against the deployed project, not the emulator

**Decision.** `npm run verify:rules` signs in as throwaway users with the **client**
SDK and asserts every client-reachable path against the rules that are actually
deployed. The emulator-based rules tests in `E12.2` are not built.

**Why.** The emulator needs a JDK that is not installed on this machine, and
installing one sits outside the project folder. Two things make the live approach
better than a workaround anyway: it exercises the rules that are really in force
rather than a local copy that can drift, and it uses the same SDK a browser uses. The
cost is that it needs network and writes to the real project — mitigated by prefixing
everything `zz-rules-` and deleting it in a `finally`, verified afterwards to leave
the 42-person demo population untouched.

**What it proves** (30 checks): a signed-in stranger cannot read another person's
`private/meta`, match, messages, inbox likes or booking; nobody can write a message
from the client, so `lastMessage` cannot be made stale; no user can award themselves
a `replyRate` or publish themselves by writing `onboarding`; an unpublished user
cannot read other profiles; an unauthenticated client can read nothing at all. It
also asserts the *permits* — a published user can read another published profile —
because a rule that denies too much breaks the product just as surely.

**Still open.** Storage rules (`E12.3`) cannot be tested because Storage needs Blaze.

## 2026-08-29 — The mocks override spec section 5 on palette and type

**Decision.** Tokens come from `docs/mocks/planup-designs.html`, not from
`docs/planup.md` section 5, wherever the two disagree.

**Why.** CLAUDE.md section 2 says the mocks define the visual language, and they are
the later artefact. The disagreement is not small: the spec describes Plus Jakarta
Sans with a terracotta accent (`#a2542a`), the mock uses Inter Tight with an amber
one (`#e9b23c`). Picking the spec would mean building something the owner has
already moved on from. Both are recorded in `docs/design.md` so nobody reads section
5 later and assumes the code drifted.

**Kept from section 5 anyway:** the disabled primary button (ink at 28%, label
replaced by the validation message) and the 44px touch target. Neither appears in
the mock, both are behaviour rather than decoration, and the onboarding gates
already return that label.

**Consequence.** Fonts are self-hosted through `next/font` instead of the mock's
Google Fonts link — a PWA should not need a third-party request to render its own
type, and it removes the late-font layout shift.

## 2026-08-29 — Open: the mock is branded PlanUp, the app is Warm Intro

Not a decision yet. The mock's app bar reads **PlanUp**; the spec, the repo and
`metadata.title` read **Warm Intro**. Nothing has been renamed either way pending
the owner's answer.

## 2026-08-29 — Mock frames chosen: 1a card, 1d match moment, 1g onboarding

**Decision** (owner, 2026-08-29). The mock offers three either/or pairs. Chosen: the
**1a** deck card (photo above, body below), the **1d** match moment (dark,
coffee-first), and **1g** onboarding (one question per screen). The name stays *Warm
Intro* — the owner had no preference, so the option with no churn across the repo,
spec, metadata and seeded emails won.

**Why these.** 1a's fields all exist in the card payload, where 1b's split card needs
a per-company referral-slot count we do not store and 1c leans entirely on photo
quality we do not control. 1d matches spec section 1 — "primary action pushes to a
30-minute coffee". 1g maps one-to-one onto the five steps and per-step gates that are
already built and tested; 1f's checklist has seven rows and would have meant
regrouping either the backend steps or the design.

**Not built from the chosen frames:** the "n mutual" chip, "he's free" slot labels
and the "$16–$28" price range. Each needs data the app does not have (a connection
graph, calendar availability, venue pricing). See `docs/design.md` section 3.

## 2026-08-29 — Onboarding can fill photo slots with placeholders

**Decision.** Tapping a photo slot in step 1 assigns a deterministic placeholder URL,
labelled as such in the UI.

**Why.** Step 1's gate requires three photos and photo upload (E5) is blocked on the
Blaze plan. Without this, nobody can complete onboarding — including anyone signing
up live during the demo. The fixtures already use external placeholder URLs, so this
adds no new dependency, and E5 replaces it with a real upload when Storage exists.

## 2026-08-29 — `next dev` may not write into CLAUDE.md

**Decision.** `agentRules: false` in `next.config.ts`.

**Why.** Next.js 16 appends a `<!-- BEGIN:nextjs-agent-rules -->` block to `CLAUDE.md`
on every `next dev`. That file is the owner's working agreement (CLAUDE.md section 1),
and a build tool rewriting it means the instructions and a vendor's text become
indistinguishable — as well as a permanently dirty working tree. The block's actual
content is useful, so it is restated by hand in CLAUDE.md section 3 instead, where it
is clearly authored rather than injected.

## 2026-08-29 — `/` decides and redirects; it is not a page

**Decision.** The root route is a server component that reads the session and
redirects: signed out to `/signin`, part-way through onboarding to the saved step,
published to `/deck`. It renders no markup.

**Why.** There is nothing to show at `/` — everyone arriving is in one of those three
states, and the deployed placeholder ("Backend scaffolding. Screens land once the
mocks do.") was the first thing a visitor saw. Deciding server-side means no flash of
the wrong screen, which a client-side redirect cannot avoid.

**Consequence.** This is the only `.tsx` under `src/app` that imports from
`src/server`, so it is excluded by name from the ESLint boundary rule rather than by
an inline disable — an exclusion in the config is visible to anyone auditing the
boundary. It qualifies because it carries no `'use client'` and returns nothing.

## 2026-08-29 — API responses are `no-store`

**Decision.** The shared `route()` helper sets `Cache-Control: no-store,
must-revalidate` on every response, success and error alike.

**Why.** Two reasons, one found by accident. Every endpoint answers for one signed-in
user, so a shared proxy caching a response could hand one person's deck or chat to
another. And with no `Cache-Control` at all the browser was free to apply heuristic
caching: confirming a coffee wrote correctly to Firestore, but the refetch
immediately after was served the stale body, so the screen kept saying "Pick a time"
after the booking was confirmed. Fixing it at the helper covers every route at once
rather than per-fetch at each call site.

`/api/health` builds its own response rather than going through the helper, but sets
`no-store` too: a cached health check reports the state of a past deployment, which is
worse than no health check at all.

## 2026-08-29 — `jose` is pinned to 5.x for `jwks-rsa`

**Decision.** `package.json` carries a scoped npm override:

```json
"overrides": { "jwks-rsa": { "jose": "^5.10.0" } }
```

**Why.** The first working Vercel deploy returned a bare 500 from every server route.
The cause was module loading, not configuration:

```
ERR_REQUIRE_ESM: require() of ES Module .../jose/dist/webapi/index.js
from .../jwks-rsa/src/utils.js not supported
```

`firebase-admin` depends on `jwks-rsa`, which does a plain `require('jose')`. `jose` 6
is ESM-only — its export map has no `require` condition at all — so that call can only
work on a runtime that supports `require(esm)`. Local `next start` on Node 24 does;
the deployed function, which loads external packages through Turbopack's own module
context, does not. Same Node version, same build, different loader: the bug could not
be reproduced locally.

`jose` 5 ships both, resolving `require` to `dist/node/cjs/index.js`, and `jwks-rsa`
uses exactly two of its functions — `importJWK` and `exportSPKI` — both unchanged
between 5 and 6.

**Why scoped.** The override names `jwks-rsa` rather than pinning `jose` globally, so
the only package moved off 6 is the one that cannot load it. `@modelcontextprotocol/sdk`
(a transitive dependency of `firebase-tools`) keeps 6.

**Alternatives.** Forcing Next to bundle `firebase-admin` instead of treating it as an
external package would also avoid the shim, but `firebase-admin` loads protobuf
definitions by path at runtime and bundling it tends to break those. Pinning one
transitive dependency is the smaller change, and it can be dropped whenever `jwks-rsa`
switches to a dynamic `import()`.

**Consequence.** Remove this override and the app builds, passes every test locally,
and fails on deploy — so it must not be treated as tidy-up. The health probe's
`adminCredential: "unloadable"` exists to name this class of failure.

## 2026-08-29 — Onboarding revision: GICS taxonomy, lighter gates, no Google sign-in

**Decision.** The PM's onboarding pass, implemented as specified. The parts that were
a judgement call rather than a restatement of the requirement:

**Industries are the eleven GICS sectors, and positions hang off them.**
`src/lib/refdata/taxonomy.ts` replaces the old 30-item industry list and the flat
function list with `GICS_SECTORS` and `POSITIONS_BY_SECTOR`, the latter transcribed
from `docs/Others/GICS Positions.md`. `positionsForSectors()` is the narrowing: with
several sectors selected it returns their **union**, in sector order, deduplicated —
several sectors share a position, and a repeated cell in the grid reads as a bug.
Position labels drop the source list's explanatory parentheticals ("Finance & Treasury
(capital-intensive project funding)" is a note to the reader, not a chip label); short
acronyms that read as part of the name — HSE, FP&A — are kept.

GICS is coarse: "Information Technology" holds both a semiconductor engineer and a
SaaS salesperson. Sector level was chosen because it is what was asked for and it is
faster to fill in; industry-group level (24 groups) would match better. Revisiting
that is a data change plus a re-selection prompt for existing users.

**"Other" is one interaction everywhere, and it stays private.** Every taxonomy grid
uses one `TaxonomyField` component. An "Other" cell (or an "+ Add other" button where
the list has no Other cell) opens a text field, and what the user types is appended to
the same array as a plain string. It lives on that profile only — it does **not** join
the shared taxonomy. Writing user text back into a shared list buys a moderation and
deduplication problem ("Fintech" / "FinTech" / "fin-tech") for no v1 benefit; curating
submitted values by hand is the cheaper path.

**`industry` and `lane` are arrays now.** Both fields on the profile changed from
scalar to `string[]` (capped at `LIMITS.industries` / `LIMITS.roles`). The names are
unchanged because `industries` and `lanes` already mean "what I am looking for". Card
tags, deck filters and the fixture population were updated with them. **Existing
documents carry the old scalar values and will fail validation** — the demo population
is regenerated with `npm run seed:reset`; any real profile would need a backfill.

**A student is asked two questions.** School and graduation year, both required, both
carried over from step 1 and editable in place behind a pencil. Step 1's school list
is the single source of truth: an edit writes back to `schools[0]` rather than forking
into a second value, and only reaches it once the year is four digits, since a
part-typed year fails `schoolSchema`.

**Course type is free text.** `schoolSchema.course` was `z.enum(COURSE_TYPES)`; the
"Other" chip has to be able to store what the user typed, so it is now a trimmed
string with `COURSE_TYPES` as the offered chips.

**Doors are the current employer only.** The peer-map suggestions are gone from the
form; the door section shows the company typed above and nothing else. The fixture
generator was changed to match — a seeded person must not hold doors a real one could
not enter — which also means door overlap in the deck now means "they work where you
are targeting", which is the truer signal.

**Step 4 is no longer skippable.** Interests and "open to" are required, the bio is
not, so `canPublish` now covers steps 1 through 4 and the "Skip for now" button is
gone. The interest list is cut to sixteen.

**Complete is a light-green box, and Continue returns to the review.** The review
row's complete state uses the existing `--green-bg` / `--green-ink` tokens with a tick
alongside, so completion is not signalled by colour alone. Once every section passes,
Continue on any step goes to the review rather than the next step — which is the
"takes you back to the last view" behaviour, without a navigation flag to keep in
sync. Publishing then lands on a confirmation screen with one button into the deck.

**Google sign-in is removed from the UI, not from the codebase.** The button and its
divider are gone from `/signin`; `signInWithGoogle` stays in `auth-client` so
restoring it once the OAuth consent screen is approved is one block of JSX.

**Still open — needs the PM.**

- Years bands are labelled `0-5`, `5-10`, `10+` as specified. The boundaries overlap;
  `0-5` / `6-10` / `10+` or `<5` / `5-10` / `10+` would not.
- The sixteen interests are a reasonable spread chosen here, not a supplied list.
- "Reduce up to 16 options **and add**" — the requirement is cut off mid-sentence. The
  existing "Something else" free-text field is assumed to be what was meant.
- Multiselect caps are the existing three per field. No cap was specified.
- Target companies on "What are we looking for" were left in place and made optional;
  the requirement named the two taxonomies to keep, not the fields to delete.

## 2026-08-29 — Stored profiles are validated on read, so schema changes must be tolerant

**What broke.** The GICS revision changed `industry` and `lane` from string to
`string[]` and cut the years bands from five to three. Every profile already in
Firestore was written in the old shape. `profileSchema.parse` runs on *read* — in
`/api/me`, in `publishProfile`, in the deck loader — so all 47 documents began failing
validation the moment the change deployed: `/api/me` answered `400 Invalid request.`,
which blanked the profile and onboarding screens, and `loadDeck`'s `safeParse` quietly
dropped every candidate. Nothing failed at the write that caused it; it failed later,
on someone else's sign-in, on a screen with no connection to the change.

**Decision.** `profileSchema` coerces the old shapes rather than rejecting them: a
scalar `industry`/`lane` is lifted into a one-item array, and the retired years bands
map onto the three current ones (`0-1`/`2-3` → `0-5`, `4-6`/`7-10` → `5-10`).
Documents heal on their owner's next save.

**Why coerce rather than migrate.** A backfill script has to be run, in order, against
every environment, and a document written by an older deploy after the backfill is
still broken. Tolerance on read has no such window. The rule this establishes: **a
schema field that is validated on read may change shape only together with a
preprocessor for the shape it is replacing.**

**Landing route.** `landingRouteFor` no longer trusts `onboarding.completed` alone. A
profile published under earlier gates can stop satisfying the current ones — exactly
what happened when step 4 became mandatory — and the flag on its own dropped those
users on the deck holding a card that could no longer be published, with no route back
to fix it. The gates are re-run and the first failing step wins. Moved to
`src/lib/onboarding/landing.ts` so it is unit testable; `src/server` cannot be
imported from a test.

**`npm run doctor`.** A read-only pass over the real data: does every stored profile
still parse, where would each account land at sign-in, does each real account have
matches. Unit tests could not have caught this — they test the schema, not the rows —
and this is the check that would have. `--fix` backfills auto-matches. It exits
non-zero on a failure, so it can gate a deploy.

## 2026-08-29 — Every published account is auto-matched with 75% of the seeded people

**Decision.** On publish — and on sign-in for accounts that published before this
existed — a real account is matched with `DEMO_MATCH_SHARE` (75%) of the seeded,
published population. Half of what remains arrives as an inbound like; the rest stay
in the deck. The first five threads get an opening message.

**Why.** Chat, the likes screen and booking cannot be exercised from an empty account,
and a fresh sign-up has none of it by definition. Swiping through forty cards hoping
for a mutual before anything can be tested is not a demo.

**The share is of the whole seeded population, not of the untouched remainder.** The
first cut filtered out anyone the account had already swiped on and then took 75% of
what was left, which returned 27 of 42 for an account that had been demoed on — under
the 70% asked for, with nothing to say so. People not yet swiped on come first; someone
already passed on is pulled in only to make up the number. The rule lives in
`src/lib/matching/demo-plan.ts`, pure and unit tested, because it was wrong once.

**Safety.** Only documents carrying `seeded: true` are touched, so two real accounts
are never matched to each other. Idempotent: match ids derive from the uid pair, and a
`demoMatchedAt` marker short-circuits the common path. `DEMO_AUTO_MATCH=false` turns
it off without a code change — **it must be off before the app sees users who are not
in on the demo.**

## 2026-08-29 — "Your card is live" is a self-dismissing popup, not a screen

**Decision.** Publishing no longer replaces the page with a confirmation screen. The
confirmation is a popup over the review step (`src/components/PublishedMoment.tsx`),
it carries an animated confetti burst, and it dismisses itself after five seconds
onto the deck. "Start swiping" and Escape do the same thing sooner.

**Why.** This reverses the earlier note in the onboarding page that "the deck is one
tap away rather than automatic". The confirmation still gets its beat of celebration,
but a screen whose only job is one button is a stop the user has to clear by hand at
the exact moment the long form finally ended. Auto-dismissing keeps the celebration
and removes the chore — the tap is still there for anyone who wants it now.

**The five seconds are the timer, not the animation.** The dismissal is a
`setTimeout` held in a ref so a parent re-render cannot restart it; the progress line
under the button is decorative and the popup dismisses whether or not it ran.

**Confetti is not rendered under `prefers-reduced-motion`.** `globals.css` kills every
animation globally under that query, which would leave the pieces parked mid-air, so
the component reads the query (`useSyncExternalStore`) and renders no pieces at all.
The pieces are deterministic rather than random — same burst every time, and nothing
to reason about if this ever renders during hydration. The burst is held to the 420px
app frame so on a desktop it falls over the app rather than the board either side.

## 2026-08-29 — The chat prototype supplies structure, not colour

**Decision.** `docs/mocks/planup-chat-prototype.html` is built as the conversation
list, the thread and the booking screen. Its *layout* is followed; its palette and
type are not. The app stays on the tokens extracted from `planup-designs.html`.

**Why.** The new prototype is drawn in the palette `docs/planup.md` section 5 asks for
— Plus Jakarta Sans, terracotta `#a2542a`, ink `#17150f` — which is exactly what
`src/app/tokens.css` records as having *lost* to the first mock. Adopting it would
restyle every screen in the app, not just chat, so the owner was asked and chose to
keep the current tokens. If a later mock lands in the same palette, that is the moment
to revisit the whole token set rather than let chat drift on its own.

**The bundle is committed with an unpacked copy.** The mock ships as a self-extracting
page that stores its real markup as JSON inside a `<script type="__bundler/template">`
tag; `planup-chat-prototype.unpacked.html` is that markup, so the design can be read
and diffed without running the page.

**What the mock asks for and the app does not do** is listed in `docs/design.md`
section 5. The short version: no venue prices, no video/in-person toggle, no OpenTable,
no payment. The booking flow stays propose-then-accept and free, and the confirmed card
links to the booking screen rather than offering a calendar export that does not exist.
Same rule as the match moment's missing price range — a control that changes nothing is
a promise the app cannot keep.

**`loadThread` now returns the booking and the match date.** The thread previously knew
only *that* something was booked; the confirmed card needs when and where, and the
"You matched Aug 26" note needs the match's `createdAt`.

## 2026-08-29 — Deck tags, real filters, and reply chips that fill the composer

**The deck card's corners.** Top-left is the college, top-right is what the person
will actually do — `helpTagFor()` reads the per-company answers from step 2 and a
single "Happy to refer" outranks any number of "Happy to chat", because a referral is
the stronger offer. The direction badge ("Open both ways") moves off the photo into
the body, and is dropped entirely when it would repeat the help tag: "Can refer" twice
on one card reads as a bug.

**Filters are real, and only offer what the deck can apply.** Every group in the sheet
maps to a filter `passesFilters()` already implements — industry, role, location,
direction — plus `colleges`, added here. Nothing is offered that would not narrow the
deck. College matching is deliberately loose (substring, both directions) because
people type "Michigan" for "University of Michigan", and a filter nobody can satisfy is
worse than one that is slightly generous. There is no college directory, so the mock's
fixed list is replaced by its own "+ Add new" half: you type a school and it becomes a
chip. Roles stay scoped to the chosen industries, as they are in onboarding.

**A suggestion is now a label plus a message, and it fills the composer.** `Suggestion`
carries `short` (three or four words, what the chip says) and `text` (the whole
sentence). Tapping a chip puts the sentence in the composer and focuses it rather than
sending — the point of a suggestion is that you read it, change a word and own it
before it goes. `headlineFor()` names the rule that produced the set, so the row says
why these three. The rules themselves were already contextual; only the presentation
changed. The mock's headline is gendered ("he asked about your work"); ours is not.

**Profile.** The mock's "Edit profile" and "Log out" are 11px text links. The owner
asked for CTAs, so they are a filled primary and a bordered secondary. Editing
re-enters onboarding rather than duplicating every field on a second screen. Logging
out clears both halves — the session cookie the server trusts and the client SDK the
chat's realtime listener uses — since leaving either behind logs you out of half the
app.

**Confetti.** Seventy pieces over three sizes, everything landing inside three
seconds. The first pass was too thin to read as a celebration.

## 2026-08-29 — College dropdown, and the direction badge drops entirely

**The direction badge is gone from the deck card, not just deduplicated.** The owner's
follow-up mock (`PlanUp - Activity.html`) never shows a third line under the photo —
only the college and help-tag pills at the top. The previous rule (drop the badge when
it repeats the help tag) still left "Open both ways" showing whenever direction was
`both` and the help tag said something else, which is exactly the case the owner
flagged. `card.badge` stays on the `Card` type — the onboarding step-5 preview still
shows it — only `SwipeCard` stopped rendering it.

**The College filter is now a collapsible "Any school" dropdown**, matching the mock's
interaction (`collegeOpen` / `addingCollege` states) rather than always-visible chips.
Since there is still no college directory, the checkbox rows are exactly the colleges
already added — unchecking one removes it — and "+ Add new" is the only way onto the
list, same deviation as before, new presentation.

**"Any college" joins the summary row above the deck**, alongside "Any industry", "Any
role" and "Nationwide" — it was the one group `filterSummary()` only showed once
non-empty, which is why the owner's screenshot of the row never had it.

## 2026-08-30 — First-run tour, spotlight sized to a real screen not the mock's frame

**Built `TipsTour` from `PlanUp - Quick Tips.html`'s three-step tour** (the card,
Filters, then the swipe row) as a spotlight ring over the real element plus a bottom
sheet, not a callout beside it. The mock's callout sits next to the spot with a
pointing arrow, sized to fit the gap its fixed 382×812 frame leaves; step 1's spot is
the whole deck card, which on a real phone can run edge to edge and leaves no such
gap — a callout that hugs the spot has nowhere to go. A bottom sheet (the same pattern
Filters and Activity already use) sidesteps the problem entirely: the spotlight still
points at the right element regardless of its size, and the sheet never fights it for
space.

**Storage is `localStorage`, not a profile field.** There is no per-account "seen the
tour" flag, and adding one for a three-step tooltip is more state than the feature is
worth — a blocked store (private browsing) just counts as seen rather than nagging
every load. "Replay quick tips" on the profile screen (the mock's unwired link) sends
`/deck?tips=1`, which forces the tour open regardless of the stored flag.

**The measurement effect defers via `setTimeout`, not `requestAnimationFrame`.**
`rAF` never fires while a tab is backgrounded — confirmed while building this, in the
Claude Code browser pane itself — so a rAF-deferred `setRect` can hang indefinitely.
`setTimeout(fn, 0)` still satisfies the same "don't call setState synchronously inside
the effect body" rule without depending on the tab being visible. Relatedly, the ref
lookup table passed to `TipsTour` is now `useMemo`'d in the deck page — an unmemoized
object literal was retriggering the measurement effect on every unrelated re-render.

## 2026-08-30 — Video call joins in person; the mock's payment claims still do not

**`bookingSchema` gained a real `mode` field** (`'in_person' | 'video'`), and `venue`
is now nullable rather than always required. This was the one item from the earlier
"not built" list (2026-08-29 chat entry) that was a genuine gap rather than a promise
the app cannot keep — a toggle that only picked a mode and stored it is real, unlike
one that claimed to hold a table. Proposing a video call skips venue selection
entirely on the booking screen; every place that read `booking.venue.name` (the
confirmed card, the activity feed, the system messages) now branches on it being null
instead.

**Prices, "for two", and the OpenTable payment flow are still not built.** The owner
confirmed (asked directly, given the mock shows "$24 paid by you" in the chat and "You
pay $24 now to hold the table") that the visuals should be matched without the charge:
no price anywhere, and the CTAs read "Propose these times" / "Confirm this time" —
never a claim that money moved. `venueSchema` still carries no pricing.

**The confirmed-coffee card gets its two actions back: "Add to calendar" and
"Reschedule."** The earlier entry deferred both because building only one of the
mock's two actions read as arbitrary. "Add to calendar" opens a prefilled Google
Calendar link — no .ics export, but a genuine calendar event once added, built in
`src/lib/booking/calendar.ts`. "Reschedule" cancels the booking through the existing
state machine and pushes straight to the propose screen, rather than just linking to
"see the details" as before.

## 2026-08-30 — The seeded population likes you; it no longer matches you

**`DEMO_MATCH_SHARE` (0.75 mutual matches) becomes `DEMO_LIKE_SHARE` (0.70 inbound
likes), and no match is seeded at all.** Asked which of three readings of "70% must
have liked this new user" was meant, the owner chose this one: 70% of the seeded,
published population has an inbound like waiting, and nothing else.

The old mode handed a fresh account roughly thirty finished threads, five of them
carrying an opening line it had never done anything to earn. That fills the chat list
but it is the wrong demo — the deck, the swipe, and the match moment are the product,
and they had already happened offscreen before the user arrived. Now the Likes screen
is full on arrival and chat is empty, and the first right-swipe fills it.

**This works only because of two existing behaviours, both verified before the
change.** `recordSwipe` reads the counter-swipe inside its transaction and creates the
match when it finds a `yes` or `priority`, so the seeded swipe behind each like makes
the account's first right-swipe an immediate match through exactly the path a real
match takes (`src/server/swipes/record-swipe.ts`). And `excludedUids` filters the deck
on the viewer's *own* swipes, never on inbound ones, so everyone who liked the account
is still in the deck to be swiped (`src/server/deck/load-deck.ts`). Neither needed
changing; if either is ever reworked, this mode breaks quietly.

**Likes are only ever manufactured from people the account has never swiped on.** The
old plan topped its number up from people already swiped on, which was harmless when
it wrote a match document alongside. It is not harmless now: writing a like from
someone the account already said yes to produces a mutual yes with no match, a state
`recordSwipe` never creates and nothing knows how to repair, and writing one from
someone it passed on resurrects a dismissed card. So an account part-way through its
deck gets fewer than 70%, and that is the honest number — the alternative is
manufacturing the matches this change exists to stop making.

**`npm run doctor` now measures likes, counting `likes + matches`.** An account that
has worked through part of its Likes screen has consumed those likes into matches,
which is the intended direction of travel, so the sum is the coverage number rather
than the likes alone.
