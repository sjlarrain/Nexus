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
