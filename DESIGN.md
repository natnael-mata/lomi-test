---
name: Lomi
description: Exit-exam prep on a white sheet over cool slate, marked in lemon yellow.
colors:
  # Lomi-Exams, from the 2026-10-01 handoff. Single theme — there are no dark-*
  # entries, by decision (owner, 2026-08-20). Every value is measured; see
  # components/contrast.test.ts, which rejected three of the handoff's own.
  brand: '#FACC15' # lemon yellow. A FILL — 1.7:1 on white, so it never sets text.
  brand-hover: '#EAB308'
  brand-soft: '#FEF9C3' # selected option, active nav, your own row
  brand-pale: '#FEF08A' # the logo's pith
  on-brand: '#1E293B' # slate on yellow
  link: '#A16207' # the one readable brand-family TEXT colour, 5.4:1 on white
  link-hover: '#854D0E'
  correct: '#4D7C0F' # olive. Green is available now: the ink is slate, not forest.
  correct-soft: '#ECFCCB'
  correct-deep: '#3F6212' # correct set ON its own wash
  wrong: '#B91C1C' # the handoff's DARK red — its #DC2626 is 3.95:1 on the wash
  wrong-bright: '#DC2626' # fills and icons, which sit on white
  wrong-soft: '#FEE2E2'
  pending: '#C2410C' # burnt orange — a topic under the pass mark
  pending-soft: '#FFEDD5'
  reward: '#3F6212' # points and streaks must be READ; the handoff greens are 2–3:1
  reward-fill: '#ECFCCB'
  on-reward: '#1E293B'
  on-state: '#FFFFFF' # text on any SOLID state fill
  bg: '#F8FAFC' # the ground
  surface: '#FFFFFF' # a card laid on it
  surface-2: '#F1F5F9'
  border: '#E2E8F0' # hairline. Never text.
  border-input: '#CBD5E1'
  border-strong: '#94A3B8'
  ink: '#1E293B' # slate, 13.9:1 on the ground
  ink-2: '#475569'
  ink-3: '#64748B' # eyebrows and muted captions
  ink-deep: '#0F172A' # hero, footer and exam-band grounds — a surface, not a mode
  on-deep: '#FFFFFF' # headings and links ON a dark band
  on-deep-2: '#CBD5E1' # prose on a dark band, 12.4:1
  on-deep-3: '#94A3B8' # captions and meta on a dark band, 7.0:1
  accent: '#84CC16' # charts and the mark, where nothing has to be read
  leaf: '#65A30D'
typography:
  display:
    fontFamily: 'Outfit, system-ui, sans-serif'
    fontSize: '2.125rem'
    fontWeight: 800
    lineHeight: '2.5rem'
    letterSpacing: '-0.03em'
  title:
    fontFamily: 'Outfit, system-ui, sans-serif'
    fontSize: '1.625rem'
    fontWeight: 800
    lineHeight: '2rem'
    letterSpacing: '-0.025em'
  stem:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 'clamp(1.1875rem, 1.8vw, 1.25rem)' # 19px on a phone, 20px wide
    fontWeight: 600
    lineHeight: '1.8125rem'
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: '1.625rem'
  label:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 600
    lineHeight: '1.25rem'
  caption:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    lineHeight: '1.125rem'
    letterSpacing: '0.04em'
rounded:
  control: '8px' # buttons in the app
  option: '12px' # options and list items
  card: '16px' # app cards
  panel: '20px' # landing feature tiles
  full: '999px' # pills and landing CTAs
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  base: '16px'
  lg: '20px'
  xl: '24px'
  xxl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.on-brand}'
    rounded: '{rounded.control}'
    padding: '14px 24px'
    height: '52px'
    typography: '{typography.label}'
  button-primary-hover:
    backgroundColor: '{colors.brand-hover}'
    textColor: '{colors.on-brand}'
  button-primary-disabled:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.ink-2}'
  button-ghost:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '14px 24px'
    height: '52px'
  option:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '12px'
    height: '56px'
    typography: '{typography.body}'
  option-selected:
    backgroundColor: '{colors.brand-soft}'
    textColor: '{colors.ink}'
  option-correct:
    backgroundColor: '{colors.correct-soft}'
    textColor: '{colors.correct}'
  option-wrong:
    backgroundColor: '{colors.wrong-soft}'
    textColor: '{colors.wrong}'
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.card}'
    padding: '16px'
  chip:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.ink-2}'
    rounded: '{rounded.full}'
    padding: '4px 10px'
    typography: '{typography.caption}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '13px 16px'
    height: '52px'
    typography: '{typography.body}'
---

<!-- Implementation: design-system/tailwind-theme.css is the normative Tailwind v4
     @theme block. These tokens and that file are the same values; update both together. -->

# Design System: Lomi (ሎሚ)

