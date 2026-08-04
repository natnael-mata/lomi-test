# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state: Phases 0, 1, 4 and 5 complete

A student can sign in through Telegram, choose a programme, practise one question at a time and
read a full explanation. Content can be imported from the ministry CSVs, reviewed, and published
through a gate that refuses anything unexplained.

**Start at `TASK.md`.** Its progress index is generated and carries the live count — run
`node scripts/task-progress.mjs` after ticking anything, and CI fails if it is stale. Do not
repeat the total here; a hand-copied number is wrong within a day.

What is done: the monorepo and toolchain (Phase 0), the Field → Course → Topic → Question
taxonomy (Phase 1), the import pipeline and review queue (Phase 2, bar two blocked tasks), auth
and sessions (Phase 3, bar the SMS OTP flow the owner is handling), the design system in code
(Phase 4), and practice with attempts, pacing, the free tier and the session summary (Phase 5).

What is not: exam mode, analytics, payments, admin, the Telegram Mini App, engagement, and
hardening.

**A second session owns Phase 8** (payments and identity) on branch `phase-8-payments`, in a
separate worktree with its own database. Do not create `Plan`, `Subscription` or `Payment`
here, and only append to `schema.prisma`.

Working protocol, from `TASK.md`:

1. Take the next unchecked task, in order. **Batch 3–5 related tasks per commit** — every task
   still keeps its own test; batching changes only how often you commit.
2. Implement only what the task describes — the next task probably covers what you were about
   to add.
3. Run the task's `**Test:**` command exactly as written.
4. Only if it passes, change `- [ ]` to `- [x]` and append ` ✅ <date>` plus what was actually
   verified.
5. Run the full baseline, regenerate the progress index, and commit naming every task in the
   batch.

Never tick a box you have not run the test for. A task marked `BLOCKED` needs a human decision —
stop and ask rather than guessing. **When a task's stated test is wrong, correct it in `TASK.md`
and say so**; several have been (the import template has 7 rows, not 6; GEO-0001 raises 8
blockers, not 3).

Two conventions from Phase 0 that are easy to break later:

- **`tsconfig.json` includes tests; `tsconfig.build.json` excludes them.** Build with the
  latter — otherwise test files land in `dist` and import vitest, which is absent from a
  production install. Typecheck uses the former on purpose: **Vitest does not type-check**, so
  the compiler is the only thing that checks test code.
- **A green `npm test` is not automatically meaningful.** `--if-present` exits 0 when nothing
  runs, so `scripts/runner-report.mjs` prints which workspaces actually ran.

## Commands (after Phase 0)

