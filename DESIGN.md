---
name: Deresegn
description: Exit-exam prep that feels current and proves its working — modern surface, verifiable underneath.
colors:
  brand: "#5B4BE0"
  brand-hover: "#4A3AD0"
  brand-soft: "#EDEBFF"
  on-brand: "#FFFFFF"
  correct: "#067049"
  correct-soft: "#E3F8EF"
  wrong: "#C22A22"
  wrong-soft: "#FEECEB"
  pending: "#9A6209"
  pending-soft: "#FDF3DC"
  reward: "#8A6200"
  reward-fill: "#F5B301"
  on-reward: "#16162B"
  bg: "#F6F6FB"
  surface: "#FFFFFF"
  surface-2: "#F0F0F7"
  border: "#E3E3EF"
  ink: "#16162B"
  ink-2: "#5B5B75"
  dark-brand: "#8B7CFF"
  dark-brand-soft: "#241F4D"
  dark-on-brand: "#101018"
  dark-correct: "#4ADE9B"
  dark-correct-soft: "#10291F"
  dark-wrong: "#FF8A82"
  dark-wrong-soft: "#331615"
  dark-pending: "#F0B95B"
  dark-pending-soft: "#2B1F0C"
  dark-reward: "#FFD24D"
  dark-bg: "#101018"
  dark-surface: "#191926"
  dark-surface-2: "#232333"
  dark-border: "#2E2E42"
  dark-ink: "#ECECF5"
  dark-ink-2: "#A0A0BC"
typography:
  display:
    fontFamily: "Gabarito, 'Noto Sans Ethiopic', system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 800
    lineHeight: "2.5rem"
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Gabarito, 'Noto Sans Ethiopic', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.875rem"
    letterSpacing: "-0.02em"
  stem:
    fontFamily: "Figtree, 'Noto Sans Ethiopic', system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: "1.8125rem"
  body:
    fontFamily: "Figtree, 'Noto Sans Ethiopic', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.625rem"
  label:
    fontFamily: "Figtree, 'Noto Sans Ethiopic', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Figtree, 'Noto Sans Ethiopic', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: "1.125rem"
    letterSpacing: "0.04em"
rounded:
  control: "12px"
  card: "16px"
  panel: "24px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.control}"
    padding: "14px 24px"
    height: "52px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.on-brand}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 24px"
    height: "52px"
  option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
    height: "56px"
    typography: "{typography.body}"
  option-selected:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.ink}"
  option-correct:
    backgroundColor: "{colors.correct-soft}"
    textColor: "{colors.correct}"
  option-wrong:
    backgroundColor: "{colors.wrong-soft}"
    textColor: "{colors.wrong}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    typography: "{typography.caption}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
    height: "52px"
    typography: "{typography.body}"
---

<!-- Implementation: design-system/tailwind-theme.css is the normative Tailwind v4
     @theme block. These tokens and that file are the same values; update both together. -->

# Design System: Deresegn (ደረሰኝ)

## Overview

**Creative North Star: "Shows Its Working"**

Students choose this product with money they do not have much of, weeks before an exam that
decides whether they graduate. Two things have to be true at once. It has to feel like an app
they *want* to open — as current and as pleasant as anything else on their phone. And it has
to be an app that never lies to them.

So the surface is contemporary and generous: rounded shapes, real elevation, a confident
violet, spring feedback on the moment that matters. Underneath, a set of rules that do not
bend. Every worked solution ends by stating the answer choice. Every readiness figure is the
weighted mean of topics whose shares add to 100. Every point names the thing that earned it.
Every question, payment and user carries an ID a student can read down a phone line. Most of
this is already enforced in the API, in `publish-gate.ts` — the design's job is to make the
rigour visible rather than hide it behind a pretty shell.

Violet leads because the category reaches for green and blue, and because keeping the brand
out of the semantic range lets green mean *correct*, red mean *wrong* and amber mean *pending*
without ever competing with the interface itself. Neutrals are slate with a violet bias, so
nothing reads as unconsidered grey.

**Key Characteristics:**
- The question stem is the largest text on any practice or exam screen. Always.
- Semantic colour never carries meaning alone — an icon and a word travel with it.
- One springy moment (the verdict) and nothing else animates on entrance.
- Gamification is loud but legible: no mystery rewards, no punishment for a missed day.
- Light and dark are both first-class; dark is re-derived, not dimmed.
- 16px body floor, 52px control floor, 56px option rows — a one-handed product used in a hurry.

## Colors

A confident violet brand with a fully separated semantic range, over violet-biased neutrals.

