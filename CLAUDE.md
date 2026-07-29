# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state: no application code exists

This repository contains governing documents only. The monorepo has not been scaffolded yet.

**Start at `TASK.md`.** It is an ordered backlog of 177 micro-tasks, each with its own test.
Phase 0 (T-001…T-017) creates the monorepo, the apps, the toolchain and the scripts. Every
command listed below is *created by Phase 0* and does not work before then.

Working protocol, from `TASK.md`:

1. Take the next unchecked task. Do not skip ahead or batch.
2. Implement only what that task describes — the next task probably covers what you were about
   to add.
3. Run the task's `**Test:**` command exactly as written.
4. Only if it passes, change `- [ ]` to `- [x]` and append ` ✅ <date>`.
5. Commit with the task ID: `git commit -m "T-042: add publish gate why-wrong check"`.

Never tick a box you have not actually run the test for. A task marked `BLOCKED` needs a human
decision — stop and ask rather than guessing.

## Commands (after Phase 0)

```bash
npm run db:dev          # embedded Postgres, no Docker; keep running in its own terminal
npm run prisma:migrate  # apply schema changes
npm run db:seed
npm run dev:api         # :4000
npm run dev:web         # :3000
npm run dev:bot         # long-polling; needs TELEGRAM_BOT_TOKEN
npm run build           # all workspaces
npm test
npm run typecheck       # tsc --noEmit
npm run lint            # zero warnings
```

Single test: `npm test -- <pattern>` (e.g. `npm test -- publish-gate`), or scoped to a
workspace with `npm test -w apps/api`.

**Baseline rule:** `test`, `lint`, `typecheck` and `build` must all be green before any task is
ticked. A red baseline makes every later task's test meaningless.

## Architecture

npm workspaces. **One backend, one database, two frontends.**

- `apps/api` — NestJS + Prisma + PostgreSQL. The only source of truth. Owns auth, the question
  bank, the exam engine, scoring, payments.
- `apps/web` — Next.js + Tailwind v4. Serves **both** the web PWA and the Telegram Mini App
  from one build; the surface is detected at runtime. Only the shell differs (auth, chrome,
  navigation, notifications) — the exam engine, scoring and admin are identical.
- `apps/bot` — grammY. A thin layer over the API for the daily question, reminders and
  referrals. It holds no business logic.

`docs/PLAN.md` §6 suggests Express/Fastify and Vite. It is **superseded**; where any document
disagrees with `TASK.md` on stack, `TASK.md` wins.

### Question taxonomy

`Field → Course → Topic → Question`, with `Option` (A–D) and `Step` (for CALCULATION
questions). Everything hangs off this: per-topic results, exam sampling and readiness all roll
up through it. Questions are `CONCEPT` or `CALCULATION` and render differently.

Lifecycle: `DRAFT → IN_REVIEW → PUBLISHED → RETIRED`. Only `PUBLISHED` is ever served.

## Invariants — breaking these breaks the product

These are not style preferences. Most have a test in `TASK.md` that must never be deleted.

**The question bank is the asset.**
- `GET /questions/next` must never contain `isCorrect`, `whyWrong`, `conceptLine`,
  `explanation` or `steps`. Only `POST /attempts` returns answer content (T-106).
- No bulk question endpoint may exist (T-107).
- No printable or downloadable view of question content.

**Never show an answer the product cannot defend.** The publish gate (`apps/api`, mirrored
client-side for live feedback only — the server copy is authoritative) rejects a question
unless: exactly one correct option; a `whyWrong` on every distractor; a single-sentence concept
line; for CALCULATION, a final step that states the answer choice ("→ answer B"); and
reviewer ≠ author.

**Numbers must be checkable.** Topic weights sum to 100 and a readiness figure is the weighted
mean of the rows shown — with an explicit "N other topics" row when rows are elided. A figure
that is derived rather than summed must not be dressed as a total.

**There is no official exam blueprint.** Weights are *derived* from each topic's observed share
of past papers. Student-facing copy says **"share of past papers"**, never "% of exam" — the
second is a claim the product cannot support (T-097a lints for it).

**Privacy.** The Fayda-verified legal name never appears on any public surface; leaderboards
and community use student-chosen display names. The raw FIN is never stored or logged — only a
salted hash, bound once at purchase, one FIN to one account.

**Exam integrity.** The timer is server-authoritative. During a sitting no endpoint returns
answer content; the full review unlocks only on submit or timeout.

## Confirmed product facts

- **Name:** Lomi-Test (ሎሚ).
- **Launch programs:** Computer Science, Public Health, Accounting & Finance — the only three
  source files with usable answer keys. The other five need answers authored first.
- **Plans:** 6 months Br 500, 12 months Br 800, measured from activation. (The older
  per-field, expires-at-exam-date model in `docs/PLAN.md` is superseded.)
- **Mock exam:** 100 questions, 180 minutes. Pacing budgets 60s CONCEPT / 180s CALCULATION,
  which only reconciles at a **60/40 concept-to-calculation mix** — sampling asserts this and
  fails loudly rather than overrunning.
- **Free tier:** 10 questions per field, with full answer content.
- **Devices:** two concurrent sessions; a third login evicts the oldest.
- **Identity:** signup is light (phone + OTP, or Telegram `initData` HMAC). Fayda binds once,
  at purchase, never at signup.
- **`isRetaker`** is captured but drives no behaviour yet — do not branch on it.
- **Interface chrome is bilingual EN/አማርኛ. Exam content stays English**, because the exam is.

## UI

`DESIGN.md` is authoritative; `design-system/tailwind-theme.css` is the normative Tailwind v4
`@theme` block (v4 is CSS-first — no `tailwind.config.ts` needed for tokens). Import it from
`apps/web/app/globals.css`.

Non-obvious constraints:

- **Semantic colours are never remapped**, including inside Telegram. The Mini App adopts
  Telegram's theme params for chrome only; correct/wrong/pending and badge tiers keep their
  token values. If a theme param fails 4.5:1 against our text, fall back to our token.
- **Colour never carries meaning alone** — an icon and a word travel with every state. Badge
  tiers differ by glyph shape so they read in greyscale.
- **Floors:** 16px body on mobile, 52px controls, 56px answer rows, 44px minimum touch target.
  The real device is a low-end 5-inch Android on a metered connection.
- **The question stem is the largest text** on any practice or exam screen.
- **Answer view order is fixed** — verdict → concept → solution → why-wrongs — with nothing
  behind an extra tap.
- **Motion:** one authored moment (the verdict spring, then the explanation rising). Nothing
  else animates on entrance; nothing decorative moves during a timed exam; no confetti on a
  correct answer or a cleared payment.
- **Ethiopic has no case**, so `text-transform: uppercase` is Latin-only and must switch off on
  Amharic strings.

## Voice

Plain, direct, second person, active. Errors state cause *and* fix. Numbers are motivation
("43 days left · 62% ready"); effort routes to value. **Never shame** a wrong answer or a
missed day — the explanation is the reward for getting it wrong, and a missed day *adjusts the
plan*, it does not break a streak.

## Do not fabricate

There are no students, testimonials, pass-rate data, revenue or press. `docs/PLAN.md` describes
a Ministry of Education partnership the repository does not evidence — no surface may claim it
until confirmed. Prices, exam configuration and blueprint weights that are placeholders are
listed as open decisions at the top of `TASK.md`; keep them marked rather than inventing values.
