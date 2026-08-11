# Product

<!-- impeccable:product-schema 1 -->

Scope: repo-root product truth, shared by `apps/web`, `apps/api`, and `apps/bot`.

## Platform

web

## Users

**Ethiopian university students preparing for the national exit exam**, served in two
equally-weighted segments (confirmed): **first-time sitters** (final-year students facing
their first sitting) and **retakers** (students who have already failed at least once).
Neither is the beachhead; `User.isRetaker` tunes content emphasis and study-plan shape, it
does not fork the product.

Situation: students arrive stressed, often in the weeks immediately before the exam —
**panic week is the peak usage window**. Predominantly on low-end 5-inch Android phones over
slow, metered networks; many reach the product through Telegram rather than a browser.

Job: _know what I will actually be tested on, find out where I am weak, and fix it before
exam day_ — not merely to drill questions.

Internal users (roles enforced in `Role`): **WRITER** (authors questions), **REVIEWER**
(approves against the publish gate; never their own work), **ADMIN** (operations, payments,
retire).

## Product Purpose

Exit-exam preparation where **every published answer is fully explained** — a one-sentence
concept line, then either prose (CONCEPT) or numbered worked steps (CALCULATION), plus a
per-distractor "why it tempted you." Around that: timed mock exams that mirror the real
sitting, per-topic readiness scored against the official blueprint, and a study plan
counting down to exam day.

Success is a student who can name their weak topics and watch them improve across mock
sittings — not a student who has answered a large number of questions.

## Positioning

Three things a neighboring prep app cannot truthfully copy without doing the same work:

1. **The explanation is the product.** The publish gate
   (`apps/api/src/questions/publish-gate.ts`) makes an unexplained question _unpublishable_:
   exactly one correct option, a `whyWrong` on every distractor, a single-sentence concept
   line, and — for CALCULATION questions — a final step that states the answer choice.
   Reviewer ≠ author. This is enforced in code, not promised in copy.
2. **Readiness is measured against the official MoE blueprint**, so a topic's weight
   ("12% of exam") drives what the student is told to study next.
3. **Access is bound to a sitting, not a calendar** — a subscription expires at exam date
   plus a grace week. There is deliberately no lifetime access.

## Operating Context

- **Two surfaces, one build:** web PWA and Telegram Mini App ship from the same Next.js app;
  a grammY bot carries the daily question, reminders, and referrals.
- **Interface chrome is bilingual EN / አማርኛ. Exam content stays English**, because the exam
  is in English. Only navigation, buttons, and the payment flow translate.
- **Content operations are a permanent workflow, not a launch task.** MoE source material
  arrives as inconsistent files and moves through: clean → parse → stage → enrich → review →
  publish (`CONTENT-PIPELINE.md`). Question lifecycle in code: `DRAFT → IN_REVIEW →
PUBLISHED → RETIRED`.
- **Payment reality:** Chapa (Telebirr / CBE Birr) for automated payment, plus a manual
  "Pay & Share" path where a student pastes a bank/Telebirr transaction reference that is
  ~~verified via verify.et before activation~~ **settled by an operator reading the bank
  statement** (verify.et dropped 2026-08-10). Manual payments sit in an admin queue, and that
  queue is now the permanent path rather than a stopgap.
- **Offline matters.** Students practice from saved questions and sync later.

## Capabilities and Constraints

**Confirmed, built, and non-negotiable:**

- **Answer content is released only on attempt.** `GET /questions/next` never carries
  `isCorrect`, `whyWrong`, `conceptLine`, explanation, or steps; only `POST /attempts` does.
  There is no bulk question endpoint, by design — the question bank is the asset.
- **Fixed answer-view order, nothing behind an extra tap:** verdict → concept line →
  solution → why-wrongs.
- **Taxonomy:** Field → Course → Topic → Question. Question types are `CONCEPT` or
  `CALCULATION` and render differently. Topic blueprint weights must sum to 100% before a
  field can publish.
- **Identity (revised 2026-08-10):** signup stays light (Telegram deep link on web,
  `initData` HMAC inside the bot). ~~Fayda / National ID binds at purchase, stored as a salted
  FIN hash — one FIN, one account — as the anti-sharing control.~~ **Fayda is dropped.**
  Relying-party approval was applied for and never granted, and the product is not waiting on
  it.
  **The anti-sharing control is therefore the device limit alone**, and that is a real
  reduction: two students who trust each other can share one account indefinitely by staying
  under two devices. Whether that is acceptable is a pricing question, not a technical one.
  No legal name is collected at all now, which makes the privacy commitment below trivially
  true rather than carefully maintained.
- **Device limit:** two concurrent sessions; a third login evicts the oldest.
- **Subscription is duration-based (confirmed):** **6 months for Br 500** and **12 months for
  Br 800**, measured from activation, status `PENDING → ACTIVE → REJECTED | EXPIRED`. This
  **supersedes** the schema's per-field `priceEtb` and its exam-date + grace-week expiry, which
  are now legacy and must be migrated.
- **A plan grants the whole product, not one field (confirmed, T-141b).** The price is a
  duration and nothing else — there is no per-field price to charge and never was, since T-020
  omitted the column once D2/D3 landed. Selling per field would mean a student who changes
  programme, or who sits two, pays twice for the same six months; and it would put a paywall
  between somebody and a decision they are still making. `User.fieldId` stays a **study
  choice**, not an entitlement boundary.
- **Exam configuration (confirmed):** a mock sitting is **100 questions in 180 minutes**.
  Per-question pacing budgets are **60 seconds for CONCEPT** and **180 seconds for
  CALCULATION**. Those budgets only reconcile with a 180-minute sitting at a mix of
  **60 concept + 40 calculation**, so that ratio is the sampling target.
