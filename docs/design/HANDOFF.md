# Design handoff — Lomi-Exam

Every design decision taken in the session of **2026-08-20**, in one place, so the next
designer or agent does not have to re-derive them. Where a decision reverses something
already written down, the reversal is named and the reason given.

**Status key** — `SHIPPED` is in the codebase and tested. `DESIGNED` has a rendered
specimen but no implementation. `OPEN` needs a decision from the owner before it can be
built.

---

## 1. Identity

`SHIPPED` The product is **Lomi (ሎሚ)**. ሎሚ means _lemon_, and the palette is the name
rather than a colour chosen and then justified: cream pith, forest leaf, lemon flesh.

`OPEN` The rename to **Lomi-Exam** is agreed in principle but not applied. It touches
`package.json`, the workspace names, `PRODUCT.md`, the brand assets in
`apps/web/public/brand/` and the bot handles. Do it as one commit.

The rename matters structurally, not cosmetically: it makes the top-level object an **exam
programme** rather than one exam, which is what lets Grade 6, Grade 8, Grade 12 and the
university exit exam sit side by side.

---

## 2. Colour

`SHIPPED` Replaces Deresegn v3 (violet). Normative values live in
`design-system/tailwind-theme.css`; this table is the reasoning behind them.

| Token            | Value                 | Why                                          |
| ---------------- | --------------------- | -------------------------------------------- |
| `bg`             | `#FCFAF5`             | Cream paper. The ground.                     |
| `surface`        | `#FFFFFF`             | A sheet laid on it.                          |
| `surface-2`      | `#F1EFE8`             | Wells, chips, code.                          |
| `border`         | `#DFDBD0`             | Hairline. **Never text.**                    |
| `ink`            | `#1A3300`             | Forest. 13.27:1 on bg.                       |
| `ink-2`          | `#46603A`             | Captions. 6.72:1.                            |
| `brand`          | `#FFE95C`             | Lemon. **A fill — never text.**              |
| `brand-soft`     | `#FFF6C4`             | Selected, active nav, your own row.          |
| `on-brand`       | `#1A3300`             | Ink on lemon, 11.24:1.                       |
| `correct` / soft | `#0F5F63` / `#DDF0F0` | **Teal, not green.**                         |
| `wrong` / soft   | `#A3300F` / `#FBE0D6` | Terracotta, darkened.                        |
| `pending` / soft | `#4A4A46` / `#EDEBE4` | **Pencil.**                                  |
| `reward` / fill  | `#6B2D78` / `#F6D0FF` | Plum.                                        |
| `on-state`       | `#FCFAF5`             | Cream, for text on any **solid** state fill. |

### The three findings that shaped it

**The lemon cannot set text.** 1.23:1 on cream. `bg-brand` + `text-on-brand` is the only
correct pairing. A darkened amber accent was tried and rejected: no value clears 4.5:1
while staying 45° from both the forest ink (89°) and the terracotta of `wrong` (13°) — the
lemon sits between them on the wheel, so an amber label reads as an error state. Where a
brand-coloured label used to go, use **ink at 600 over `brand-soft`**.

**Green cannot mean correct, because the ink is green.** A conventional correct-green sits
13° of hue from `ink` and 2.12:1 against it — on a mint fill the verdict and the paragraph
around it are the same colour. Correct moved to teal, 93° off.

**Pending is pencil, not amber.** Amber is the lemon's neighbour. Graphite is achromatic
so it separates from every hue at once, and _pending is not failure_ — nothing provisional
should carry an alarm colour.

Every state clears 4.5:1 on `bg`, on `surface` **and** on its own soft fill. Pinned in
`apps/web/components/contrast.test.ts`, which also asserts `brand` never appears as a
foreground.

---

## 3. Type

`SHIPPED` Display **Archivo 700/800**, body **Inter**, Amharic **Noto Sans Ethiopic**. All
self-hosted in `apps/web/app/fonts/`; `next/font/google` stays banned.

Archivo stands in for **Bricolage Grotesque**, which the visual direction names but which
is not obtainable on the build machine. Swap it by dropping the woff2 beside the others and
changing `src` in `app/fonts.ts`.

**No mono face ships to students.** The direction names one for captions; a third Latin
download on a metered connection is a real cost to a student, and weight plus letter-spacing
carries the caption role. Desktop-only surfaces (the operations console, marketing) may use
one.

