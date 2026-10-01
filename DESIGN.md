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
  accent: '#84CC16' # charts and the mark, where nothing has to be read
  leaf: '#65A30D'
typography:
  display:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: '2.125rem'
    fontWeight: 800
    lineHeight: '2.5rem'
    letterSpacing: '-0.03em'
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: '1.875rem'
    letterSpacing: '-0.02em'
  stem:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: '1.1875rem'
    fontWeight: 600
    lineHeight: '1.8125rem'
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: '1.625rem'
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: '0.9375rem'
    fontWeight: 600
    lineHeight: '1.25rem'
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
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
then justified. Cream pith, forest leaf, lemon flesh. Neutrals are warm paper rather than
grey, so nothing reads as unconsidered.

Keeping the brand out of the semantic range is still the rule, but this world enforces it
differently. The ink is forest green, so **green cannot mean correct** — a conventional
correct-green sits 13 degrees of hue from the ink and 2.12:1 against it, which makes a verdict
indistinguishable from the paragraph around it. Correct is therefore teal, 93 degrees off.
Pending is pencil rather than amber, because amber is the lemon's neighbour and because
nothing provisional should carry an alarm colour at all.

**Key Characteristics:**

- The question stem is the largest text on any practice or exam screen. Always.
- Semantic colour never carries meaning alone — an icon and a word travel with it.
- One springy moment (the verdict) and nothing else animates on entrance.
- Gamification is loud but legible: no mystery rewards, no punishment for a missed day.
- One theme. Paper is a single object, and a dark sheet of paper is a different one.
- 16px body floor, 52px control floor, 56px option rows — a one-handed product used in a hurry.

## Colors

A lemon brand that is a FILL ONLY, a semantic range that avoids green because the ink is
green, over warm paper neutrals.

### Primary