## Overview

**Creative North Star: "Shows Its Working"**

Students choose this product with money they do not have much of, weeks before an exam that
decides whether they graduate. Two things have to be true at once. It has to feel like an app
they _want_ to open — as current and as pleasant as anything else on their phone. And it has
to be an app that never lies to them.

So the surface is warm and generous: rounded shapes, restrained elevation, a confident
lemon, spring feedback on the moment that matters. Underneath, a set of rules that do not
bend. Every worked solution ends by stating the answer choice. Every readiness figure is the
weighted mean of topics whose shares add to 100. Every point names the thing that earned it.
Every question, payment and user carries an ID a student can read down a phone line. Most of
this is already enforced in the API, in `publish-gate.ts` — the design's job is to make the
rigour visible rather than hide it behind a pretty shell.

The lemon leads because ሎሚ _means_ lemon: the palette is the name, not a colour chosen and
then justified. The mark is a slice — rind, pith and flesh — and it is the only warm thing on
screen. Everything around it is **cool slate**: a tinted ground with pure-white cards laid on
it, so the yellow never has to compete for attention with a warm neutral.

Keeping the brand out of the semantic range is still the rule, and the slate neutrals make it
easier to keep than the cream world did. With a slate ink, **green is available again** — a
conventional correct-green is 89 degrees off the ink instead of 13 — so correct is olive,
incorrect is red, and pending is burnt orange. Pending is kept visibly distinct from incorrect
because **pending is not failure**; nothing provisional carries the alarm colour.

The near-black bands — the hero, the exam-simulator section, the footer — are a **surface, not
a mode**. There is still one theme. Those three are dark objects on a light page, the same way
a total bar is, and they have their own inks (see § Colors).

**Key Characteristics:**

- The question stem is the largest text on any practice or exam screen. Always.
- Semantic colour never carries meaning alone — an icon and a word travel with it.
- One springy moment (the verdict) and nothing else animates on entrance.
- Gamification is loud but legible: no mystery rewards, no punishment for a missed day.
- One theme. Paper is a single object, and a dark sheet of paper is a different one.
- 16px body floor, 52px control floor, 56px option rows — a one-handed product used in a hurry.

## Colors

A lemon brand that is a **fill only**, a semantic range on cool slate neutrals, and a
near-black that is a _surface_ rather than a mode.

### Primary