Display tracking is **negative** in product (`-0.02em`). The source style's `+0.04em`
poster tracking belongs to marketing only — on a dense screen it reads as shouting.

---

## 4. Shape and depth

`SHIPPED` Radii dropped from 12/16/24 to **6/8/14**. Paper is cut, not moulded; a ledger
has square corners. The 999px pill is unchanged — chips are meant to be capsules.

Cards carry a **hairline plus a 1px lift**, not a soft blur. On cream a blur reads as fog,
and a page of blurred rectangles is most of what makes a dense screen look unresolved.

Shadows are tinted with the forest ink, not violet-biased slate. `--shadow-brand` is **ink,
not lemon**: a yellow glow under a yellow button is a halo, and lemon at any alpha
disappears on cream.

Focus is a **2px ink ring**, never the lemon. An outline nobody can see is not a focus
indicator.

Single-line inputs cap at **34rem**. Past that the caret sits far from the eye. Override
with `max-w-none` where the content genuinely needs width — the CSV paste area does, and
says so in place.

---

## 5. One theme

`SHIPPED` **There is no dark mode.** Both declarations, the `.dark` class and the
`@custom-variant`, are removed, along with `ThemeToggle`.

Paper is one object; a dark sheet of paper is a different one. Restoring it means
re-deriving every semantic hue on a dark ground, not inverting these. Nothing in the app
read a dark token — there were zero `dark:` utilities across 86 components — so the palette
was the only thing that ever changed.

---

## 6. Measures

`SHIPPED` Decided once in `components/AppShell.tsx`, never per page.

| Measure           | Width  | Applies to                |
| ----------------- | ------ | ------------------------- |
| Student (reading) | 640px  | practice, exam, checkout  |
| Student (data)    | 960px  | `/progress`, `/standing`  |
| Admin             | 1200px | `/admin/*`, `/provider/*` |

**A measure governs prose, not figures.** The 640px exists to hold running text near 65
characters. Readiness and standing contain no running text — a headline figure, a weighted
table, a trend — and at 640px on a 1512px laptop they used 42% of the width and ran 1254px
tall for content that fits one screen. Measured before the change; 691px after.

Pinned in `components/layout-measure.test.ts`, which asserts the code agrees with the
number stated in `DESIGN.md` and that the data measure applies to exactly those two routes.

---

## 7. Named rules

`SHIPPED`

- **The lemon is the highlighter.** It marks the takeaway in a worked solution and fills the
  primary action. It never carries a state and never sets text.
- **The separation rule holds.** Brand never means correct, wrong or pending. Every state is
  ≥60° of hue from the ink and from every other state, or achromatic.
- **Pending is written in pencil.** No alarm colour on anything provisional.
- **Icon and word travel with colour.** Every state carries a word and a shape, so the system
  survives greyscale and a cheap screen in sunlight.
- **Colour never carries meaning alone.** Active navigation is ink at 600 plus the wash, not
  a colour. `DESIGN.md`'s "label in brand colour" is retired.

---

## 8. Exam tracks

`OPEN` — schema work not started.

| Track            | Field         | Exam draws on | Year columns |
| ---------------- | ------------- | ------------- | ------------ |
| Grade 6          | one           | grades 4–6    | 3            |
| Grade 8          | one           | grades 7–8    | 2            |
| Grade 12 Natural | one           | grades 9–12   | 4            |
| Grade 12 Social  | one           | grades 9–12   | 4            |
| University exit  | one per field | —             | 0            |

The existing `Field → Course → Topic → Question` taxonomy already fits: **Field** is the
track, **Course** is the subject, and `Field.examDate` already carries the countdown.

**Two additions are required.**

`sourceGrade` **on Question** (9/10/11/12, 7/8, 4/5/6, null for exit). This is the single
highest-value column in the whole design: it lets the product say _"your weakness is Grade
10 Chemistry"_ rather than _"your weakness is Chemistry"_. One is an instruction — go and
get that textbook — the other is a shrug. **Add it to
`docs/question_import_template.csv` before more spreadsheets are uploaded.** Retrofitting
it across a filled bank is the expensive version.

**Grade 12 is two Fields, Natural and Social.** One package would put Geography and History
in a Natural candidate's denominator, so their coverage figure would be permanently wrong.

**A hard-coded four-column year grid is wrong on three of the four tracks.** The diagnostic
must read its column count from the track's own year span.