```bash
npm run db:dev          # embedded Postgres, no Docker; keep running in its own terminal
npm run prisma:deploy   # apply migrations — safe, never resets (use this)
npm run prisma:migrate  # prisma migrate dev — INTERACTIVE, can reset the DB. Humans only.
npm run db:seed
npm run dev:api         # :4000
npm run dev:web         # :3100 (chaw-driver owns 3000-3002)
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

**There is no official exam blueprint.** Weights are _derived_ from each topic's observed share
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

Plain, direct, second person, active. Errors state cause _and_ fix. Numbers are motivation
("43 days left · 62% ready"); effort routes to value. **Never shame** a wrong answer or a
missed day — the explanation is the reward for getting it wrong, and a missed day _adjusts the
plan_, it does not break a streak.

## Running the API locally

- **`tsx` cannot run this API.** It transpiles with esbuild, which does not emit
  `emitDecoratorMetadata`, so every Nest constructor injection resolves to `undefined` and the
  app dies at boot with "The dependency at index [0] appears to be undefined at runtime". It is
  the same trap as T-047, where Vitest needed `unplugin-swc` for the same reason.
- `npm run dev -w api` therefore runs `tsc --watch` into `dist/` and `node --watch dist/main.js`
  beside it. Slower to start than `tsx`, and the only thing that actually works.
- One-off scripts under `apps/api/scripts/` are fine with `tsx` — they construct `PrismaClient`
  directly and never go through Nest DI.

## Verifying the web app in a browser

- Start the dev server with the preview tooling (`lomi-web`, port 3100).
- **This used to break every time the repo baseline ran.** `next build` and `next dev` both
  default to `.next`, so `npm run build` at the root overwrote the running dev server's chunk
  manifest: every client chunk 404s, the app renders server-side and **never hydrates** — no
  React fiber on any node, no event handler anywhere. It reads exactly like a component bug.
  `next.config.ts` now sets `distDir` to `.next-build` under `NODE_ENV=production`, so builds
  and the dev server can no longer collide. If you ever see it again, the recovery is stop the
  server, `rm -rf apps/web/.next`, restart.
- Interactivity assertions (arrow keys, focus, click) are worthless until hydration is
  confirmed. The cheapest check is a `useEffect` probe rendering `data-hydrated`, or simply
  `[...document.querySelectorAll('*')].some(e => Object.getOwnPropertyNames(e).some(k => k.startsWith('__react')))`.
- `:focus-visible` does not match programmatic `.focus()`. Asserting the rule exists in the
  compiled CSS is honest; claiming the ring was observed is not.

## Guards

Every route is unguarded until someone puts a guard on it, and Nest gives no warning. This bit
once, badly: the whole `/admin/*` surface shipped open because those controllers were written in
Phase 2, before any guard existed, and nobody went back (T-086a).

- `SessionGuard` — authenticates, and reads the **session row**, so revocation is real.
- `FieldRequiredGuard` — 409 `FIELD_REQUIRED` until a programme is chosen. After `SessionGuard`.
- `StaffGuard` / `AdminGuard` — `/admin/*`. Staff is an explicit `StaffMember` table; the empty
  state is nobody. Grant with `npm run dev:staff -w api`.

**Never take an actor from the request body.** `body.reviewerId` made T-044's self-review rule
decorative and let every audit row record whatever string the caller sent. It is
`req.auth.userId`.

Two tests enforce this and both walk the router Nest actually built rather than grepping
decorators: `auth/staff.e2e.test.ts` calls every `/admin` route unauthenticated, and
`practice/routes.e2e.test.ts` asserts one student-facing question route.

## Traps already paid for

Each of these cost real time. None is obvious from reading the code.

**Tooling**

- **`tsx` cannot run the API.** esbuild does not emit `emitDecoratorMetadata`, so every Nest
  injection resolves to `undefined` and the app dies at boot. Vitest needs `unplugin-swc` for the
  same reason (T-047). One-off scripts under `apps/api/scripts/` are fine — they use
  `PrismaClient` directly and never touch Nest DI.
- **`dist` is what runs.** A new endpoint needs `npm run build -w api` before any browser check
  means anything; otherwise you are testing the previous build and will conclude the route is
  broken.
- **Run Prettier _after_ any generator.** `scripts/task-progress.mjs` rewrites `TASK.md` and its
  output is not Prettier-formatted, so the order is generate → format → check.

**TypeScript and React**

- **Tailwind cannot see interpolated class names.** `bg-${tone}-soft` generates no CSS at all and
  the element renders unstyled — it looks like a styling mistake and is a build one. Write full
  literal strings and pick between them.
- **`exactOptionalPropertyTypes` is on.** `foo?: string` means "may be absent", not "may be
  `undefined`", so forwarding a possibly-undefined value from a parent is a type error. Spell out
  `foo?: string | undefined` on any prop that gets forwarded.
- **`next/font` is a build-time macro.** It is not callable under Vitest; `apps/web/test/
next-font-stub.ts` stands in for it via a resolve alias.
- **Vitest needs `esbuild: { jsx: 'automatic' }`** to call a component as a function; the classic
  runtime compiles JSX to `React.createElement` and fails with "React is not defined", which
  reads like a missing import in the component.

**Data**

- **Dev scripts must never mutate seed data.** An early `dev:publish` edited the seeded template
  questions and broke ten API tests two ways at once: attempts then referenced rows the tests
  delete, and re-importing the template saw the fixture text as a content change and demoted the
  questions to `IN_REVIEW` — T-054 working exactly as designed, against data that should not have
  been touched. Dev fixtures live in their own `local-dev` field.

**The Browser pane**

- **`document.hasFocus()` is `false` and `clientWidth` can be `0`** when the pane is not
  displayed. Any layout assertion needs `preview_resize` first, or every element "overflows"; and
  `:focus` / `:focus-visible` never match, so a focus ring can be proved present in the compiled
  CSS but not observed.
- **Emulated `colorScheme` resets on navigation.** Test a media query live rather than through a
  reload.

## Do not fabricate

There are no students, testimonials, pass-rate data, revenue or press. `docs/PLAN.md` describes
a Ministry of Education partnership the repository does not evidence — no surface may claim it
until confirmed. Prices, exam configuration and blueprint weights that are placeholders are
listed as open decisions at the top of `TASK.md`; keep them marked rather than inventing values.
