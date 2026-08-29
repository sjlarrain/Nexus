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