`OPEN` **Pricing.** `PRODUCT.md` T-141b is confirmed: a plan grants the whole product,
priced by duration only (Br 500 / 6 months, Br 800 / 12 months). "Grade 12 package" reads
like per-grade pricing, which reverses it. The recommendation is to keep the pricing
decision and make the grade a **study choice** — `User.fieldId` already works this way.
School-track prices are not set.

---

## 9. Progress

`DESIGNED` — specimen rendered, not implemented.

**Coverage replaces the weighted mean as the headline.** Of the N questions in your
package, you have beaten M. Target **80%**, drawn as a bar _on_ the ring so the goal is
visible before it is reached.

**"Beaten" is not "answered correctly."** A question counts only when the student answered
it correctly **and** named the reason. This is the guard against the bank problem: the
Ethiopian exam is drawn from a question bank, so questions repeat — sometimes verbatim,
sometimes with the numbers changed. A student who memorises the letter passes the app and
fails the exam. The second half uses content that already exists: show the concept line
among plausible alternatives drawn from the why-wrongs.

**The daily target is derived and is the only figure that moves on its own.**

```
perDay = ceil( (ceil(total × 0.80) − beaten) ÷ daysToExam )
```

At the September start that is 3 a day; in May it is 24. That table is the strongest
argument for selling in September, and it is division a student can check.

**Put a floor under it.** Three questions is five minutes at the stated pacing budget — too
small to build a habit, and the app telling a student "today is closed" after five minutes
is the engagement problem. A minimum session of roughly 12 turns the message from _done_
into **"you are 9 ahead of pace"**, which is a better feeling and front-loads coverage.

**The streak never breaks** (existing rule, honoured). A missed day re-plans tomorrow's
number; it does not reset anything. A rest day renders as counted. This removes loss
aversion deliberately — the daily target is the pressure, and it is honest pressure.

**Points name their source** (existing rule, honoured), including behaviour worth
rewarding: _"Grade 10 Chemistry — first question in nine days."_

---

## 10. Leaderboard

`DESIGNED`

**Two bands.** Grade 6–8 on one, Grade 12 and the exit-exam fields on the other. An
eleven-year-old is never ranked beside a university student.

**Ranked by coverage percentage, not points.** A Grade 12 package holds 3,900 questions and
a Grade 6 package 1,310 — a points board ranks the package, not the student. Share of your
own bank is the only figure comparable across tracks.

**Weekly is the default; all-time is a footnote.** An all-time board is decided by January:
the top places go to whoever subscribed first and nobody joining later can reach them. A
weekly board is winnable every Monday.

**Junior students are opt-in, senior students opt-out.** This inverts T-194 for minors on
purpose — the safe default for a child is not to appear. _This is a decision the owner
should make consciously rather than inherit._

`OPEN` Does the university exit exam share the senior board with Grade 12, or get its own?

---

## 11. Mock history

`DESIGNED` Every sitting is kept and openable, not just the trend.

Each sitting renders a three-part bar — **correct / wrong / left blank** — always summing
to the paper's 100 questions.

The split is the point. A sitting reading **28%** where only 62 questions were attempted is
**45% of what was attempted**, with 38 blank. Those are opposite diagnoses: one is
knowledge, one is pacing, and a bare score tells you neither.

Copy says **"left blank"**, never "ran out of time" — a paper submitted early leaves blanks
too, and the figure cannot tell the difference. This preserves the existing
`unansweredInMocks` reasoning.

Between-sitting movement is shown, and small changes are labelled **within normal
variation** rather than dressed up as a decline. Three points across 40 questions is one or
two answers. Flagging noise as failure is how a product that promises never to shame ends
up doing it with a chart.

---

## 12. Sign-up (reversal)

`OPEN` — replaces the Telegram-first flow.

**Phone number → SMS OTP → set password → sign in → choose track → practise.** Profile
(name, school, region, city, wereda, gender) is collected **after** the student has used the
product, not before.

`User.phone` and `User.phoneVerifiedAt` already exist. `displayName` (public) and `name`
(private) already exist — the split this needs is already modelled. Missing: `passwordHash`,
the profile fields, and an OTP table.

### Four things that must go with it

**Link Telegram, do not replace it.** Make the phone the identity and Telegram a linked
channel. Deleting it discards a finished phase — the Mini App, the daily-question bot,
referrals — and the best account-recovery path there is. Phone-plus-password means a student
who changes SIM otherwise loses everything.

**Do not block practice on the profile.** A wall of personal questions before the first
question is a conversion killer and contradicts "signup stays light". Ask when the profile
buys something: joining the school leaderboard, or sitting a first mock.

