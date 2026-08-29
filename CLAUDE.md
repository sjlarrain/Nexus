# CLAUDE.md — Warm Intro (Nexus)

Operating instructions for Claude Code in this repository. Read this file at the
start of every session, together with the memory index at
`~/.claude/projects/C--Users-sjlar-Tetef-Nexus/memory/MEMORY.md`.

---

## 1. Working agreement (from the owner — non-negotiable)

1. **Follow the instructions, always.** If an instruction here conflicts with a
   convenient shortcut, the instruction wins.
2. **Commits are concise.** Imperative mood, one line, optional short body.
   **No `Co-Authored-By` trailer, no "Generated with" footer.** The owner does not
   want AI attribution in the history.
3. **Commit on every meaningful contribution.** Do not batch a day of work into one
   commit; do not commit half-broken scaffolding either. One coherent change = one
   commit.
4. **Memory.** Persist durable facts to the memory directory above. Start each
   session by reading it.
5. **Dependencies.** Installing what the project needs is pre-approved. Reading
   `.env` is pre-approved. Take ordinary technical decisions autonomously; escalate
   decisions that are expensive to reverse (data model shape, auth provider, hosting
   topology, paid services, anything that changes product behaviour).
6. **Ask when unclear.** Do not guess on ambiguous product requirements — ask, and
   record the answer in `docs/decisions.md`.
7. **Never `git push` without an explicit instruction to push in that session.**
   Committing locally is always fine.
8. **Stay inside `C:\Users\sjlar\Tetef\Nexus`.** No reads or writes outside this
   folder except the memory directory named above. No fetching external repos or
   files unless told to.
9. **Document everything for your future self.** Any non-obvious decision goes in
   `docs/`. Any convention goes here.

## 2. Design freeze

**Do not build UI design yet.** HTML mocks are coming from the owner and will define
the visual language (`docs/planup.md` §5 is the summary of it). Until those arrive:

- Build data model, API surface, security rules, business logic, and tests.
- Pages/components may be created as unstyled or minimally styled shells purely to
  exercise the backend — never invent a visual design, never pick colours/spacing
  beyond what §5 already states.
- When mocks land, they go in `docs/mocks/` and the design system is extracted into
  tokens before any component work.

## 3. Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| App | Next.js (App Router) |
| Hosting | Vercel |
| Auth | Firebase Auth (Google + email) |
| Database | Cloud Firestore |
| File storage | Firebase Storage (profile photos) |
| Privileged server logic | Next.js Route Handlers / Server Actions using firebase-admin |
| Validation | Zod schemas shared between client and server |
| Local dev | Firebase Emulator Suite |

Rationale and alternatives: `docs/architecture.md`.

## 4. Repository conventions

```
docs/            product + technical documentation (planup.md is the source of truth)
docs/decisions.md  running decision log (ADR-lite, append-only)
docs/mocks/      HTML mocks from the owner (once delivered)
src/app/         Next.js routes (UI + route handlers)
src/lib/         domain logic, framework-free where possible
src/lib/schemas/ Zod schemas = the single definition of every entity
src/lib/firebase/  client SDK init
src/server/      admin SDK, privileged services, never imported by client code
firestore.rules  authorization lives here, not only in the app layer
tests/           unit + rules + integration tests
```

- **Never** import anything from `src/server/` into a client component.
- Every Firestore write path that a client can reach must be covered by a rules test.
- Types are derived from Zod schemas (`z.infer`), not hand-written twice.
- No `any`. No non-null `!` without a comment explaining the invariant.

## 5. Commit style

```
add swipe write path and mutual-match detection
```

- lowercase, imperative, ≤ 72 chars, no trailing period
- body only when the "why" is not obvious
- no attribution trailers of any kind

## 6. Definition of done for a backlog item

1. Zod schema + types exist for any new entity.
2. Server logic has unit tests; client-reachable Firestore paths have rules tests.
3. `npm run typecheck` and `npm run lint` pass.
4. `BACKLOG.md` checkbox ticked, decisions logged.
5. Committed.

## 7. Secrets

`.env.local` is git-ignored and holds real values; `.env.example` is committed with
keys and empty values. Service-account JSON is never committed — it lives in an env
var. Never print a secret value into the transcript or a file.
