# Warm Intro — Developer Handoff

Swipe-based professional referral app (US market). Two-way matching, chat with
adaptive reply suggestions, in-app coffee-chat booking. Prototype:
`Warm Intro.dc.html` (single file, React-backed template + logic class).

Demo data: viewer is Jordan Reyes (Product Designer, Figma). Primary counterpart is
Daniel Okafor (Senior PM, DoorDash).

---

## 1. Screens

| Screen | Behaviour |
| --- | --- |
| Deck | Card drag: right = interested, left = pass, up = priority ask (lands at top of their Likes). Thresholds: dx > 105 yes, dx < −105 no, dy < −110 up. Filters sheet + activity feed. |
| Likes | People who already said yes. Saying yes back matches instantly. |
| Match moment | Mutual-yes screen; primary action pushes to a 30-minute coffee. |
| Chat | Message list + suggested replies. Nobody can message before a mutual yes. |
| Coffee booking | Three nearby venues, manual search below, two time slots. A café named in the chat pins to the top tagged "Mentioned in your chat". |
| Profile | Card preview, reply rate, editable prompts, entry to onboarding. |
| Onboarding | 5 steps + auth screen (step 0). |

### Suggested replies

`suggest()` picks a set based on conversation state, in this order:

1. Café named in the thread and not yet booked → café-specific suggestion pinned first.
2. Booked → post-booking prep suggestions.
3. No messages → three openers.
4. Last message is yours → strengthen-the-ask suggestions.
5. Keyword match on their last message: meeting intent / work + portfolio /
   referral + loop → matching set.
6. Fallback generic set.

---

## 2. Onboarding

Step 0 is auth (Google / email). Steps 1–5 below. Progress bar + "n of 5" +
"Save & exit" persist in the header.

### Step 1 — Who are you?

- 3 photos (all required), labelled headshot / at work / off the clock.
- First name, last name, headline (counter, 80 char soft cap).
- Location: **State** dropdown → **City** dropdown (city list depends on state; city
  value stored as "City, ST"). Changing state clears city.
- LinkedIn: a Connect row above the URL field. Connecting fills the URL and imports
  the education entry; label flips to "Imported from LinkedIn · Refresh".
- Education (optional, up to 3): one row per school — school name + "MBA Class of
  2028" + × to remove. The add form is hidden behind "+ Add new school" and holds
  course chips (Undergraduate, MBA, MSBA, MS, PhD, Other), college, batch year, then
  Cancel / Save school.

### Step 2 — Where are you today?

Three mutually exclusive CTAs: **Working**, **Student**, **Looking out**. Only the
relevant questions expand.

| Mode | Fields | Option groups | Doors card |
| --- | --- | --- | --- |
| Working | Company, Title | Industry, Function, Years | Yes |
| Student | (none if step-1 school exists — shows it read-only with Edit; otherwise School + Graduating) | Function, Industry (optional) | No |
| Looking out | Most recent company, Most recent title | Function, Industry, Years | Yes |

**Doors card ("Where you can open a door")**: company chips suggested from the
current employer via a peer map (e.g. Figma → Notion, Canva, Adobe, Linear,
Airtable; fallback list otherwise), plus an add-your-own field. Each selected
company gets a "How you can help" row: *Happy to refer* / *Happy to chat*.

### Step 3 — What are you looking for?

- Industries you want intros in (max 3).
- Roles you are targeting (max 3).
- Target companies — suggested from the current employer, with "Add a company we
  missed".

### Step 4 — A little color (skippable)

- What you are into (max 6) with a custom hobby field that adds a chip.
- You are open to (any of: Referrals, Mock interviews, Resume review, Career advice,
  Industry intel, Cofounder chat).
- Short bio (300 char counter).
- "Skip for now" advances without filling anything.

### Step 5 — Review your card

Live card preview (badge, name, role line, headline, tags) plus four tap-to-edit
summary rows with Complete / Needs work / Skipped status. Publishing lands the user
on the swipe deck.

---

## 3. Validation / gating

The Continue button is disabled until the step's gate passes, and its label states
what is missing.

| Step | Required |
| --- | --- |
| 1 | 3 photos, non-empty headline, a city |
| 2 — Working | Company, Title, Industry, Years, ≥1 door company |
| 2 — Student | A school (step-1 entry or inline field), Function |
| 2 — Looking out | Most recent company, Function, Years |
| 3 | ≥1 industry, ≥1 role, ≥1 target company |
| 4 | Nothing (skippable) |
| 5 | Nothing |

**Not collected** — removed deliberately as redundant or unnecessary for matching:
work authorization, timeline, preferred work locations, seniority, employment start
date, role type, "Intro only" willingness.

---

## 4. Data model (profile object)

```
first, last, photos (0-3), headline, city, stateName, linkedin
schools: [{ name, course, year }]        // max 3
schoolDraft, yearDraft, courseDraft      // add-school form state
mode: 'working' | 'student' | 'looking'
company, role, industry, lane, years     // current position
school2, gradYear                        // student inline fallback
referCompanies: [name], will: { name: 'Happy to refer' | 'Happy to chat' }
referDraft, targetDraft, interestDraft   // add-your-own inputs
industries: [], lanes: [], targetCompanies: []
interests: [] (max 6), openTo: [], bio
direction: 'refer' | 'looking' | 'both'
p1, p2, p3                               // profile prompts
```

---

## 5. Design system

- **Type**: Plus Jakarta Sans throughout. IBM Plex Mono only for tiny counters and
  kickers.
- **Palette**: ink `#17150f`, accent `#a2542a`, page/card wash `#f6f4f0`, surfaces
  `#fff`, success `#2f7d5e`.
- **Card**: `#f6f4f0` panel, 16px radius, 15px/14px padding. Header = 12.5px
  semibold title on the left, white pill hint (`4px 8px`, 999px radius, 10px) on the
  right; title takes remaining width, pill never wraps.
- **Multi-select**: aligned grid, two equal columns (three for short values like
  course names), 6px gap. Cell = 11px/12px padding, 11px radius, label left, ✓ right
  when selected. Selected = ink fill + white text; unselected = white + hairline
  border. No ragged wrapping chip rows.
- **Inputs**: white, 12px radius, hairline border, accent border on focus.
- **Primary button**: ink fill, white text; disabled state is ink at 28% opacity and
  the label becomes the validation message.
- **Minimum touch target**: 44px.

---

## 6. Implementation notes for the build

- Every fixed-proportion block inside the scrolling step column needs
  `flex-shrink: 0`, otherwise the column squashes cards instead of scrolling.
- Company suggestions come from a peer map keyed by employer name; anything a user
  adds is merged into the same chip list so it renders as an already-selected cell.
- The card's role line is composed by filtering empty parts before joining with
  " · " so a missing city never leaves a dangling separator.
- Photo count, interest count, and industry/role caps all surface as the pill hint
  ("2 of 3") and turn accent-coloured at the cap.