**Collect less from children.** Region plus school supports every analysis and every
leaderboard worth building. Wereda-level address on an eleven-year-old is precise location
data on a minor, and for Grade 6 and 8 the consent is the parent's, not the student's. Take
wereda on senior tracks only.

**SMS is a cost centre and the top abuse vector.** Per-phone and per-IP rate limits, a
resend cooldown, an attempt cap per code and a short expiry — before this ships. An
unthrottled send endpoint is how an SMS balance disappears overnight.

### The privacy commitment breaks quietly

`PRODUCT.md` says _"no legal name is collected, so none can appear on a public surface,"_
and calls `identity-privacy.e2e.test.ts` the guard. That test forbids exactly five strings:

```
verifiedName, verified_name, faydaFin, fayda_fin, rawFin
```

All Fayda-shaped. Adding `name`, `schoolName`, `region`, `wereda` and `gender` **will not
fail it.** The commitment becomes false while the guard stays green — the exact failure mode
this codebase is built to prevent.

**Extend `FORBIDDEN` to the new fields in the same commit.** The leaderboard renders
`displayName`; the guard has to be what stops `name` ever reaching it.

---

## 12a. English only (reversal)

`SHIPPED` — owner decision, 2026-08-20. Reverses `PRODUCT.md`'s _"Interface chrome is
bilingual EN / አማርኛ"_.

The exam is set in English, so the product is: questions, worked solutions and the
interface around them.

**This removed less than it appears to.** The dictionary's own comment said so:

> Nothing here is user-visible in Amharic yet — there is no locale switcher, and
> `DEFAULT_LOCALE` is English

There was no switcher anywhere. `copy()` always returned `en`. So what went was **~726
lines of unreviewed first-draft translation that no student could ever reach**, waiting on
a native review that is no longer coming.

What changed:

- `dictionary.ts` — the `am` export deleted; 1626 lines to 913.
- `lib/i18n/index.ts` — `Locale`, `LOCALES` and `DEFAULT_LOCALE` gone. `copy()` keeps its
  call signature rather than collapsing to a constant, so a second language later means
  adding a dictionary rather than editing eighty components.
- `app/fonts.ts` — the Ethiopic face removed. **This is the real win: 198KB, larger than
  Archivo and Inter combined, downloaded by every student on first load so that one logo
  glyph could render.** The bundled font payload went from 275KB to 77KB.
- `Logo.tsx` — the mark was `ሎሚ` in Noto Sans Ethiopic and is now a Latin `L`. It was the
  only thing in the product that required Ge'ez coverage. Wordmark renamed to `Lomi-Exams`.
- `tailwind-theme.css` — `--font-mark` points at the display face; the Ethiopic fallback
  is gone from every stack.
- `DESIGN.md`'s **No-Case Rule** (uppercase captions switch off on Amharic strings, because
  Ge'ez has no case) is dormant. It is not wrong, it simply has nothing to act on.

Two guards replaced the ones that were removed. `ships exactly one language` reads
`dictionary.ts` as source and fails if a second `export const` appears — deliberately
catching a dictionary that is declared but not yet imported, which is the half-finished
state that would otherwise ship. `carries no Ethiopic text` fails if Ge'ez re-enters the
English copy and quietly reintroduces the font requirement.

Interpolation stays a function rather than a `{0}` placeholder. That reason is dormant,
not gone: a placeholder format would have to be unpicked string by string if a second
language ever arrives, and the function costs nothing meanwhile.

`OPEN` The marketing site is already English only. Nothing else references Amharic.

---

## 12b. Sign-in, OTP and password reset

`DESIGNED` — specimen rendered, nothing built.

**This was missing from §12 and it is the half that matters.** The sign-up path is four
screens and an afternoon; the recovery path is what a locked-out student meets, and phone
plus password makes lockout _more_ likely than the Telegram pairing it replaces — a student
who changes SIM has no route back at all unless one is designed.

`SignInScreen.tsx` currently states, in its own docstring:

> There is no password field here and there never will be … verification and password reset
> do not exist in this product

Both sentences were true of Telegram pairing. **Neither survives this change**, and the
docstring must be rewritten rather than left to mislead the next reader.

### The flow

`Sign in (phone + password)` → `Forgot password?` → `Your number` → `Verify code` →
`New password` → signed in.