- **Brand** (#FACC15): the primary action, the logo mark, the marker behind the takeaway in a
  worked solution, and the active-nav pill. **It never sets text on a light ground** — 1.2:1 on
  the page, 1.1:1 on a card. Pair it with `on-brand` ink (#1E293B, 11.3:1) and nothing else.
  The one exception is a **dark band**, where #FACC15 on #0F172A is 11.7:1; that pair is
  audited in `components/contrast.test.ts` like any other, and it is the only ground on which
  the lemon may be a foreground.
- **Brand Hover** (#EAB308) and **Brand Soft** (#FEF9C3) / **Brand Pale** (#FEF08A): the
  pressed state, and the two washes. Brand Soft is the selected option, the active sidebar
  row, the concept card behind every explanation, and the student's own row in a list.
- **Link** (#A16207) / **Link Hover** (#854D0E): a text link, which is the one place a warm
  hue has to be readable. Both clear 4.5:1 on the page and on a card.

### Secondary

- **Correct** (#4D7C0F text, #ECFCCB fill, #3F6212 on that fill): right answers, verified
  payments, positive deltas. Olive rather than the brand yellow, and dark enough to read on
  its own wash — the handoff's lighter green was 3.1:1 on it.
- **Incorrect** (#B91C1C text, #DC2626 solid fill, #FEE2E2 wash): wrong answers, failed
  verification, the retire action. The bright #DC2626 is a **fill only**: it measures 3.95:1 on
  its own wash, so text over that wash uses the darker #B91C1C.
- **Pending** (#C2410C text, #FFEDD5 wash): awaiting verification, flagged questions, a payment
  in the queue. Distinct from incorrect because **pending is not failure** — nothing provisional
  gets the alarm colour.
- **On State** (#FFFFFF): text on _any_ solid state fill. `on-brand` is ink, so reusing it on a
  saturated fill gives 1.5–2.0:1; this is the explicit token instead, and every solid fill is
  audited against it.

### Tertiary

- **Reward** (#3F6212): streaks, points, badges. Deliberately the deep olive and not the lemon,
  because a streak must never look like a primary action.
- **Accent** (#84CC16) / **Leaf** (#65A30D): charts and the mark — places where nothing has to
  be read.

### Neutral

- **Ink** (#1E293B) / **Ink 2** (#475569) / **Ink 3** (#64748B): primary text, secondary copy,
  and eyebrows. Cool slate, never pure black, so the lemon is the only warm thing on screen.
- **Background** (#F8FAFC) / **Surface** (#FFFFFF) / **Surface 2** (#F1F5F9): the three ground
  levels. The ground is the tinted sheet and a card is pure white laid on it, which is what
  gives a card its edge without leaning on the hairline.
- **Border** (#E2E8F0) hairline, **Border Input** (#CBD5E1), **Border Strong** (#94A3B8).
  Borders are never text.

### Dark bands

The hero, the exam-simulator band and the footer are **#0F172A surfaces, not a dark mode**.
This product has one theme; those three are dark objects on a light page, the way a total bar
is. Text on them uses its own three inks — **On Deep** (#FFFFFF), **On Deep 2** (#CBD5E1),
**On Deep 3** (#94A3B8) — because `ink` is 1.1:1 and `ink-3` is 3.4:1 down there. They are
named for the ground rather than for a shade so nobody reaches for `border-strong` as "the grey
one": it is the same hex, and what makes it legible here is the ground, not the value.

### Named Rules

**The Separation Rule.** The brand colour is never used to mean correct, wrong or pending, and
a semantic colour is never used for a brand moment. A student must never have to work out
whether the lemon means "selected" or "right".

**The Yellow Is A Fill Rule.** The lemon never sets text on a light ground and never takes
white on top of it. Ink-on-yellow, via the `on-brand` token. On a dark band it may set text,
and only there.

**The Icon And Word Rule.** Every state that matters — correct, incorrect, pending, flagged,
verified, focus — carries an icon _and_ a word alongside its colour, so the system survives
greyscale, colour blindness and a cheap screen in sunlight.

**The Audited Pair Rule.** A foreground and a background that meet on screen are listed in
`components/contrast.test.ts`. A pair that is not listed is one nobody has checked, and the
stylesheet-side guard fails on any `bg-*`/`text-*` combination the audit has not seen.

## Typography

**Display Font:** Outfit (with system-ui)
**Body Font:** Inter (with system-ui)

Both are variable, **self-hosted** from `apps/web/app/fonts/` via `next/font/local`, and that
is not a preference. `next/font/google` is banned here: it fails closed to system-ui _and the
build still succeeds_, so the product can ship in the wrong face with nothing red anywhere.
The stylesheet names the faces through `var(--font-display-face, 'Outfit')` for the same
reason — `next/font` generates a per-font family name, so writing the literal name in the
stack would silently fall back while looking correct.

Outfit replaced Archivo with the 2026-10-01 handoff. It is a geometric sans that holds its
shape at extrabold and at poster sizes, which is what the landing's headline and the figures
students care about — countdown, score, readiness — are set in. Inter is a highly legible UI
face that holds up at 15–16px on a low-end Android screen, which is where nearly all of this
product is actually read.

### Hierarchy

- **Display** (Outfit 800, 34/40, -0.03em): countdown, mock score, readiness. One per screen.
- **Title** (Outfit 800, 26/32, -0.025em): screen titles.
- **Stem** (Inter 600, 19/29 on a phone, growing to 20px wide): the question — the most-read text in the product. The layout sweep measures that nothing on a practice or exam screen is larger.
- **Body** (Inter 400, 16/26): options, explanations, prose. Never below 16px on mobile,
  never truncated, measure ≤70ch.
- **Label** (Inter 600, 15/20): buttons, tabs, chips.
- **Caption** (Inter 600, 13/18, +0.04em, uppercase): field labels, blueprint weights, meta.

### Named Rules

**The Stem Supremacy Rule.** On any practice or exam screen the question stem is the largest
type present. Not the timer, not the score, not the streak, not the brand.

**The No-Case Rule.** Ethiopic has no upper and lower case, so every uppercase caption style is
Latin-only and switches off on Amharic strings, where weight and colour carry the caption role
instead. Ethiopic also sets taller and runs longer, so any string that must hold one line — nav
labels, buttons, the countdown — is authored per language rather than translated in place.

**The Tabular Rule.** Any figure that is compared, summed or timed uses
`font-variant-numeric: tabular-nums`: timers, scores, prices, points, percentages, references.

## Layout

Student content sets to a 640px measure on desktop and fills the viewport on a phone; admin
sets to 1200px and is permitted real tables. Spacing runs 4/8/12/16/20/24/32, with more space
above a heading than below it.

**A measure governs prose, not figures.** The 640px above exists to hold running text near 65
characters — the question stem, the concept line, the worked solution. It does not apply to a
screen whose content is numbers: readiness and standing are a headline figure, a weighted
table and a trend, and at 640px on a 1512px laptop they used 42% of the width and scrolled
1254px for content that fits one screen. Those two set to a **960px data measure** instead,
and Today joined them in the redesign — a countdown, a coverage meter, a daily ring, weighted
topic bars, mock bars and a week of dots, laid on the handoff's 360px card minimum, which at
640px is one column of cards stacked down a laptop with half the window empty. Practice, exam
and checkout keep 640px, because what a student reads there is sentences.

Screens are composed of **cards on a tinted ground** rather than full-bleed sections, which
gives the surface its modern feel and lets a stressed reader see where one idea ends. Cards
group things that genuinely belong together; a card is never used merely to put a border round
a paragraph, and cards are never nested.

Touch targets are ≥44px with ≥8px between them. Controls are 52px, answer option rows are 56px
and full-width with the entire row as the target, and any question-navigator cell is ≥44px.
Wide content — tables, code — scrolls inside its own container so the page never moves
sideways.

**The Total Rule.** A row of figures that genuinely sums ends in a dark total bar. A figure
that is derived rather than summed — a readiness percentage, a balance quoted out of context —
uses the _stated_ treatment on Surface 2 instead, with a chip naming how it was derived. A
total nobody can verify is decoration, and this product cannot afford decorative numbers.

## Elevation & Depth

Restrained, real elevation, tinted with the **deep slate** (#0F172A) — a green-biased shadow
from the cream world reads as a stain on a cool ground. Light throughout: the ground is already
tinted and a card is already pure white, so most of a card's edge is contrast and the shadow
only has to say _on top of_.

### Shadow Vocabulary

- **Card** (`0 1px 2px rgb(15 23 42 / .05)`): the default resting surface for cards and tables.
  Paired with the 1px hairline, which does the separating.
- **Lift** (`0 2px 4px … , 0 10px 24px rgb(15 23 42 / .09)`): device frames and anything
  presented as being above the page.
- **Panel** (`0 4px 8px … , 0 22px 44px rgb(15 23 42 / .14)`): the retire modal, bottom sheets.
- **Hero** (`0 24px 60px -20px rgb(0 0 0 / .55)`): the landing composite floating on the dark
  band, and only there. A white card on near-black separates by brightness already; the long
  drop is what stops it reading as pasted on.
- **Brand** (`0 2px 4px … , 0 8px 20px rgb(15 23 42 / .14)`): the primary button only, so the
  main action is findable without hunting. **Ink-tinted, not lemon** — a yellow glow under a
  yellow button is a halo rather than depth.

### Named Rules

**The One Brand Shadow Rule.** The brand-tinted shadow belongs to the primary action and
nothing else. A screen with two brand shadows has two primary actions, which means it has none.

## Shapes

Three steps and a pill, and it is a **hierarchy rather than a set of preferences**: a button is
the tightest because it is a control you press, a card is rounder because it is an object on
the page, and an outer frame is rounder still because it holds the objects.

**8px** on buttons, inputs and controls; **16px** on cards, option rows, wells and sheets;
**20px** on outer frames, modals and the landing's feature tiles; **full pills** on chips,
badges, avatars, progress tracks, the letter badge inside an answer option, and the landing's
calls to action.

Borders are 1px at rest, everywhere. The 2px ink borders the cream world used — on option rows,
track cards and the landing's step list — are gone: the redesign's object is a white card with
a hairline, and a page of 2px frames reads as a table somebody has drawn lines in. Option rows
carry their state in the fill and the icon instead, which is what the Icon And Word Rule
already required.

Icons are 2px-stroke rounded-join outlines drawn on a 24px grid — never emoji, in any surface,
including bot messages.

## The mark

**A lemon slice**, drawn on a `-100 -100 200 200` viewBox: a rind ring, a pith ring inside it,
four flesh wedges separated by pith-coloured strokes, and a small centre dot. Rind #EAB308,
pith #FEF08A, flesh #FACC15 — the three values the palette is named after, in the one place
they can sit together without anything having to be read.

**There is no tile.** Every earlier mark sat inside a rounded yellow square because each needed
a ground: a Ge'ez `ሎሚ` until 2026-08-20, then the letter `L`, then a whole lemon with a check
drawn through it. A slice needs none — it is already a circle, already yellow, and already the
shape of the thing it names, so a square behind it was a box around a picture of a lemon.

**The centre dot comes off below 24px.** At a 16–20px browser tab it is one or two pixels of
noise in the middle of the wedges, while the ring and the wedges still read — so the favicon is
the dotless variant. `LemonMark` applies that threshold itself rather than leaving each caller
to remember it.

**The wordmark is two-tone.** "Lomi" in ink and "-Exams" in the muted grey, because the product
is Lomi and the rest says which Lomi. On a dark band both halves switch to the `on-deep` inks
via the component's `onDark` prop rather than a caller-supplied class, so the two halves cannot
be recoloured one at a time.

> The mark has been four things. A Ge'ez `ሎሚ` glyph until 2026-08-20 — the only thing in the
> product needing Ge'ez coverage, at 198KB of font on every first load. Then the letter `L`,
> honest about being a placeholder. Then the whole fruit with a check through it. The first two
> were **text**, which is the failure worth naming: a mark set in a typeface renders in whatever
> face the device substitutes, so it is the one element guaranteed to differ on every phone.
> This one is drawn.
>
> The geometry lives in `apps/web/components/lemon-mark.mjs`, imported by both the component
> and the icon script. That is not tidiness. The script previously held its own copy —
> `#5b4be0` violet and an Ethiopic `@font-face` — and stayed broken for three weeks after the
> palette changed, because app icons are regenerated about twice a year.

## The three doors

Sign in, sign up and reset share one frame — `AuthShell`: a back arrow, the mark, an optional
step label, a heading and one sentence. They were drifting apart before it existed (sign-in
centred its logo and set a `text-title`; the code flow had no mark and no way back at all),
which is three slightly different front doors to one product.

**440px, not the 640px student measure.** A form of three fields at 640px on a laptop is three
very wide fields, and a wide text input reads as a place to write a paragraph.

**Every door is unframed.** No sidebar, no bottom bar. Five destinations shown to somebody who
cannot reach any of them is an invitation to five sign-in walls — `/signup` and `/reset` were
missing from that list until the redesign, and `/signin` being in it is what hid the gap.

**Sign-up and reset are three steps, not the handoff's two.** Phone, code, password: the
server's register flow is three calls, and this redesign changes the interface, not the API.
The step label says so on every screen.

**The six-digit code is six boxes over one input.** Six separate fields is the usual build and
the one that breaks — paste fills one box, `autocomplete="one-time-code"` has nothing single to
attach to, and a screen reader announces six unlabelled fields. There is one real input holding
the whole string, laid transparently over six presentational boxes, which keeps SMS autofill,
paste and password managers working. Its focus ring is drawn on the boxes, since an invisible
field shows an invisible ring.

## Onboarding

One screen, `/choose`, and it is also how a programme is **changed** — which is why it opens
with the current one selected rather than blank.

The programmes are a two-up grid of pressable tiles with the question count under each name,
not a stack of radio rows: a vertical list of eight asks somebody to read down it, a grid asks
them to look. **Real radios underneath, `sr-only` rather than removed** — buttons would cost
the group one tab stop, arrow-key movement, and "radio group, 3 of 8" in a screen reader.

A programme with no published questions is **shown, dimmed, and labelled** "Being written".
Hiding it would say we do not cover that exam at all; three were published and empty, and
choosing one put a student behind the field gate with every screen working and nothing in it.

Two things the handoff asks for that are not built, each because the product already answers
the question differently:

- **No "questions per day" picker.** The daily target is derived — `planFor` divides the
  questions left by the days to the sitting and recalculates every morning, which is the
  promise the landing page makes. A chooser would contradict it and would need a field the API
  does not have.
- **The exam-day note states only what is known.** The handoff writes "Exam day: Thursday,
  November 12. That's 43 days, so your plan covers every topic at least twice" as settled fact.
  The date is read from the selected field's `examDate` and most programmes have none, so a
  programme without one says so and names it as ours to fix; the coverage claim is dropped
  entirely, because the plan does not exist until the choice is saved.

The retaker question is asked only where there is an exit exam to have sat — `maxGrade` is
non-null exactly for the school tracks — and nothing is sent for those, so `isRetaker` stays
unset rather than recording a `false` from somebody nobody asked.

## Today

The hub a signed-in student lands on, at `/today` (`/home` redirects there). **Every figure is
read, none is drawn**: the countdown and coverage meter from `coverage`, the ring from today's
practice summary over the derived `perDay`, the topic bars from `readiness`, the mock bars from
`trend`, the study days and points from `standing` and the ledger. Each block fails on its
own — six independent reads, settled independently — so a dropped request for the mock trend
cannot blank the countdown.

**The hero is coverage, not readiness.** The handoff leads with "Readiness 62%" against a 60%
line. T-256 made coverage the headline because it is a count a student can check ("412 of
1,240 beaten"); readiness is a weighted mean they cannot. Readiness keeps the job it is good at,
the per-topic bars and their 60% line — pending orange below it, never the wrong red, because a
topic under the line is unfinished rather than failed.

Not built, because nothing can supply them: "Week 9 of 15", "About 25 minutes", a per-topic
split of the daily target, and "Mock 5 opens Saturday" (mocks are on demand). Mock scores stay
**bars**, per T-138 — a line implies values between sittings, and there are none.

**The study-day count is never "in a row".** It is a count of distinct days a student showed
up, and nothing subtracts from it. The week of dots is drawn only when the ledger page provably
covers all seven days; each answer earns ledger rows, so a busy student's page can stop days
short, and the days past it would otherwise be drawn as empty although they were studied. A day
off is an outline, never a red dot.

## Mocks, the exam, and results

**Mocks** (`/mocks`) is a dark "Next up" card that starts a paper or goes back to the open one,
and every past paper with its score and a link to its results. Starting is the simulator's
job: the button goes to `/exam?start=1`, so queued offline answers, an expired paper and the
resume position are handled in one place.

**The exam** (`/exam`) has the whole screen: no tabs, its own header with the way out, the
paper's name, the answered count and the clock, and its own footer with Previous and Next. A
desktop gets the question panel beside the paper (counts, the grid, Review and submit); a phone
opens the same panel above the question. Keys: the arrows move, A to D or 1 to 4 answer, F
flags, all ignored with a modifier held or when a control has already used the key.

1. **Leaving is a door, not a cancel.** The paper stays open and its clock keeps running on the
   server; the control's label says so.
2. **The confirmation comes every time** with answered, blank and flagged counts and the time
   left, because a submitted paper cannot be reopened. It replaces the question in place: the
   emergency retire is the only modal in the system.
3. **Grid cells stay at 44px.** The handoff draws ten 30px cells to a row; the grid fills its
   width with as many 44px columns as fit. Answered is the lemon, blank is grey, the current
   cell is outlined in the link amber at 2px, and a flag is an orange dot in the corner.
4. **The panel's counts are 18px**, under the stem, not the handoff's 22px.

**Results** (`/exam/review/[id]`) is where a paper goes the moment it closes: the score on the
dark surface, the score by topic beside it, then the questions, missed ones first, each opening
its full explanation in place. "Time used" is not shown, because the result carries no start
time; Blank takes its slot.

**No pass mark is stated anywhere yet.** The handoff says "graded against the 50% pass mark".
Nothing in this product states one, and the school tracks are not sat against the university
exit exam's. `PASS_MARK_PCT` in `lib/pass-mark.ts` is typed, null, and wired to the Mocks
subtitle and the results badge, which appear when it is set.

## Progress

Four figures across the top, each with how it was worked out written under it: **coverage**
first (beaten of total, the checkable headline), readiness, the latest mock, and study days.
The handoff's four are readiness, latest mock, day streak and topics below 60%; coverage takes
the lead for the reason it leads Today, the topics below the line are counted in the readiness
card's own header where the topics are, and the streak is "study days" because the API counts
days shown up, never days in a row.

Then coverage and readiness side by side on a desktop:

1. **Coverage** is one card: the ring with its target tick, the sentences that explain it, then
   by year and by subject under a hairline. Subjects under 60% are pending orange, not the wrong
   red they were: red on a bar that measures progress made reads as a penalty for the progress.
2. **Readiness by topic** covers every topic, read against the 60% pass safe line drawn on each
   track, ink above it and orange below, with the evidence folded into each row ("from 2
   answers · too few to be sure"). That evidence was a second list under the first.

Then **five weeks of activity**, a row a week, Monday first, shaded by answers per day at stated
thresholds (1 to 5, 6 to 11, 12 or more, twelve being the smallest daily target). There is no
activity endpoint, so it is counted from the points ledger and drawn **only when the ledger page
covers all five weeks**; otherwise it is left out rather than drawn with studied days empty. An
endpoint returning counts per day is the open item that lets every student see it.

The mock trend and the paper history left Progress: Mocks lists every paper with its score and
results, and the two screens printed each paper twice. Standing is linked from here, since it
left the navigation.

## Account

Four cards on the reading measure, stacked: who you are (initial, display name, phone), your
access (active in the correct wash, lapsed in the pending wash, free in grey, each with its one
button to checkout), the devices signed in (with "Log out" on every one but this one, which signs
out with the button at the foot), and the ways out (the staff console for staff, and Sign out in
the wrong wash, the one action here with a cost).

Not built from the handoff: the English and Amharic toggle (English only, by decision), the Fayda
line (identity checks were dropped), and an editable display name. There is no endpoint to change
the name, so it is shown as plain text with a sentence saying it cannot be changed yet, never as a
field that looks editable and saves nothing. `DISPLAY_NAME_EDITABLE` is the switch.

The device list moved here from under the plans on `/checkout`, which is about buying access now.

## Plans and checkout

One page, the handoff's way: the plans, then the ways to pay, then a summary whose button says
the amount and the method in words ("Pay Br 800 with telebirr"). The method used to be a second
screen; now its fields sit in the summary when it is chosen (the paying number for telebirr and
CBE Birr, the account and the reference for a bank transfer).

**Plans by length, not the handoff's feature tiers.** The handoff sells Starter, Standard and Full
prep at three prices with different features. Every plan here unlocks the same programme for a
different length of time (Br 500 for six months, Br 800 for twelve, Br 300 on school tracks), by
the owner's decision, so the cards show length, price and price a month, and what every plan
includes is said once beneath them. Plan cards and methods are real radios under pressable cards.

On the 640px reading measure the ways to pay and the summary are stacked, not side by side: at
that width two columns wrapped every method's description to three lines.

Not built: the Fayda note (identity checks were dropped) and a receipt upload (a transfer is
claimed by its reference, and a person matches it to the statement). The practice paywall uses
the same card for a plan, so both screens mark the recommended one the same way.

## Admin

The staff console sits under a **dark bar**: the wordmark, an "Admin" or "Provider" badge, the
tabs (the current one in the lemon, 44px each, not the handoff's 40), the way back to the student
app, and Sign out. Dark so that nobody mistakes the console for the student app.

1. **Review** is the handoff's list and detail: the question under review beside the drafts, with
   publish, a note to the writer, and send back. Success lands in the correct wash; the publish
   gate's refusals in the pending wash, one per line.
2. **Payments** keeps its dense table, which suits a person working through many claims better
   than the handoff's cards, and gains the handoff's three count tiles above it. **Approve is the
   lemon primary button**, not the solid green it was: green means a correct answer here, and the
   Separation Rule keeps a brand moment and a semantic colour apart.
3. **Weights** is the handoff's "Structure" idea (a weight sum badge, a field live only at 100%)
   inside the existing editor, with buttons sized to their labels.

Money is written Br first everywhere, the dashboard's totals included. A value a record does not
carry reads "Not given", never a dash.

## Focus on dark surfaces

Inside any element marked `.on-deep` (the landing's bands, Today's hero, the Mocks card, a
result's score card, the admin bar) the focus ring is the **lemon**, 11.7:1 on `ink-deep`. The ink
ring is 1.22:1 there, which is no ring at all; the focus check found every control on the dark
admin bar invisible to a keyboard until this rule.

## Components

### Buttons

- **Primary:** the **lemon fill**, `on-brand` ink text (11.3:1), 8px radius, 52px minimum
  height, full width on mobile. Presses to `scale(.98)`. Hover deepens to Brand Hover. It was ink
  from 2026-08-23 to the 2026-10-01 handoff, on the argument that the lemon was the marker; the
  handoff makes every primary action the lemon and moved the markers to orange, so the dispute
  recorded here during the redesign is settled its way. The exam's Next is the one ink button,
  as in the handoff, because "Review and submit" is the lemon on that screen.
- **Ghost:** surface fill with a 1px border; the manual-payment path and every secondary action.
- **Danger:** Incorrect fill, no shadow. Exists only on emergency retire.
- **Disabled:** Surface 2 fill, Ink 2 text, no shadow — and the label is replaced by the
  blocking reason where one exists ("2 why-wrongs missing", "Can't publish · 3 blockers").
- **Focus:** 2px brand outline at 2px offset, on every interactive element.

### Answer option

Full width row, 56px minimum, **12px radius** (`rounded-option`: an option is a card you press,
not a panel) and a **1.5px border in every state**, driven by a `data-state` attribute
(`default` / `selected` / `correct` / `wrong`) that mirrors `aria-checked`. It was 1px at rest
and 2px once chosen, so every tap moved the row's text and everything below it; only the colour
changes now. The state is carried three ways and never by colour alone: border and fill, the
lettered chip filling with the state colour (lemon when chosen, olive when correct, bright red
when it is your wrong answer), and a word with an icon at the end of the row ("Selected",
"Correct", "Your answer"). The whole row is the target.

### Practice

The handoff's layout, around logic that did not change: choose, then check; the reason check
on a first correct answer; the free counter and the paywall.

- **"Today's plan" and today's count** at the top, read from the same two endpoints Today reads
  so the bar here and the ring there cannot disagree. No bar when there is no sitting date.
- **"Question 16" is a 16px label, not the handoff's 24px heading.** The Stem Supremacy Rule
  wins, and the layout sweep now measures it on every screen with a stem.
- **The stem sits on the page, not in a card.**
- **The verdict names the right letter**: "Not quite. The answer is B."
- **"What was tested"** on the lemon wash, then the worked solution as numbered steps with the
  **final step green**: it states the answer, and the answer already has a colour on this
  screen.
- **"Check answer" and "Next question" ride `sticky-foot`**, which pins above the phone's tab
  bar and to the bottom on a desktop. `sticky bottom-0` put them under the tab bar the moment
  an explanation made the page scroll.

### The explanation (signature component)

Fixed order, nothing behind an extra tap:

1. **Verdict card** — a tinted bar carrying an icon, a word ("Correct" / "Not quite") and the
   student's time against the limit in tabular figures. Over the limit reads Pending and is
   framed as pacing, never as failure.
2. **Concept card** — one sentence naming what was tested, on Brand Soft. The thing to remember.
3. **Solution** — CONCEPT questions get prose; CALCULATION questions get a numbered step list
   in a Surface 2 well whose **final step is highlighted in Correct and states the answer
   choice** ("= 150,000 → answer B"). This is the publish gate made visible.
4. **Why-wrongs** — one card per distractor, the student's own choice first and tinted, framed
   as "why it tempted you".

### The readiness statement (signature component)

Topic rows with a label, the student's percentage, a bar, and the topic's blueprint share as a
caption. Rows below the 60% pass-safe line switch to Pending and gain a Focus chip. Weights
**sum to 100**, including an explicit "N other topics" row when rows are elided, and the
headline figure is their weighted mean. Every statement ends in a practice action.

### Cards, chips, inputs

- **Card:** Surface, 16px radius, Card shadow, 16px padding. Never nested.
- **Chip:** Surface 2, full pill, caption type. State chips take the soft fill and text colour
  of their state.
- **Input:** Surface, 8px radius, 52px, with a visible label above — sentence case, 14px,
  full ink — never a
  placeholder standing in for a label. Focus takes the brand outline and border. Errors set
  `aria-invalid`, point at the message with `aria-describedby`, and the message names the cause
  _and_ the fix.

### Navigation

Bottom bar below 1024px: **five** labelled destinations, 56px, with the active item's icon
sitting in a Brand Soft pill and its label in ink at 600. Labels are never hidden. Desktop
moves the same five to a sidebar.

The five are **Today, Practice, Mocks, Progress, Account**.

> **This said six until 2026-10-01.** It was five, then Ask joined, and the redesign returns
> it to five by folding three destinations into screens rather than deleting them: Access
> into Account, Standing onto Progress, Ask onto Today. The number was never the rule — what
> the rule protects is that every destination keeps a readable label — but six items on a
> 375px screen was the limit this section already warned about, and the redesign spends that
> room on a hub instead.
>
> **Dropping a destination from the bar must not orphan its route.** All three screens are
> built, and a built screen nothing links to is a defect this product has shipped twice:
> `/exam/review` existed for weeks with no way back to it, and `/home` was reachable only by
> typing the URL. `layout-measure.test.ts` asserts each one is still linked from the screen
> that absorbed it.

The sidebar is **240px, sticky, from 1024px**: the logo, the five destinations as rows with
the icon beside a 15px label, and an access card at the foot carrying when access runs out.
Below 1024px it is replaced by a **sticky top bar** — the mark and the page's own name — plus
the fixed bottom bar, and the content takes about 104px of bottom clearance so the last
control on a screen is never under the tabs.

The active item takes the Brand Soft pill on both rails; on the bottom bar the pill sits
behind the **icon only**, since a filled cell in a 56px bar reads as a button rather than as
"you are here".

**Admin does not get the rail.** It takes a 64px top bar with the same five-destination
treatment as pills — Dashboard, Payments, Import, Weights, Users — because admin work is a
table that wants every pixel of the 1200px it is allowed, and 232px of rail beside a
six-column table is 232px taken from the column holding a reference number.

Sign-in has **no navigation at all**. Five destinations shown to somebody who cannot reach any
of them is an invitation to five sign-in walls.

### The destructive control

Emergency retire is the only Danger button and the only modal in the system. Its blast radius
is **itemised** — attempts flagged, live sittings affected, scores recomputed — never
summarised as "this affects many students", because a number an operator can check is what
makes them stop and read.

## Do's and Don'ts

### Do:

- **Do** end every worked calculation on a highlighted step that states the answer choice.
- **Do** make every total verifiable: weights sum to 100, elided rows are shown explicitly, and
  a derived figure uses the _stated_ treatment rather than a total bar.
- **Do** name the source of every point ("First-try correct · Taxation · +12").
- **Do** pair every state colour with an icon and a word.
- **Do** give every question, payment and user a reference students can quote to support.
- **Do** keep the streak visible but consequence-free: a missed day is drawn as a lighter cell
  with a plain explanation, and posts as a zero-point "plan adjusted" line.
- **Do** disable `text-transform: uppercase` on Ethiopic strings.

### Don't:

- **Don't** animate anything on entrance except the verdict and the explanation that follows it.
- **Don't** use confetti, celebration sounds or a mascot. A student getting 19 of 60 wrong
  should not sit through 37 parties, and the explanation is the reward.
- **Don't** let anything on a practice or exam screen be larger than the question stem.
- **Don't** put reward yellow behind white text, or use it as a text colour.
- **Don't** show a readiness or score figure that cannot be reconstructed from what is on screen.
- **Don't** show the Fayda-verified legal name on any public surface — leaderboards and
  community use display names only.
- **Don't** offer a printable or downloadable view of question content. The bank is the asset.
- **Don't** remap correct, incorrect, pending or the badge tiers to Telegram theme params.