- **Free tier** exposes a limited number of questions per field with full answer content;
  the count remaining is surfaced to the student.
- **Gamification:** points, badge tiers (NONE → Bronze/Silver/Gold/Platinum), streak and
  leaderboard mechanics. Points copy always names its source.
- **No Docker.** Dev Postgres is embedded; production is managed Postgres on a VPS. Redis
  arrives with rate limits, leaderboards, and the broadcast queue.

**Launch scope (confirmed this session):** three fields go live — **Computer Science, Public
Health, and Accounting & Finance** — the only three MoE source files with usable answer keys,
so they need explanations and topic tags but not answer authoring. Geography, Economics,
Exit-2015, Biology and Management follow once answers are authored and verified.

**No official exam blueprint exists (confirmed).** The questions were sourced from ministry
past papers, not from a published blueprint document. Therefore:

- Topic weights are **derived** — each topic's observed share of questions across the real past
  papers, normalised to 100 — and a reviewer may override a weight with a recorded reason.
- Student-facing copy says **"share of past papers"**, never "% of exam". The second is a claim
  the product cannot support, and this product's whole position is that it does not make claims
  it cannot defend.
- Readiness-by-topic still ships; it is simply honest about what it is weighted by.

**Resolved:** product name is **Lomi-Test (ሎሚ)**; the existing brand assets stand. `isRetaker`
is captured at signup but **drives no product behaviour for now** — it is reserved for future
segmentation, and no screen may branch on it.

**Explicitly undecided — do not invent:**

- **What a plan grants** — access to the student's own field, or to every field. Pricing is now
  duration-based, so the per-field assumption baked into the schema no longer follows.
- ~~**verify.et** API credentials and the exact response field that authorizes activation.~~
  **Closed 2026-08-10: dropped from scope. Bank transfers settle manually, and always will.**
- ~~**Fayda relying-party approval** from the National ID Program is applied for, not granted.~~
  **Closed 2026-08-10: dropped from scope rather than waited on.**

**Known doc conflict:** `PLAN.md` describes an Express + React/Vite monorepo. The repository
is NestJS + Next.js and considerably further along. Where they disagree, **the repository is
product truth**; PLAN.md is a wish-list to reconcile.

## Brand Commitments

- **Name: Lomi-Test (ሎሚ)** — confirmed. Assets on disk at
  `apps/web/public/brand/lomi-test-{logo,icon,appicon}` stand. _Fetena_ is retired.
- **Voice (confirmed, `MASTER.md` §8):** plain, direct, second person, active. Numbers are
  motivation ("43 days left · 62% ready"). Effort routes to value ("worth 12% of your exam").
  Errors state cause _and_ fix. **Never shame** a wrong answer or a missed day — the
  explanation is the reward for getting it wrong, and a missed day _adjusts the plan_, it
  does not break a streak.
- **Privacy commitment:** no legal name is collected, so none can appear on a public surface.
  Guarded by a test rather than by the absence of a feature — `identity-privacy.e2e.test.ts`
  sweeps every student-reachable route and fails the day an identity field appears.
- **Anti-piracy commitment:** no downloadable or printable content views.

## Evidence on Hand

- `design-system/MASTER.md` v2.0 — tokens, type scale, component contracts, hard bans.
- MoE source material, ~8 fields. Per `CONTENT-PIPELINE.md`: only 3 files have full answer
  keys, **zero** authored explanations exist anywhere, and **no** question carries a topic
  tag. Several fields have no answer key at all.
- `question_import_template.csv` — canonical 16-column import schema with worked examples
  (one CS, one Geography stub, five authored Accounting & Finance VAT questions).
- Brand assets: `apps/web/public/brand/lomi-test-{logo,icon,appicon}`.
- Working code across `apps/api`, `apps/web`, `apps/bot`.

**Absent — must not be fabricated:** no students, no testimonials, no pass-rate data, no
revenue, no press, no institutional endorsement. The MoE relationship described in `PLAN.md`
as a partnership is not evidenced in the repository and must not be claimed on any surface
until confirmed.

## Product Principles

1. **The explanation is the product.** Anything that hides, defers, or truncates the reason
   an answer is right damages the core value. The score is a by-product.
2. **Never show an answer the platform cannot defend.** An unverified answer stays
   unpublished. For an exam-prep product, a confidently wrong answer key is worse than a
   missing question.
3. **Measure readiness against the blueprint, not against volume.** Topic weight decides what
   matters; "questions answered" is not an achievement.
4. **Content trust is an operating loop.** The review queue is a permanent, first-class
   product surface, not launch scaffolding — every future exam cycle runs through it.
5. **Calm under time pressure.** The peak user is stressed and short on time; urgency may be
   informative, never alarming, and never shaming.

## Accessibility & Inclusion

- Real usage scene: low-end 5-inch Android phones, slow/metered networks, high-stress
  moments. Body text never below 16px on mobile; touch targets ≥48dp.
- **Colour never carries meaning alone** — correct, wrong, pending, focus, and deltas always
  pair colour with an icon or word. Badge tiers must differ by _shape_ as well as colour so
  they read in greyscale.
- Contrast floor 4.5:1; no gray-on-gray below it; no hover-only affordances.
- `prefers-reduced-motion` renders final state instantly; nothing decorative animates during
  a timed exam.
- Bilingual EN / አማርኛ chrome with an Ethiopic-capable font fallback so nothing blocks on a
  font download.
