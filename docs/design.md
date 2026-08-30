# Design system

Source: [`mocks/planup-designs.html`](mocks/planup-designs.html), delivered
2026-08-29. Tokens extracted to [`src/app/tokens.css`](../src/app/tokens.css);
base layer in [`src/app/globals.css`](../src/app/globals.css).

**Rule:** no raw hex, font stack, radius or shadow outside `tokens.css`.
Component styles live with their component, not in `globals.css`.

---

## 1. What the mock is

Seven frames on one board, and three of the pairs are **alternatives, not a
sequence** — the mock is a set of choices to make, not a single design to build:

| Frame | What it is |
| --- | --- |
| `1a` | Working phone prototype: deck, filters, tab bar, swipe animation |
| `1b` | Card layout **option A** — split card, offer vs ask side by side |
| `1c` | Card layout **option B** — full-bleed photo, editorial overlay |
| `1d` | Match moment **option A** — dark sheet, coffee-first, slot picker |
| `1e` | Match moment **option B** — light sheet, message-first, prompted openers |
| `1f` | Onboarding **option A** — checklist of prompt cards, progress bar |
| `1g` | Onboarding **option B** — one question per screen, conversational |

`1a` contains a third card layout of its own (photo on top, body below), which is
what the working prototype actually swipes.

## 2. Tokens against the spec

`docs/planup.md` §5 describes a different palette and typeface from the one the mock
uses. `CLAUDE.md` §2 says the mocks define the visual language, so **the mock wins**
and the spec's §5 colours are treated as superseded.

| | Spec §5 | Mock | Using |
| --- | --- | --- | --- |
| Display type | Plus Jakarta Sans | Inter Tight | Mock |
| Body type | Plus Jakarta Sans | Inter | Mock |
| Mono | IBM Plex Mono | IBM Plex Mono | Agreed |
| Ink | `#17150f` | `#14120f` | Mock |
| Accent | `#a2542a` terracotta | `#e9b23c` amber | Mock |
| Wash | `#f6f4f0` | `#faf9f6` / `#eae8e3` | Mock |
| Success | `#2f7d5e` | `#3f6b4a` | Mock |
| Card radius | 16px | 16px | Agreed |
| Primary button | ink fill, white text | ink fill, white text | Agreed |

Two §5 rules the mock never shows are kept, because they are behaviour rather than
decoration and the gate logic already produces them:

- **Disabled primary button** = ink at 28% opacity, and the label becomes the
  validation message. `gateForStep()` already returns exactly that label (E3.2).
- **Minimum touch target** 44px.

Fonts are self-hosted via `next/font` rather than linked from Google as the mock
does: a PWA should not need a third-party request to render its own type, and
`next/font` removes the late-font layout shift.

## 3. What the mock shows that the backend cannot yet supply

Found by reading the mock against the schemas. Each needs a decision: build the
data, fake it visibly, or drop the element.

| In the mock | Status | Note |
| --- | --- | --- |
| "2 mutual" / "4 mutual" chip | **No data** | Needs a connection graph. LinkedIn is stubbed, so this is fabricated or dropped |
| "3 slots this quarter" | **No data** | `will` records "Happy to refer" / "Happy to chat", not a count |
| "he's free" on a time slot | **No data** | Implies calendar availability; booking has none |
| "Video instead" as a slot | **Model change** | A booking currently requires a venue |
| "Pick a café → $16–$28" | **No data** | Venue schema has no price band |
| "Verify work email" step | **Not built** | Not in the 5-step onboarding |
| "3 of 7 done" | **Mismatch** | Onboarding is 5 steps, the mock checklist has 7 rows |
| "Any school" filter | **Not built** | Filters are industry, role, location, direction |
| "9 yrs" in the role line | **Format only** | `years` is a band ("4-6"); needs rendering |
| School as a card chip | **Format only** | `tagsFor()` uses industry + lanes + interests |
| "He replies to 9 in 10 matches" | **Have it** | This is `replyRate` (E11.2) |
| Photo stepper, 3 photos | **Have it** | Three fixed slots (E5 is upload only) |
| Tabs: Explore / Likes / Chats / Profile | **Have it** | `/deck` `/likes` `/chat` `/profile` |
| Drag right / left / up | **Have it** | `yes` / `no` / `priority` |

## 5. The chat prototype (docs/mocks/planup-chat-prototype.html)

A second mock, delivered as a self-unpacking bundle; `…unpacked.html` beside it is the
readable template extracted from it, because the bundle stores the page as JSON inside
a script tag and cannot be read or diffed as-is.

It is drawn in the palette section 2 of this file records as the *spec's*, not the
first mock's — Plus Jakarta Sans, `#17150f` ink, `#a2542a` terracotta, `#2f7d5e`
success. The app stays on the tokens extracted from `planup-designs.html`; the chat
screens take this mock's structure and the app's colours (owner's call, logged in
`docs/decisions.md`).

| Element | Status | Why |
| --- | --- | --- |
| Café price, "for two" | **No data** | Same gap as mock 1d: `venueSchema` has no price band |
| "Video call / In person" toggle | **Model change** | `bookingSchema` has no mode; a toggle that changed nothing would misdescribe what was booked |
| "table held via OpenTable" | **Not built** | No OpenTable integration |
| Pay CTA, refunds, cancellation window | **Not built** | No payment provider; booking is propose-then-accept and free |
| "Add to calendar" on the confirmed card | **Not built** | No calendar export; the card links to the booking screen instead |
| Café thumbnails | **Format only** | Venues carry no photo, so the hatch placeholder stands in |
| Short chip labels for openers | **Format only** | `suggest()` returns the sentence it will send; a shorter label would hide what gets sent |
| Conversations list, thread, composer | **Have it** | Built |
| Confirmed-coffee card in the thread | **Have it** | `loadThread` now returns the booking |
| Slot list, café list, café search | **Have it** | Booking screen |

## 4. Naming

The mock is branded **PlanUp**; the app, spec title and `metadata.title` say **Warm
Intro**. Unresolved — see `docs/decisions.md`.
