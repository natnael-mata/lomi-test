# Lomi-Test (ሎሚ) — the whole product, in one document

**For:** whoever is designing the new UI/UX · **Date:** 2026-08-15

Everything a designer needs, in one place: what the product is, who uses it, every screen
and the data it carries, the rules the design may not break, the tokens, and what is still
missing. Where a rule came from is named, so you can argue with the source rather than
with me.

---

# Part 1 — The product

## 1.1 What it is

A web app that helps Ethiopian university students prepare for the national **Exit Exam** —
the exam that decides whether they graduate.

Students practise questions with full explanations, sit timed mock exams, see per-topic
where they are weak, and pay for access by the month.

**The promise:** realistic practice plus per-topic feedback, from a product that never lies
to them about how ready they are.

## 1.2 Who uses it

|               | **Student**                                  | **Reviewer**                    | **Admin**                    |
| ------------- | -------------------------------------------- | ------------------------------- | ---------------------------- |
| Who           | University student, final year               | Subject expert                  | Operator / owner             |
| Device        | Low-end Android, 5-inch                      | Laptop                          | Laptop                       |
| Network       | Slow, metered, sometimes off                 | Office                          | Office                       |
| State of mind | Stressed, weeks from an exam, short of money | Careful, checking answers       | Reconciling payments         |
| Wants         | To know what to study next                   | A question that can be defended | Money and content to line up |

**Design for the student on the phone.** Everything else is secondary.

## 1.3 What they buy

**Br 500 for six months · Br 800 for twelve**, counted from the day of purchase. Free tier
is 10 questions. One plan buys **every** programme, not one.

Three programmes at launch: **Computer Science**, **Public Health**, **Accounting &
Finance**.

## 1.4 How they get in

**Telegram only. There are no passwords anywhere in this product.** A student opens a
Telegram link, the bot confirms, they are in. No form, no email, no password reset.

That single decision removes: registration, sign-up, password change, forgot-password,
email verification. Do not design them.

---

# Part 2 — The rules the design may not break

From `PRODUCT.md` and `DESIGN.md`. These are not preferences.

## 2.1 The five that matter most

1. **Never shame a student.** No "you failed", no "you lost your streak", no punishment for
   a missed day. A missed day _adjusts the plan_ and posts a zero-point line saying so. The
   explanation is the reward for getting something wrong.
2. **Colour never carries meaning alone.** Correct, wrong, pending, flagged, verified,
   focus, badge tiers — each carries an **icon and a word** as well. Test it by imagining
   the screen in greyscale on a cheap phone in sunlight.
3. **Every number must be reconstructable from what is on screen.** Weights sum to 100.
   Elided rows are shown as "N other topics". A figure that is derived rather than summed
   uses the _stated_ treatment with a chip naming how it was derived — never a total bar.
4. **The question stem is the largest text on any practice or exam screen.** Not the timer,
   not the score, not the streak, not the brand.
5. **Never show a legal name on a public surface.** Leaderboards and community use
   student-chosen display names only.

## 2.2 The rest, briefly

- **Separation Rule** — brand violet never means correct/wrong/pending, and a semantic
  colour never marks a brand moment.
- **Yellow Is A Fill** — reward yellow never sets text, never takes white on top.
- **Stem Supremacy** — see 4 above.
- **No-Case Rule** — Ethiopic has no upper/lower case. Uppercase captions are Latin-only.
  Ethiopic sets taller and runs longer; any string that must hold one line is **authored per
  language**, not translated in place.
- **Tabular Rule** — anything compared, summed or timed uses tabular figures.
- **One Brand Shadow** — the brand-tinted shadow belongs to the primary action alone.
- **No decoration** — no confetti, no celebration sounds, no mascot, no emoji anywhere
  including bot messages. A student who got 19 of 60 wrong should not sit through 37
  parties.
- **Nothing animates on entrance** except the verdict and the explanation that follows it.
- **Nothing printable or downloadable** — the question bank is the only asset.

---

# Part 3 — The design system as built

Change any of this freely — it is recorded so you know what exists, not to constrain you.

## 3.1 Colour

| Role                                 | Light                             | Note                                                                               |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------- |
| **Brand Violet**                     | `#5B4BE0`                         | Primary action, active nav, focus ring, selected answer. Dark: `#8B7CFF`           |
| **Brand Soft**                       | `#EDEBFF`                         | Selected option fill, concept card, your own row                                   |
| **Correct**                          | `#067049`                         | Right answers, verified payments                                                   |
| **Incorrect**                        | `#C22A22`                         | Wrong answers, the retire action                                                   |
| **Pending**                          | `#9A6209`                         | Awaiting verification, focus topics, timer at 20% left. **Pending is not failure** |
| **Reward**                           | `#8A6200` text / `#F5B301` fill   | Streaks, points, badges. Always with `on-reward` `#16162B`                         |
| **Ink**                              | `#16162B`                         | All primary text. Violet-biased, never pure black                                  |
| **Ink 2**                            | `#5B5B75`                         | Captions, metadata                                                                 |
| **Background / Surface / Surface 2** | `#F6F6FB` / `#FFFFFF` / `#F0F0F7` | Three ground levels                                                                |
| **Border**                           | `#E3E3EF`                         | 1px hairlines; option rows use 2px                                                 |

