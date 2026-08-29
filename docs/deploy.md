# Going live on Vercel

Run [`docs/pre-deploy.md`](pre-deploy.md) first. This is the runbook for the deploy
itself (BACKLOG `E14.1`).

There are two routes. **A** is faster and needs no GitHub repo — take it for the
build-a-thon. **B** adds per-branch preview deploys and is worth doing afterwards.

---

## Route A — Vercel CLI (about ten minutes)

### 1. Install and sign in

```bash
npm i -g vercel
```

```bash
vercel login
```

It opens a browser. Any account works; a personal Hobby account is free and enough.

### 2. Link this folder to a new project

From `C:\Users\sjlar\Tetef\Nexus`:

```bash
vercel link
```

Answer: set up a new project, scope = your personal account, name = `warm-intro`,
directory = `./`. Do **not** override the build settings — Next.js is detected and
the defaults are correct.

This writes `.vercel/` locally, which is git-ignored.

### 3. Add the environment variables

**Fastest way: the dashboard.** Open the project → **Settings → Environment
Variables**. The form accepts a pasted `.env` blob, so open `.env.local`, copy all of
it, paste, and apply it to **Production, Preview and Development**.

Eight variables, all required:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_USE_EMULATORS
FIREBASE_SERVICE_ACCOUNT_B64
```

Two that go wrong:

- `NEXT_PUBLIC_USE_EMULATORS` must be **`false`**. If it is `true`, the browser tries
  to reach emulators that do not exist on Vercel and every screen hangs.
- `FIREBASE_SERVICE_ACCOUNT_B64` must **not** gain a `NEXT_PUBLIC_` prefix. That
  prefix ships a value to the browser, and this one is full admin access to the
  Firebase project. It is also a single long line — check it pasted without a line
  break in the middle.

### 4. Deploy

```bash
vercel --prod
```

The URL it prints is the live app.

### 5. Let Firebase trust the new domain

Firebase console → **Authentication → Settings → Authorised domains → Add domain**,
and add the Vercel hostname (`warm-intro-xxxx.vercel.app`, no `https://`, no
trailing slash).

Skip this and email sign-in still works, but **Google sign-in fails** with
`auth/unauthorized-domain` — and the error only appears after the popup closes, so it
reads like a bug rather than a setting.

---

## Route B — GitHub, for preview deploys per branch

Do this after the app is live if you want a fresh URL for every branch.

1. Create an empty repo at `github.com/sjlarrain/warm-intro` — **no** README,
   `.gitignore` or licence, so the first push is clean.
2. Then, from the project folder:

   ```bash
   git remote add origin https://github.com/sjlarrain/warm-intro.git
   ```

   ```bash
   git push -u origin master
   ```

3. In Vercel: **Settings → Git → Connect Git Repository**, pick the repo.

Vercel treats the repo's default branch as production. This project's branch is
`master`, so either keep that as the default in GitHub or rename it to `main` first —
otherwise pushes deploy to preview and never to production.

**Before the first push**, confirm no secret is tracked:

```bash
git ls-files | grep -iE "env.local|adminsdk|service-?account"
```

That must print nothing. `.env.local` and any service-account JSON are git-ignored,
and the patterns were widened in `.gitignore` after an early near-miss
(`docs/decisions.md`).

---

## After it is live

Check these in order — each one failing points somewhere different:

| Check                                               | If it fails                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `https://<domain>/api/health` returns `{"ok":true}` | The build or the deploy itself                                       |
| The sign-in screen renders with fonts and styling   | Static assets or the build output                                    |
| Email sign-in works                                 | `FIREBASE_SERVICE_ACCOUNT_B64`, or the admin SDK failing to parse it |
| Google sign-in works                                | Authorised domains, step 5                                           |
| The deck shows people                               | Firestore rules, or the `NEXT_PUBLIC_*` client config                |
| A message sends and appears                         | Route handler plus the realtime listener                             |

Vercel logs live under the project's **Logs** tab. There is no error tracking yet
(`E14.3`), so that tab is the only place a server-side failure shows up.

## Rolling back

Vercel keeps every deployment. Project → **Deployments** → pick the last good one →
**Promote to Production**. Faster than fixing forward while people are watching.

## What does not change on deploy

Firestore rules and indexes live in the Firebase project, not in Vercel, and are
already deployed. They are shared with local development — **the deployed app and
your laptop talk to the same database**. There is no separate production data, so a
demo on the live URL and a demo on localhost affect each other, and
`npm run seed:reset` resets both.
