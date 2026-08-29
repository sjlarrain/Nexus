# Warm Intro

Swipe-based professional referrals. Two-way matching, chat with adaptive reply
suggestions, and a 30-minute coffee booked inside the thread.

Spec: [`docs/planup.md`](docs/planup.md) · Architecture:
[`docs/architecture.md`](docs/architecture.md) · Scope:
[`BACKLOG.md`](BACKLOG.md) · Working rules: [`CLAUDE.md`](CLAUDE.md)

---

## Stack

TypeScript (strict) · Next.js App Router · Firebase Auth, Firestore and Storage ·
Zod for every entity · Vitest · Vercel.

Privileged logic runs in Next.js route handlers with `firebase-admin`. There are no
Cloud Functions — see [`docs/decisions.md`](docs/decisions.md).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run check:firebase       # confirms the project is reachable
```

`.env.local` holds the Firebase web config and `FIREBASE_SERVICE_ACCOUNT_B64`, a
base64 service-account key. It is git-ignored and the key is never a file on disk.

## Running

```bash
npm run dev
```

Sign in at `/signin`. The seeded demo account is `jordan.reyes@warmintro.test`
(password `warmintro-demo`, also printed on the sign-in screen).

The dev server listens on the local network too, so the same URL with this machine's
IP opens on a phone. Worth doing — this is a mobile-first PWA built for a 375px
viewport.

[`docs/demo-script.md`](docs/demo-script.md) is a click-by-click walkthrough of what
to show and what each step proves.

## Seeding the demo population

The demo lives or dies on the deck feeling full, so the fixtures are deterministic:
the same seed always produces the same 42 people, the same inbound likes, and the
same three conversations.

```bash
npm run seed         # add the population
npm run seed:reset   # wipe and rebuild from scratch
npm run demo:deck    # print the ranked deck with score explanations
```

Roughly half the population clusters in San Francisco, New York, Austin and Seattle
so the deck's same-city bonus is actually visible.

## Tests

```bash
npm run typecheck
npm run lint
npm test             # unit tests
npm run verify:swipe # checks the swipe and match invariants against the live project
npm run verify:rules # checks the deployed security rules, path by path
```

`npm test` covers the pure logic: profile gates, deck ranking, reply suggestions,
cafe detection, match ids, reply rate and the activity feed. `verify:swipe` runs
against real Firestore, because mutual-match detection is a concurrency property and
a mock would not prove it.

`verify:rules` is the one to run before showing this to anyone. It signs in as
throwaway users with the client SDK — the same path a browser takes — and asserts what
each of them can and cannot reach: a stranger cannot read your chat, nobody writes a
message from the client, and no one can award themselves a reply rate. Both verify
scripts clean up after themselves, including on failure.

## Deploying

Rules and indexes:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

The app itself is not deployed yet (`E14.1`).
[`docs/pre-deploy.md`](docs/pre-deploy.md) lists the checks, the environment
variables Vercel needs, and the one cookie behaviour worth knowing about first.

## Layout

```
docs/              spec, architecture, decision log
src/app/           routes: pages and route handlers
src/lib/           domain logic, framework-free, unit-tested
src/lib/schemas/   Zod schemas — the single definition of every entity
src/server/        admin SDK and privileged services; never imported by client code
firestore.rules    authorization
scripts/           seeding, verification, deploy helpers
tests/             unit tests
```

Two rules worth knowing before editing: nothing under `src/server/` may be imported
by a client component (ESLint enforces it), and types are derived from Zod schemas
with `z.infer` rather than written twice.

## Design

The UI is deliberately unstyled. The visual language arrives as HTML mocks, which
land in `docs/mocks/` and get turned into tokens before any component work begins.
Every page in the app today is a shell that exists to exercise the backend.
