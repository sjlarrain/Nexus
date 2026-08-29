# Pre-deploy checklist

Run before the first Vercel deploy, and before any deploy that matters.

## Green as of 2026-08-29

| Check                   | Command                             | Result                                   |
| ----------------------- | ----------------------------------- | ---------------------------------------- |
| Types                   | `npm run typecheck`                 | clean                                    |
| Lint                    | `npm run lint`                      | clean                                    |
| Unit tests              | `npm test`                          | 144 passed                               |
| Production build        | `npx next build`                    | 25 routes, no errors                     |
| Production server       | `npx next start`                    | sign-in, session cookie and all APIs 200 |
| Deployed security rules | `npm run verify:rules`              | 30 passed                                |
| Swipe concurrency       | `npm run verify:swipe`              | 16 passed                                |
| Secrets                 | `git ls-files .env.local`           | not tracked                              |
| Env parity              | every `process.env.*` the app reads | all 8 in `.env.example`                  |

## What Vercel needs

`.env.local` does not travel. Set these in **Project Settings → Environment
Variables**, for every environment that should work:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_USE_EMULATORS      → false
FIREBASE_SERVICE_ACCOUNT_B64   → the base64 blob, server-side only
```

`FIREBASE_SERVICE_ACCOUNT_B64` grants full admin access to the project. It must not
be prefixed `NEXT_PUBLIC_`, or it ships to the browser.

## Then, in the Firebase console

**Authentication → Settings → Authorised domains**: add the Vercel domain. Google
sign-in fails with `auth/unauthorized-domain` until you do, and the error surfaces
only after the popup closes — easy to misread as a code problem.

## Known behaviour worth not being surprised by

**The session cookie is `Secure` in production** ([session.ts](../src/server/auth/session.ts)):

```ts
secure: process.env.NODE_ENV === 'production';
```

That is correct for Vercel, which is HTTPS. Two consequences locally:

- A **production build served over a plain-HTTP LAN address** (`http://10.x.x.x:3100`)
  cannot sign in. The browser drops the `Secure` cookie, the redirect still happens,
  and `/api/me` then returns 401 — it looks like a broken login rather than a cookie
  policy. Confirmed by testing, not theory.
- `http://localhost` is exempt: browsers treat it as a secure context, so local
  production testing on localhost works normally.
- **Phone testing over the LAN therefore needs `npm run dev`**, where `NODE_ENV` is
  not `production` and the cookie is not marked `Secure`.

## Not covered by any of the above

- No error tracking or structured logs yet (`E14.3`), so a production failure is
  only visible in Vercel's function logs.
- No smoke test against a preview deploy (`E14.5`).
- No CI (`E0.6`) — nothing runs these checks except a person.
