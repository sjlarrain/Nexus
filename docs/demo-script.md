# Running and reviewing the demo

## Start it

```bash
npm run dev
```

Then open **http://localhost:3000**. The dev server also listens on the local
network, so the same machine's IP works from a phone on the same wifi — worth doing,
because this is a mobile-first PWA and the layout is built for a 375px viewport.

Sign in as:

```
jordan.reyes@warmintro.test
warmintro-demo
```

Those credentials are printed at the bottom of the sign-in screen too, so nobody has
to read them out on the day.

## Reset to a known-good state

Every fixture is deterministic — the same seed always produces the same 42 people,
the same six inbound likes and the same three conversations.

```bash
npm run seed:reset
```

Run this before demoing. It takes a few seconds and undoes any swiping, messaging or
booking done while poking around.

## The walkthrough

Each step shows one thing worth pointing at.

| #   | Where                   | What to do                                 | What it proves                                                                   |
| --- | ----------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | `/deck`                 | Drag a card right, left, then up           | Real thresholds from the spec: dx ±105, dy −110. Up is a priority ask            |
| 2   | `/deck`                 | Tap **Activity**                           | Feed derived from likes, matches and bookings — no events collection             |
| 3   | `/deck`                 | Look at the ranking order                  | San Francisco people first: same-city bonus, explainable via `npm run demo:deck` |
| 4   | `/likes`                | Note the amber **Priority ask** at the top | A swipe-up sorts above ordinary likes                                            |
| 5   | `/likes`                | Tap **Yes back**                           | Instant match, because they already said yes. The coffee sheet opens             |
| 6   | Match sheet             | Pick a slot, tap **Pick a café**           | Spec §1: the primary action pushes to a 30-minute coffee. The slot carries over  |
| 7   | `/chat` → Daniel Okafor | Read the green bar                         | Café detection: "Sightglass Coffee came up in this chat"                         |
| 8   | Daniel's thread         | Look at the amber suggestion               | Rule 1 of `suggest()` — the café-specific reply is pinned first                  |
| 9   | Tap that suggestion     | It sends and the thread updates            | Messages are server-written so `lastMessage` cannot go stale                     |
| 10  | Coffee screen           | Sightglass is first, tagged                | "Mentioned in your chat" — the same detection the chat bar uses                  |
| 11  | Propose the times       | Go back to the thread                      | A system message appears and the suggestions switch to the post-booking set      |
| 12  | `/profile`              | Reply rate                                 | Replies ÷ conversations _started with you_ — computed from real messages         |
| 13  | `/onboarding/2`         | Change the mode                            | Different fields expand per mode; Continue names what is still missing           |

## Checks worth running in front of a sceptic

```bash
npm run verify:rules
```

Thirty checks against the **deployed** security rules, using real client sessions: a
stranger cannot read your chat, nobody writes a message from the client, and no user
can award themselves a reply rate. It cleans up after itself.

```bash
npm run verify:swipe
```

Sixteen checks proving mutual-match detection holds when two people swipe at the same
instant — run against the real database, because a mock cannot prove a concurrency
property.

```bash
npm test
```

144 unit tests over the pure logic: gates, ranking, suggestions, café detection,
match ids, reply rate, activity feed.

## Known gaps, if asked

- **Filters** on the deck are display-only; the sheet is not built.
- **Photo upload** needs Firebase Storage (Blaze). Onboarding fills slots with
  labelled placeholders so the flow completes.
- **Report / block** is not built — a blocked person would still appear in the deck.
- Nothing is deployed yet, so this runs from a laptop.