### Primary
- **Brand Violet** (#5B4BE0): the primary action, active navigation, focus ring, and the
  selected-but-unsubmitted answer. In dark it lifts to #8B7CFF so it stays legible on a dark
  ground rather than sinking into it.
- **Brand Soft** (#EDEBFF): selected option fill, the concept card behind every explanation,
  and the student's own row in any list.

### Secondary
- **Correct** (#067049): right answers, verified payments, positive deltas. Tested at 4.5:1
  against both surface and its own soft fill — the earlier, brighter green failed on the fill.
- **Incorrect** (#C22A22): wrong answers, failed verification, the retire action.
- **Pending** (#9A6209): awaiting verification, focus topics, exam timer at 20% remaining.
  Distinct from incorrect because **pending is not failure**.

### Tertiary
- **Reward** (#8A6200 text / #F5B301 fill): streaks, points, badges. The fill always pairs
  with **On Reward** (#16162B), which stays dark in *both* themes — yellow is a fill, never a
  text colour, and never carries white text.

### Neutral
- **Ink** (#16162B): all primary text. Violet-biased, never pure black.
- **Ink 2** (#5B5B75): captions, metadata, secondary copy. Verified ≥4.5:1 on every ground.
- **Background** (#F6F6FB) / **Surface** (#FFFFFF) / **Surface 2** (#F0F0F7): the three
  ground levels. Surface 2 carries wells, step lists, chips and skeletons.
- **Border** (#E3E3EF): 1px hairlines; option rows use 2px so their state reads at a glance.

### Named Rules
**The Separation Rule.** The brand colour is never used to mean correct, wrong or pending, and
a semantic colour is never used for a brand moment. A student must never have to work out
whether violet means "selected" or "right".

**The Yellow Is A Fill Rule.** Reward yellow never sets text and never takes white on top of
it. Ink-on-yellow, in both themes, via the `on-reward` token.

**The Icon And Word Rule.** Every state that matters — correct, incorrect, pending, flagged,
verified, focus — carries an icon *and* a word alongside its colour, so the system survives
greyscale, colour blindness and a cheap screen in sunlight.

## Typography

**Display Font:** Gabarito (with Noto Sans Ethiopic, system-ui)
**Body Font:** Figtree (with Noto Sans Ethiopic, system-ui)

**Character:** Gabarito is warm and geometric with real personality at heavy weights — it
carries the numbers students care about (countdown, score, readiness) without feeling
corporate. Figtree is a highly legible modern UI face that holds up at 15–16px on a low-end
Android screen, which is where nearly all of this product is actually read. Both are variable
and self-hosted via `next/font`; no CDN, no layout shift.

### Hierarchy
- **Display** (Gabarito 800, 34/40, -0.03em): countdown, mock score, readiness. One per screen.
- **Title** (Gabarito 700, 24/30, -0.02em): screen titles.
- **Stem** (Figtree 600, 19/29): the question — the most-read text in the product.
- **Body** (Figtree 400, 16/26): options, explanations, prose. Never below 16px on mobile,
  never truncated, measure ≤70ch.
- **Label** (Figtree 600, 15/20): buttons, tabs, chips.
- **Caption** (Figtree 600, 13/18, +0.04em, uppercase): field labels, blueprint weights, meta.

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
uses the *stated* treatment on Surface 2 instead, with a chip naming how it was derived. A
total nobody can verify is decoration, and this product cannot afford decorative numbers.

## Elevation & Depth

Soft, real elevation. Every shadow carries both an offset and a blur, tinted with the
violet-biased neutral so it reads as depth rather than grey fog.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgb(22 22 43 / .05), 0 6px 16px rgb(22 22 43 / .07)`): the default
  resting surface for cards and tables.
- **Lift** (`0 2px 4px rgb(22 22 43 / .06), 0 12px 28px rgb(22 22 43 / .10)`): device frames
  and anything presented as being above the page.
- **Panel** (`0 4px 8px rgb(22 22 43 / .07), 0 24px 48px rgb(22 22 43 / .16)`): the retire
  modal, bottom sheets.
- **Brand** (`0 2px 4px rgb(91 75 224 / .18), 0 10px 24px rgb(91 75 224 / .22)`): the primary
  button only, so the main action is findable without hunting for it.

In dark, shadows switch to black at higher alpha — a violet-tinted shadow is invisible on a
dark ground and would leave the interface flat.

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
  *and* the fix.

### Navigation
Bottom bar on phones: exactly five labelled destinations, 56px, with the active item's icon
sitting in a Brand Soft pill and its label in brand colour. Labels are never hidden. Desktop
moves the same five to a left rail.

### The destructive control
Emergency retire is the only Danger button and the only modal in the system. Its blast radius
is **itemised** — attempts flagged, live sittings affected, scores recomputed — never
summarised as "this affects many students", because a number an operator can check is what
makes them stop and read.

## Do's and Don'ts

### Do:
- **Do** end every worked calculation on a highlighted step that states the answer choice.
- **Do** make every total verifiable: weights sum to 100, elided rows are shown explicitly, and
  a derived figure uses the *stated* treatment rather than a total bar.
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