Violet leads because the category reaches for green and blue — keeping the brand out of the
semantic range lets green mean _correct_ without competing.

Light and dark are both first-class. Dark is **re-derived, not dimmed**.

## 3.2 Type

**Display:** Gabarito · **Body:** Figtree · **Amharic:** Noto Sans Ethiopic. Self-hosted,
no CDN, no layout shift.

| Style   | Spec                                   | Use                                                        |
| ------- | -------------------------------------- | ---------------------------------------------------------- |
| Display | Gabarito 800, 34/40, -0.03em           | Score, readiness. **One per screen**                       |
| Title   | Gabarito 700, 24/30, -0.02em           | Screen titles                                              |
| Stem    | Figtree 600, 19/29                     | The question — the most-read text in the product           |
| Body    | Figtree 400, 16/26                     | Options, explanations. **Never below 16px.** Measure ≤70ch |
| Label   | Figtree 600, 15/20                     | Buttons, tabs, chips                                       |
| Caption | Figtree 600, 13/18, +0.04em, uppercase | Field labels, metadata (Latin only)                        |

## 3.3 Shape, elevation, spacing

- **Radius:** 12px controls/inputs/option rows · 16px cards/wells · 24px sheets/modals ·
  full pills on chips, badges, progress tracks
- **Shadows:** Card (resting) · Lift (above the page) · Panel (modal, sheet) · **Brand**
  (primary button only)
- **Spacing:** 4/8/12/16/20/24/32, more space above a heading than below
- **Touch:** ≥44px targets with ≥8px between · controls 52px · answer rows 56px
- **Icons:** 2px-stroke rounded-join outlines on a 24px grid. Never emoji

## 3.4 Layout

- **Student content: 640px measure on desktop**, fills the viewport on a phone
- **Admin: 1200px**, and permitted real tables
- Screens are **cards on a tinted ground**, never full-bleed sections. Cards are never
  nested. A card is never just a border round a paragraph
- Wide content scrolls **inside its own container** — the page never moves sideways

## 3.5 Navigation

**Exactly five destinations.** Bottom bar on phones (56px), left rail on desktop. **Labels
are never hidden.** The active item takes a Brand Soft pill _and_ a brand-coloured label.

Today: Practise · Mock · Progress · Standing · Access.

---

# Part 4 — Every screen

What each one does, the data it carries, and the states it must handle.

## 4.1 Home `/`

A hub. One tap to each destination, each with a sentence saying what it is.

- **Data:** whether signed in; access expiry or free-tier status
- **States:** checking · signed out (explains Telegram sign-in) · signed in

## 4.2 Choose your programme `/choose`

**First run.** Picks the field that scopes every question. Also asks the one onboarding
question: have you sat the exam before?

- **Data:** published programmes; retaker yes/no (may stay unanswered)
- **States:** loading · list · empty · saving · error
- **Rule:** says the choice is reversible, and says _why_ the retaker question is asked —
  a question with no visible consequence reads as data collection unless explained

## 4.3 Practice `/practice`

The core loop. One question, answered, explained, next.

- **Before answering:** stem, options A–D, topic attribution, code block if any
- **After answering:** verdict → concept → solution → why-wrongs (see 4.4)
- **Also:** free questions remaining; session summary at the end
- **States:** loading · asking · answered · out of free questions · paywalled · error
- **Rule:** **no answer content reaches the browser before the student answers**

## 4.4 The explanation — the signature component

Fixed order, nothing behind an extra tap:

1. **Verdict** — icon, word ("Correct" / "Not quite"), time against the limit in tabular
   figures. Over the limit reads **Pending** and is framed as pacing, never failure
2. **Concept** — one sentence naming what was tested, on Brand Soft
3. **Solution** — prose for CONCEPT; a numbered step list for CALCULATION whose **final
   step is highlighted and states the answer choice** ("= 150,000 → answer B")
4. **Why-wrongs** — one card per distractor, the student's own choice first and tinted,
   framed as "why it tempted you"

## 4.5 Mock exam `/exam`

100 questions, 180 minutes, sat once through.

- **Data:** timer, question position, jump grid (answered/flagged per slot), flag control
- **No feedback during the exam.** Nothing is marked until submit
- **States:** intro · in progress · submitting · timed out · review
- **Rule:** the timer must never be larger than the stem. At 20% remaining it goes Pending