- **Lemon** (#FFE95C): the primary action, the logo mark, and the marker that highlights the
  takeaway in a worked solution. **It never sets text.** On cream it measures 1.23:1. Pair it
  with `on-brand` ink (11.24:1) and nothing else. A darkened amber accent was tried and
  rejected: no value clears 4.5:1 while staying 45 degrees from both the forest ink and the
  terracotta of _wrong_, so an amber label reads as an error. Where a brand-coloured label
  used to go, use ink at 600 over Brand Soft.
- **Brand Soft** (#FFF6C4): selected option fill, active navigation, the concept card behind
  every explanation, and the student's own row in any list.

### Secondary

- **Correct** (#0F5F63): right answers, verified payments, positive deltas. **Teal, not
  green** — the ink is forest green, so a green verdict reads as ordinary body copy (13 deg
  of hue from the ink, 2.12:1 against it). Clears 4.5:1 on bg, on surface and on its own fill.
- **Incorrect** (#A3300F): wrong answers, failed verification, the retire action. Terracotta,
  darkened from the source style's #CB5521, which was 4.14:1 on cream and failed body text.
- **Pending** (#4A4A46): awaiting verification, flagged questions, a payment in the queue.
  **Pencil, not amber** — written but not yet inked. Achromatic, so it separates from every
  hue at once, and distinct from incorrect because **pending is not failure**: nothing
  provisional gets an alarm colour.

### Tertiary

- **Reward** (#6B2D78 text / #F6D0FF fill): streaks, points, badges. **Plum, because the
  lemon is the brand** — a streak must never look like a primary action. The fill pairs with
  **On Reward** (#1A3300).

### Neutral

- **Ink** (#1A3300): all primary text. Forest, never pure black. 13.27:1 on cream.
- **Ink 2** (#5B5B75): captions, metadata, secondary copy. Verified ≥4.5:1 on every ground.
- **Background** (#F6F6FB) / **Surface** (#FFFFFF) / **Surface 2** (#F0F0F7): the three
  ground levels. Surface 2 carries wells, step lists, chips and skeletons.
- **Border** (#E3E3EF): 1px hairlines; option rows use 2px so their state reads at a glance.

### Named Rules

**The Separation Rule.** The brand colour is never used to mean correct, wrong or pending, and
a semantic colour is never used for a brand moment. A student must never have to work out
whether the lemon means "selected" or "right".

**The Yellow Is A Fill Rule.** Reward yellow never sets text and never takes white on top of
it. Ink-on-yellow, in both themes, via the `on-reward` token.

**The Icon And Word Rule.** Every state that matters — correct, incorrect, pending, flagged,
verified, focus — carries an icon _and_ a word alongside its colour, so the system survives
greyscale, colour blindness and a cheap screen in sunlight.

## Typography

**Display Font:** Archivo (with Noto Sans Ethiopic, system-ui)
**Body Font:** Inter (with Noto Sans Ethiopic, system-ui)

Archivo stands in for Bricolage Grotesque, which the visual direction names but which is not
obtainable here; `next/font/google` is banned, so a substituted grotesque beats a silent
system-ui fallback. Swap it by dropping the woff2 into `apps/web/app/fonts/`.

**Character:** Archivo is a grotesque with real width and presence at heavy weights — it
carries the numbers students care about (countdown, score, readiness) without feeling
corporate. Inter is a highly legible modern UI face that holds up at 15–16px on a low-end
Android screen, which is where nearly all of this product is actually read. Both are variable
and self-hosted via `next/font`; no CDN, no layout shift.

### Hierarchy

- **Display** (Archivo 800, 34/40, -0.03em): countdown, mock score, readiness. One per screen.
- **Title** (Archivo 700, 24/30, -0.02em): screen titles.
- **Stem** (Inter 600, 19/29): the question — the most-read text in the product.
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
1254px for content that fits one screen. Those two set to a **960px data measure** instead.
Practice, exam and checkout keep 640px, because what a student reads there is sentences.

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

Soft, real elevation. Every shadow carries both an offset and a blur, tinted with the
forest-biased ink so it reads as depth on cream rather than grey fog. Lighter than Deresegn's
throughout: paper does not float far off the page.

### Shadow Vocabulary

- **Card** (`0 1px 2px rgb(22 22 43 / .05), 0 6px 16px rgb(22 22 43 / .07)`): the default
  resting surface for cards and tables.
- **Lift** (`0 2px 4px rgb(22 22 43 / .06), 0 12px 28px rgb(22 22 43 / .10)`): device frames
  and anything presented as being above the page.
- **Panel** (`0 4px 8px rgb(22 22 43 / .07), 0 24px 48px rgb(22 22 43 / .16)`): the retire
  modal, bottom sheets.
- **Brand** (`0 2px 4px rgb(26 51 0 / .10), 0 8px 20px rgb(26 51 0 / .14)`): the primary
  button only, so the main action is findable without hunting for it. **Ink-tinted, not
  lemon** — a yellow glow under a yellow button is a halo rather than depth, and lemon at any
  alpha disappears on cream.

### Named Rules

**The One Brand Shadow Rule.** The brand-tinted shadow belongs to the primary action and
nothing else. A screen with two brand shadows has two primary actions, which means it has none.

## Shapes

Generous, consistent rounding: **12px** on controls, inputs and option rows; **16px** on cards
and wells; **24px** on sheets, modals and device frames; **full pills** on chips, badges,
avatars, progress tracks and the letter badge inside an answer option.

Borders are 1px at rest. Option rows carry 2px so their selected, correct and wrong states are
legible at arm's length on a cheap screen. Icons are 2px-stroke rounded-join outlines drawn on
a 24px grid — never emoji, in any surface, including bot messages.

## The mark

A whole lemon on a 24px grid: an oval body tilted 20° with a nub at each end of its long
axis, a cream glint on the upper shoulder, twin mint leaves on a short stem, and **the
answer screens' correct stroke laid across it** — mint over ink, the same gesture drawn over
a correct option. The fruit is the name (ሎሚ *means* lemon) and the check is the product.

It sits in the lemon rounded square everywhere the interface names itself: the navigation
bar, sign-in, the admin bar, the app icons. Inside that tile the body is **unfilled** — the
tile already is the fruit, and a second yellow on top only thickens the outline. Standing
alone on cream it takes the brand fill.

**The check is drawn twice, ink under mint.** Mint alone is about 1.2:1 on the lemon tile
and the check disappears into the fruit; the ink underlay is what keeps it a check on
yellow, on cream, and at 20px.

**The leaves come off below 24px.** At a 16–20px browser tab two 3px leaves are four grey
pixels and a suggestion, while the fruit and the check still read — so the favicon is the
leafless variant. `LemonMark` applies that threshold itself rather than leaving each caller
to remember it.

> The mark has been three things. A Ge'ez `ሎሚ` glyph until 2026-08-20 — the only thing in
> the product needing Ge'ez coverage, at 198KB of font on every first load. Then the letter
> `L`, honest about being a placeholder. Both were **text**, which is the failure worth
> naming: a mark set in a typeface renders in whatever face the device substitutes, so it is
> the one element guaranteed to differ on every phone. This one is drawn.
>
> The geometry lives in `apps/web/components/lemon-mark.mjs`, imported by both the component
> and the icon script. That is not tidiness. The script previously held its own copy —
> `#5b4be0` violet and an Ethiopic `@font-face` — and stayed broken for three weeks after the
> palette changed, because app icons are regenerated about twice a year.

## Components

### Buttons

- **Primary:** brand fill, on-brand text, 12px radius, 52px minimum height, full width on
  mobile, brand-tinted shadow. Presses to `scale(.985)`. Hover deepens to Brand Hover.
- **Ghost:** surface fill with a 1px border; the manual-payment path and every secondary action.
- **Danger:** Incorrect fill, no shadow. Exists only on emergency retire.
- **Disabled:** Surface 2 fill, Ink 2 text, no shadow — and the label is replaced by the
  blocking reason where one exists ("2 why-wrongs missing", "Can't publish · 3 blockers").
- **Focus:** 2px brand outline at 2px offset, on every interactive element.

### Answer option

Full-width row, 56px minimum, 12px radius, 2px border, driven by a `data-state` attribute
(`default` / `selected` / `correct` / `wrong`) that mirrors `aria-checked`. A pill letter badge
sits on the left and fills with the state colour. Correct and wrong states add an icon and a
word ("Correct", "Yours"). The whole row is the target.

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
- **Input:** Surface, 12px radius, 52px, with a visible caption label above — never a
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