Sign-up reuses `Verify code` and `New password` unchanged — one flow to build, one to test.
Saving the new password signs the student in; a student who has just proved the number
should not then be asked to sign in with it.

### The states, which are the actual design

| State           | What it says                                                                          |
| --------------- | ------------------------------------------------------------------------------------- |
| Wrong code      | "That code does not match. **2 tries left**, or send a new one."                      |
| Expired         | "Codes last ten minutes… **Nothing is wrong with your account.**"                     |
| Locked          | "Locked for 15 minutes… you can try again at **14:32**." A clock time, never "later". |
| Lost the number | Recover through Telegram, or message support.                                         |

Two rules carried from the product's voice. The **remaining try count is stated** — a
student who does not know how many tries are left cannot decide whether to guess again. And
**expiry is a rule, not a fault**: the copy never implies the student broke something.

### Server limits this assumes

| Rule             | Value      | Why                                                             |
| ---------------- | ---------- | --------------------------------------------------------------- |
| Code length      | 6 digits   | A million combinations against a 3-try cap.                     |
| Expiry           | 10 minutes | A code left in a shared inbox is dead.                          |
| Tries per code   | 3          | Then the _code_ dies, not the account. A new code is free.      |
| Resend cooldown  | 60 s       | Each SMS costs money. Shown as a live timer, not a dead button. |
| Sends per number | 5/hour     | Stops one number burning the SMS balance.                       |
| Sends per IP     | 20/hour    | Stops one script doing it across many numbers.                  |
| Lockout          | 15 minutes | Stated as a clock time.                                         |

### Two things to decide before it is built

**An OTP that can reset a password can take over an account.** Reset is not a convenience
bolted onto sign-in, it is a second equal front door, and every limit above applies to it
identically. A generous reset path beside a strict sign-in is the same as having no sign-in.

**Enumeration is handled asymmetrically, on purpose.** Reset never confirms whether a number
is registered — that would let anyone check who your students are. Sign-up _does_, because a
student blocked by a number they already own with no way to find out is simply stuck, and
rate limits are the real control there. If that trade is wrong, it is the owner's call.

**Children reset through a parent.** A Grade 6 account lives on a parent's phone, so the code
reaches the parent. Copy cannot assume the reader owns the account.

---

## 13. Security

`OPEN`

**Delete `POST /auth/dev-login`** (T-206a, already a launch blocker). It is an
authentication bypass that lists every persona as a button. It was used twice during this
session to reach the admin console without a password.

**Rate-limit the question endpoint.** `PRODUCT.md` lists Redis rate limits in future tense,
so today one valid subscription can walk the entire bank — stems, concept lines, worked
solutions, every why-wrong — through the normal API at any speed. You built no bulk endpoint
precisely to prevent this and then left the retail door open.

This matters more since the bank-repeat fact: if the exam is drawn from a bank, a complete
verified explained copy of it is the most valuable study artifact in the country, and the
thing most worth stealing.

A velocity cap is also better **anti-sharing** than the device limit, because it targets the
behaviour that costs money. Two friends sharing an account answer 40 questions a day; a
scraper answers 4,000.

**Reconsider the device limit for school tracks.** Two concurrent sessions punishes a
household with two children on one phone — the best customer, not an abuser.

**Watermark explanations with the student's own handle.** The leak channel in Ethiopia is a
screenshot pasted into a Telegram group, not a printer, and screenshots cannot be blocked on
Android. A faint handle does not stop the first screenshot; it stops the habit. Uses
`displayName`, so it stays inside the privacy commitment.

---

## 14. Content strategy consequence

`OPEN` The exam is drawn from a question bank, so questions repeat — verbatim or by
pattern. That changes the upload priority: **breadth beats depth.** Every past paper present
with a serviceable explanation serves a student better than three papers with beautiful
ones.

That contradicts the current launch scope of "three launch fields fully reviewed" and should
be recorded as a decision, since the repository is product truth and this fact currently
exists only in conversation.

---

## 15. What is not designed

- The remaining admin screens — `/admin/review`, `/admin/payments`, `/admin/weights` and the
  two provider screens are still single stacked columns at 1200px. `/admin/dashboard`,
  `/admin/users` and `/admin/import` have been done and are the pattern.
- The sign-up screens themselves.
- The parent weekly summary (an engagement and renewal mechanism for Grade 6 and 8, where
  the parent is the buyer).
- School and class leaderboards. Blocked until school names are collected — which the new
  sign-up flow would provide.