## 4.6 Progress `/progress`

Where the student is weak.

- **Data:** readiness percentage (weighted mean), per-topic rows with the topic's share of
  past papers, weakest topic, mock score trend
- **States:** loading · no data yet · ready · no programme chosen
- **Rules:** weights sum to 100 including an explicit "N other topics" row · rows below the
  pass-safe line take Pending and a Focus chip · every statement ends in a practice action ·
  copy says **"share of past papers"**, never "% of exam"

## 4.7 Standing `/standing`

Points, streak, tier, leaderboard — one screen, because they answer one question.

- **Data:** total points, days practised, tier badge, distance to next tier, recent point
  rows each with its reason, board rows with rank/name/tier/points
- **States:** loading · ready · empty board · opted out · error
- **Rules:** every point row says **why** · the streak has no way down · badge tiers differ
  by **shape** as well as colour · opting out hides the row but **never** the rank

## 4.8 Access / checkout `/checkout`

Four ways to pay, flat on one screen — not three plus a "more" menu.

1. **telebirr** — USSD push to the handset
2. **CBE Birr** — the same
3. **Card or another wallet** — opens the Chapa page
4. **Bank transfer** — pay from any bank, paste the reference

- **Data:** plans with per-month maths and best-value marker; phone number or reference
- **States:** choosing · sending · waiting for the phone · slow · confirmed · submitted ·
  unavailable · error
- **Rules:** each option says what will happen _before_ it is chosen · the client never
  decides a payment succeeded · a bank transfer grants nothing until a person checks

## 4.9 Community `/community/[topicId]`

Ask about a topic. Threads scoped to the student's own programme.

- **Data:** threads with reply counts; a thread with replies; verified badge on reviewer
  replies; report control
- **States:** list · thread · empty · posting · rate-limited · no programme
- **Rules:** the verified badge says what it means · a hidden post tells its own author ·
  reporting queues, it does not delete

## 4.10 Admin

| Screen             | Does                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin/dashboard` | Signups broken into four buckets that **sum to the total**, revenue by payment method footing to a total, student search by phone/name/reference |
| `/admin/import`    | Upload a CSV of questions; per-row report with line numbers and reasons                                                                          |
| `/admin/weights`   | Topic weights, derived vs override, running total that names the shortfall                                                                       |

**Admin gets 1200px and real tables.**

## 4.11 Testing door `/dev-login`

Four buttons — three students and an admin — because there is no password. **Delete before
launch.**

---

# Part 5 — What is not built

Design these.

| Missing               | Notes                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| **Sign-in screen**    | The API is complete: mint a link, show a pairing code, poll, land signed in. Only the screen is missing |
| **Payment approval**  | An operator must approve or reject a claimed bank transfer, with a reason. APIs exist                   |
| **User management**   | Deactivate, reactivate, reset devices. APIs exist                                                       |
| **Payment receipt**   | The reference shows once and is then gone. No receipt, no payment history                               |
| **Phone-app install** | Needs the brand icons                                                                                   |

**Deliberately absent — do not design:**

- **Password, profile, change password** — no passwords exist
- **Exam-day countdown** — no sitting date has been supplied; inventing one would put a
  false number on screen

---

# Part 6 — Constraints

- **The real device is a low-end 5-inch Android** on a slow, metered, sometimes-absent
  connection, held by somebody stressed
- **Two languages, both first-class.** Amharic sets taller and runs longer than English —
  any string that must hold one line is authored per language
- **Light and dark both first-class**
- **Contrast floor 4.5:1**, no hover-only affordances, `prefers-reduced-motion` renders the
  final state instantly
- **Nothing decorative animates during a timed exam**
- **First-load JavaScript budget: 300 KB gzipped.** Currently ~112 KB

---

# Part 7 — Where things stand

**Built and working:** the question bank and its publish gate, practice with explanations,
mock exams with review, per-topic results, four payment methods, subscriptions, admin
dashboard and question upload, points/streaks/badges/leaderboard, community, navigation,
programme choosing.

**Tests:** 1,011 API · 490 web · 33 bot, all passing.

**The launch blocker is content.** The three real programmes have no questions yet. The
engine is built; the bank is empty.

**A caution about the task count.** `TASK.md` reads 187 of 197, and for most of the build it
counted **API-only** work — sign-in, navigation, the programme choice and the admin upload
were ticked or assumed while their screens did not exist. Treat that number as a measure of
tasks, not of whether a student can use the product.

|       |                                     |
| ----- | ----------------------------------- |
| Local | http://localhost:3100               |
| Live  | https://lomi-test.app.aletcloud.com |
| Code  | github.com/natnael-mata/lomi-test   |
