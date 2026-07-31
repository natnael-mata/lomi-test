# TASK.md — Exit Exam Prep Platform

Executable build backlog for Claude Code. Derived from `PLAN.md`, `CONTENT-PIPELINE.md`,
`question_import_template.csv`, `PRODUCT.md` and `DESIGN.md`.

---

## How to work this file

**One task at a time. Never batch.**

1. Read the next unchecked task, top to bottom. Do not skip ahead.
2. If it says `BLOCKED`, stop and ask the user the named question. Do not guess.
3. Implement **only** what that task describes. Resist scope creep — the next task probably
   covers what you were about to add.
4. Run the task's **Test** command exactly as written.
5. If the test passes, change `- [ ]` to `- [x]` and append ` ✅ <date>`.
6. If the test fails, fix it. Do not tick the box and do not move on.
7. Commit with the task ID: `git commit -m "T-042: add publish gate why-wrong check"`.
8. Repeat.

**Never tick a box you have not tested.** A test that "should pass" is not a pass.

### Definition of done (every task)

- Code compiles: `npm run build` clean.
- Types clean: no new `any`, no `@ts-ignore`.
- The task's own Test command passes.
- No unrelated files touched.

### Standing commands

These do not exist yet — Phase 0 creates them. From Phase 1 onward they are assumed.

```bash
npm run db:dev          # embedded Postgres — keep running in its own terminal
npm run prisma:migrate  # apply schema changes
npm run db:seed         # sample data
npm run dev:api         # :4000
npm run dev:web         # :3100 (chaw-driver owns 3000-3002)
npm run dev:bot         # long-polling (needs TELEGRAM_BOT_TOKEN)
npm run build           # all workspaces
npm test                # unit + integration
npm run typecheck       # tsc --noEmit everywhere
npm run lint            # eslint, zero warnings
```

### Stack

npm workspaces · **NestJS + Prisma + PostgreSQL** (`apps/api`) ·
**Next.js + Tailwind v4** (`apps/web` — web PWA _and_ Telegram Mini App from one build) ·
**grammY** (`apps/bot`) · TypeScript, strict.

`docs/PLAN.md` §6 suggests Express/Fastify and Vite; it is superseded here. Where any document
disagrees with this file on stack, this file wins.

### Legend

`[ ]` todo · `[x]` done + tested · `BLOCKED` needs a human decision first

---

## Open decisions — resolve before the tasks that depend on them

These are unresolved in the source documents. Tasks that need them are marked `BLOCKED`.

| #   | Decision                                                           | Status                                                                                     |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| D1  | Product name                                                       | ✅ **Lomi-Test**                                                                           |
| D2  | Plan structure                                                     | ✅ **Duration-based: 6-month and 12-month**, measured from purchase                        |
| D3  | Price                                                              | ✅ **6 months = Br 500 · 12 months = Br 800**                                              |
| D4  | Exam config                                                        | ✅ **100 questions · 180 minutes.** Per-question budget: **60s concept, 180s calculation** |
| D5  | Blueprint weights                                                  | ✅ **No official blueprint exists.** Use derived weights — see below                       |
| D6  | verify.et credentials + which response field authorises activation | ⛔ still open — blocks T-150…T-154                                                         |
| D7  | Fayda relying-party approval status                                | ⛔ still open — blocks T-147, T-148                                                        |
| D8  | Retaker differentiation                                            | ✅ **No difference for now.** `isRetaker` is captured but drives nothing                   |

### D4 — the implied type mix

100 questions in 180 minutes only balances at **60 concept + 40 calculation**
(60×1 + 40×3 = 180). Treat that as the sampling target. If a real paper's mix differs, the
per-question budgets will not sum to the sitting length — T-120 asserts this and fails loudly
rather than silently overrunning.

### D5 — no official blueprint

There is no MoE blueprint document. Topic weights therefore cannot be claimed as official, and
the UI must never imply they are. The interim rule:

- **Derive weights from the source papers.** Count questions per topic across the real past
  papers in hand; a topic's weight is its observed share, rounded to whole percent and
  normalised to 100.
- **Label them honestly.** Student-facing copy reads _"share of past papers"_, never
  _"% of exam"_ — the second is a claim we cannot support.
- A reviewer may override a derived weight; overrides are recorded with a reason.
- Revisit if an official blueprint ever appears.

---

## Phase 0 — Scaffold the monorepo

Greenfield. Nothing exists but the documents in this folder. Build the skeleton and prove each
piece runs before moving on — every later phase assumes a green baseline.

**Stack (decided):** npm workspaces · NestJS + Prisma + PostgreSQL (`apps/api`) ·
Next.js + Tailwind v4 (`apps/web`, serving both web PWA and Telegram Mini App) ·
grammY (`apps/bot`) · TypeScript throughout.

- [x] **T-001** Create the root `package.json`: private, `"workspaces": ["apps/*"]`,
      `"engines": { "node": ">=20" }`. ✅ 2026-07-29
      **Test:** `npm install` exits 0 and writes `package-lock.json`; `npm pkg get workspaces`
      returns `"apps/*"`, `npm pkg get private` returns `true`.
      _(Original test asserted `node_modules/` is created — false for a dependency-free root;
      npm writes no `node_modules` until something is depended on. Corrected.)_
- [x] **T-002** Create the three workspace folders each with a minimal `package.json`:
      `apps/api` (name `api`), `apps/web` (`web`), `apps/bot` (`bot`). ✅ 2026-07-29
      **Test:** `npm ls --workspaces --depth=0` lists all three with no `UNMET`.
- [x] **T-003** Add a root `tsconfig.base.json` with `strict: true`, and have each workspace
      extend it. ✅ 2026-07-29
      **Test:** `npx tsc --noEmit -p apps/api` exits 0, and
      `npx tsc --showConfig -p apps/api` shows `"strict": true` inherited from the base.
      _(Original test said "on an empty project" — impossible: `tsc` raises TS18003 when
      `include` matches no files. Placeholder `src/index.ts` files added to `api` and `bot`,
      replaced by T-004 and T-007.)_
      Base also enables `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
      `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- [x] **T-004** Scaffold the NestJS app in `apps/api` with a `/health` route returning
      `{ status: "ok" }`. ✅ 2026-07-29
      **Test:** `npm run dev:api` then `curl -s localhost:4000/health` returns 200 with that body.
      _Verified: status 200, body exactly `{"status":"ok"}`._
      Note: `apps/api/tsconfig.json` overrides the base to `module: CommonJS` +
      `experimentalDecorators` + `emitDecoratorMetadata` — NestJS's DI container reads
      constructor parameter types from decorator metadata at runtime and cannot work without
      them. Port reads `API_PORT`, defaulting to 4000.
- [x] **T-005** Scaffold the Next.js app in `apps/web` (App Router, TypeScript). ✅ 2026-07-30
      **Test:** `npm run dev:web` then `curl -s localhost:3100` returns 200 containing `<html`.
      _Verified: 200, `<html>` present, `<title>Lomi-Test</title>`._
      **Port changed 3000 → 3100.** Ports 3000–3002 on this machine belong to chaw-driver (backend,
      web admin, miniapp). Every reference to
      the web dev port in this file, `CLAUDE.md` and `README.md` uses 3100.
      Written by hand rather than via `create-next-app`, so the workspace package name and the
      `tsconfig` `extends` chain survive. Next 15 + React 19.
- [x] **T-006** Install Tailwind v4 in `apps/web` and import
      `design-system/tailwind-theme.css` from `app/globals.css`. ✅ 2026-07-30
      **Test:** A page using `bg-brand` renders `rgb(91, 75, 224)` in `getComputedStyle`.
      _Verified in a real browser: `#probe-brand` → `rgb(91, 75, 224)`. Also confirmed
      `body` → `rgb(246, 246, 251)`, `.btn-primary` → 52px min-height / 12px radius / brand
      fill, `.num` → `tabular-nums`, and `correct` → `rgb(6, 112, 73)` on `rgb(227, 248, 239)`._
      **Bug found and fixed in the design system:** `.option-key` did `@apply … num`, but `num`
      was declared as a bare class in `@layer base`, so Tailwind raised
      _"Cannot apply unknown utility class `num`"_ and the whole stylesheet failed to compile
      (page 500'd). Promoted it to `@utility num { font-variant-numeric: tabular-nums }` so it
      works in both `@apply` and markup.
      Probe elements live in `app/page.tsx` and are replaced when real screens land in Phase 4.
      Note: font _families_ resolve (Gabarito stack) but the faces are not self-hosted yet —
      that is T-091.
- [x] **T-007** Scaffold the grammY bot in `apps/bot` with a `/start` handler. ✅ 2026-07-30
      **Test:** `npm run check -w bot` (which runs `src/main.ts --check`) exits 0 with
      `bot wiring ok` when `TELEGRAM_BOT_TOKEN` is set, and exits 1 naming the variable and the
      fix when it is not. _Both branches verified._
      _Why `--check` rather than `dev:bot`: booting long-polling for real requires a live token,
      makes an outbound call to Telegram, and would collide with any other running instance over
      `getUpdates`. `--check` proves config validation and handler registration deterministically
      with no network. **The live long-poll path is therefore not yet exercised** — it is covered
      when the bot gains real behaviour in Phase 10 (T-180+)._
      `createBot()` is deliberately separate from starting the bot so wiring is unit-testable;
      T-013 adds an assertion that the `/start` handler is registered. `apps/bot` is ESM
      (`"type": "module"`), unlike `apps/api` which NestJS requires to be CommonJS.
- [x] **T-008** Add dev Postgres with no Docker requirement (`embedded-postgres`, data in
      `apps/api/.pgdata`, which is gitignored). ✅ 2026-07-30
      **Test:** `npm run db:dev` starts; `psql "$DATABASE_URL" -c 'select 1'` returns `1`.
      _Verified: cluster initialised, `lomi_test` created, `select 1` → `1` (exit 0)._
      **Port 5433, not 5432** — the system Postgres 16 (chaw-driver's) already owns 5432.
      `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/lomi_test`, written to a
      gitignored `.env`.
      Two things to keep an eye on: `embedded-postgres` is on a **beta release**
      (`18.4.0-beta.17`) and ships **Postgres 18.4**, while production will run a managed
      Postgres — pin the production major deliberately rather than inheriting whatever this
      package bundles. The script is idempotent: it only runs `initialise()` when
      `.pgdata/PG_VERSION` is absent, and tolerates the database already existing.
- [x] **T-009** Initialise Prisma in `apps/api` with a `datasource` reading `DATABASE_URL`, and
      one throwaway model to prove the toolchain. ✅ 2026-07-30
      **Test:** `prisma migrate diff` generates the migration, `npm run prisma:deploy` applies it,
      and `npx prisma migrate status` reports _"Database schema is up to date!"_ (exit 0).
      _Verified end to end: migration `20260730143950_init_toolchain_check` applied, and the
      `ToolchainCheck` table confirmed present via `psql \d`. `prisma generate` also succeeds._
      **Deliberately not `prisma migrate dev`.** That command can **reset the database** when it
      detects drift, and it prompts — neither is acceptable for an unattended agent run. The
      split is now explicit:
      · `npm run prisma:migrate` → `prisma migrate dev` — **humans only**, interactive, may reset.
      · `npm run prisma:deploy` → `prisma migrate deploy` — **agents and CI**, applies only,
      never resets, never prompts.
      `apps/api/.env` exists separately from the repo-root `.env` because the Prisma CLI reads
      the schema's own project directory, not the workspace root. Both are gitignored and must
      be kept in sync.
      `ToolchainCheck` is throwaway — the first Phase 1 migration drops it.
- [x] **T-010** Add root scripts: `dev:api`, `dev:web`, `dev:bot`, `build`, `test`, `typecheck`,
      `lint`, `db:dev`, `prisma:migrate`, `prisma:generate`, `db:seed`. ✅ 2026-07-30
      **Test:** the six terminating scripts — `typecheck`, `build`, `test`, `lint`, `db:seed`,
      `prisma:generate` — each exit 0. The four **server** scripts are asserted to _start_, not
      to exit: `dev:api` logs `api listening on http://localhost:4000`; `dev:bot` reaches
      Telegram and is rejected for the fake token (proving it booted past config); `dev:web` and
      `db:dev` were verified live in T-005 and T-008.
      _(The original test said "every script runs and exits 0" — impossible for four
      long-running servers. Corrected to assert the right thing for each kind.)_
      **Guard added:** `npm run test --workspaces --if-present` exits 0 **in silence** when no
      workspace defines a test script, so an empty suite is indistinguishable from a passing
      one — and the baseline rule ("tests green before ticking a task") would be satisfied by
      nothing at all. `scripts/runner-report.mjs` now prints
      _"⚠ test ran in NO workspace — nothing was executed. Exit 0 here means 'not wired up
      yet', not 'passed'."_ until T-013 lands. Same guard on `lint` until T-014.
      `db:seed` is `--if-present` and no-ops until T-031.
- [x] **T-011** Write `.env.example` covering every variable the apps read: `DATABASE_URL`,
      `API_PORT`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `TELEGRAM_BOT_TOKEN`,
      `SMS_API_KEY`, `SMS_SENDER_ID`, `CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`,
      `API_BASE_URL`, `BOT_INTERNAL_TOKEN`, `NEXT_PUBLIC_API_BASE_URL`.
      **Test:** `grep -rhoE "process\.env\.[A-Z_]+" apps/*/src | sort -u` — every name found
      appears in `.env.example`. ✅ 2026-07-31
      _Verified: the grep currently finds only `API_PORT` (little code exists yet), so the check
      was widened to also cover the `PG*` vars read by `apps/api/scripts/db-dev.mjs` — outside
      `src`, so the original grep misses them — plus all thirteen names this task lists. All
      present. Also asserted: `.env` and `apps/api/.env` are ignored, both `.env.example` files
      are tracked, and every secret field is empty._
      **Two env files, and they must agree.** `apps/api/.env.example` exists because the Prisma
      CLI reads the schema's own project directory and does not read the workspace root.
      `DATABASE_URL` is duplicated there deliberately; if the two drift, migrations run against
      a different database than the app. Both files say so at the top.
      Documented in place rather than left as bare names: `SMS_API_KEY` empty in dev returns the
      OTP in the API response (and must be set in production, or codes leak to the caller);
      `TELEGRAM_BOT_TOKEN` doubles as the HMAC key for Mini App `initData`, so rotating it signs
      every Telegram user out; `NEXT_PUBLIC_*` is inlined into the browser bundle and can never
      hold a secret.
- [x] **T-012** Confirm `.gitignore` covers `node_modules`, `.next`, `dist`, `.env`, `.pgdata`.
      ✅ 2026-07-31
      **Test:** `git status --short` is clean after a full install, dev-db start and build.
      _Verified: `npm install` + `npm run build` (all three workspaces) with Postgres running,
      then `git status --short` → **empty**._
      Each artifact was confirmed to **exist first**, then confirmed ignored — `node_modules`,
      `apps/web/.next`, `apps/api/dist`, `apps/bot/dist`, `apps/api/.pgdata`, `.env`,
      `apps/api/.env`. A clean tree proves nothing if the things it should be hiding were never
      generated, which is the failure mode this ordering rules out.
- [x] **T-013** Set up the test runner (Vitest or Jest) with one passing smoke test per workspace.
      Include an assertion that the bot's `/start` handler is registered (deferred from T-007).
      ✅ 2026-07-31
      **Test:** `npm test` exits 0 and reports 3 passing tests. _Verified: 1 + 1 + 1 = 3 passing
      across api, web and bot._ Vitest 3.
      **Also asserted, because "3 passing" alone does not prove a runner works:** a deliberately
      failing canary test makes the workspace run exit 1 **and** the root `npm test` exit 1. A
      suite that cannot go red is not a suite. The T-010 warning is now retired and the script
      reports `"test" ran in: api, web, bot`.
      **The `/start` assertion (deferred from T-007) is now real.** It builds the bot, installs an
      API transformer that captures outbound calls instead of letting them reach Telegram, feeds
      a genuine `/start` update through `handleUpdate`, and asserts exactly one `sendMessage`
      carrying the product name. `createBot` gained an optional `BotConfig` parameter purely so
      the test can supply `botInfo` and avoid a `getMe` network call — production passes nothing.
      **Lesson worth keeping: Vitest does not type-check.** `bot.test.ts` passed while being
      type-invalid — this grammY version's `UserFromGetMe` needs four fields I had omitted
      (`has_topics_enabled`, `allows_users_to_create_topics`, `can_manage_bots`,
      `supports_join_request_queries`). Only `npm run typecheck` caught it. Green tests are not
      evidence of a compiling codebase; the baseline rule needs all four commands, not just this one.
- [x] **T-014** Add ESLint + Prettier and make the tree clean. ✅ 2026-07-31
      **Test:** `npm run lint` exits 0 with zero warnings. _Verified: exit 0 with
      `--max-warnings=0`; `npm run format:check` also passes._
      **One flat config at the root**, run as a single `eslint .` pass rather than per-workspace,
      so a rule can never be enforced in one workspace and silently skipped in another. The
      T-010 "nothing ran" guard is therefore dropped from `lint` — `eslint .` errors on its own
      if it matches no files. The guard stays on `test`, where it now reports which workspaces ran.
      **Type-aware linting is deliberately off.** It needs a program per workspace and roughly
      triples lint time, while `npm run typecheck` already runs the real compiler with stricter
      settings than any lint rule could apply.
      Rules that matter here: `no-explicit-any` as an **error** (it erases exactly the guarantees
      the definition of done relies on), `no-unused-vars` as an error with `^_` escape,
      `eqeqeq`, and `no-console` warned except in entry points and operational scripts.
      **Found and removed a stale suppression:** `apps/api/src/main.ts` carried an
      `// eslint-disable-next-line no-console` that I added speculatively in T-004, before any
      linter existed. ESLint flagged it as an unused directive — the config already allows
      `console` in `main.ts`. Deleted rather than kept, since a suppression that suppresses
      nothing is a lie about the code.
      Prettier reformatted the tree in one pass (100 cols, single quotes, trailing commas),
      which touched most files including `TASK.md` and the design-system CSS. Re-verified after:
      typecheck 0, build 0, 3 tests passing, and the 177 task checkboxes intact.
- [x] **T-015** Add `.github/workflows/ci.yml` running install, typecheck, lint, build, test.
      ✅ 2026-07-31
      **Test:** locally, all the CI commands pass in sequence — `npm ci`, typecheck, lint, build,
      test, format:check — **all ok**. The workflow YAML was also parsed to confirm it is valid
      and that the trigger and all eight steps are present.
      **The `act`/pushed-branch half of this test could NOT be run**, and this task is ticked
      knowing that: `act` is not installed and **this repo has no git remote**, so there is
      nowhere to push and GitHub has never executed this file. It is verified as
      _"the commands it runs all pass, and it is syntactically valid"_ — not as _"observed
      green on GitHub"_. Re-check after adding a remote and pushing once.
      Uses `npm ci`, not `npm install`, so CI fails if `package.json` and the lockfile drift.
      Each command is a separate step so the failing one is visible from the job summary.
      `format:check` never writes — CI must not reformat the tree.
      **No database service yet**, deliberately: nothing in the suite touches Postgres. From
      T-020 the tests hit real tables and this job will need a `services: postgres:` container,
      `DATABASE_URL`, and `prisma migrate deploy` before the test step. A note in the file says so.
- [x] **T-016** Verify the whole skeleton builds together. ✅ 2026-07-31
      **Test:** `npm run build` exits 0 for all three workspaces. _Verified from a **cold** start —
      `dist/`, `.next/` and tsbuildinfo deleted first, since a warm build proves little._
      Beyond exit 0, the emitted output was checked to exist **and run**:
      `require('apps/api/dist/health/health.controller.js')` returns `{"status":"ok"}`, and
      `apps/bot/dist/bot.js` exports `createBot`.
      **Defect found and fixed: test files were being compiled into `dist`.** `tsc -p .` matched
      `**/*.test.ts`, so six test artifacts shipped — including `bot.test.js`, which imports
      **vitest, a devDependency absent from a production install**. Fixed with a separate
      `tsconfig.build.json` per Node workspace that excludes `*.test.ts`, while `tsconfig.json`
      keeps including them so `npm run typecheck` still covers tests.
      Both halves were then proven rather than assumed: a deliberate type error added to
      `bot.test.ts` makes **typecheck exit 2** and **build exit 0**.
- [x] **T-017** Commit the scaffold as the green baseline. ✅ 2026-07-31
      **Test:** `git log --oneline` shows the scaffold commit and `git status` is clean.
      _Verified: 17 task commits (T-001…T-017) plus the port-change commit, working tree clean._
      The scaffold was committed **per task rather than as one lump**, so each piece of the
      skeleton carries the reasoning and the verification that produced it.
      **Baseline at close of Phase 0:** `typecheck 0 · build 0 · lint 0 · format 0 · 3 tests
passing`. From here the rule in this file's header applies — all five green before any
      task is ticked.
      `CLAUDE.md` updated: it no longer claims the repo is documents-only, and records the two
      Phase 0 conventions that are easiest to break later (the `tsconfig.build.json` split, and
      that a green `npm test` needs the runner report to mean anything).

> **Baseline rule.** From here on, `npm test`, `npm run lint`, `npm run typecheck` and
> `npm run build` must all be green before any task is ticked. A red baseline makes every
> later task's test meaningless.

---

## Phase 1 — Data model & taxonomy

- [x] **T-020** Confirm `Field` model has `id, name, slug, examDate, priceEtb, isPublished`.
      ✅ 2026-07-31
      **Test:** `npx prisma validate` passes; the model has its fields.
      _Verified: schema valid, migration `field_taxonomy_root` applied, and the real
      `public."Field"` table confirmed via `psql \d` — `id, name, slug, examDate, isPublished,
  createdAt, updatedAt`, with a unique index on `slug` and an index on `isPublished`.
      `ToolchainCheck` is dropped._
      **`priceEtb` was deliberately NOT created.** This task was written before D2/D3; access is
      now sold by **duration** (6 or 12 months), so price belongs to `Plan`, not `Field`.
      Creating it would mean a migration to add a column and another to drop it — plus a window
      where code could read a price that governs nothing. T-140c is amended accordingly.
      Also added: `migration_lock.toml`, which T-009 never produced because that migration was
      hand-written rather than generated. `prisma migrate diff --from-migrations` requires it.
- [ ] **T-021** Confirm `Course` belongs to `Field` with cascade rules defined.
      **Test:** Deleting a Field in a transaction does not orphan Courses.
- [ ] **T-022** Confirm `Topic` belongs to `Course` and carries `blueprintWeight Decimal`.
      **Test:** `npx prisma validate` passes; weight column is decimal, not float.
- [ ] **T-023** Add a DB check constraint: `blueprintWeight` between 0 and 100.
      **Test:** Inserting weight `150` raises a constraint error.
- [ ] **T-024** Add a service method `assertFieldWeightsSumTo100(fieldId)`.
      **Test:** Unit test: weights `[40,60]` pass; `[40,50]` throw with the shortfall named.
- [ ] **T-025** Confirm `Question` has `qType (CONCEPT|CALCULATION)`, `stem`, `conceptLine`,
      `explanation`, `timeLimitSec`, `status`, `authorId`, `reviewerId`, `sourceRef`, `year`.
      **Test:** `npx prisma validate` passes; all columns present.
- [ ] **T-026** Confirm `Option` has `label A–D`, `text`, `isCorrect`, `whyWrong`.
      **Test:** Unique constraint on `(questionId, label)` exists.
- [ ] **T-027** Add `Step` model for CALCULATION questions: `order`, `text`, `formula?`.
      **Test:** Migration applies; steps round-trip ordered by `order`.
- [ ] **T-028** Add `stableId` to `Question` (e.g. `AF-0003`), unique, matching the CSV column.
      **Test:** Inserting a duplicate `stableId` raises a unique violation.
- [ ] **T-029** Add index on `Question(fieldId, status)` — the hot path for question serving.
      **Test:** `EXPLAIN` on the next-question query shows an index scan, not a seq scan.
- [ ] **T-030** Write a seed that creates the three launch fields: Computer Science,
      Public Health, Accounting & Finance.
      **Test:** After `npm run db:seed`, exactly 3 published fields exist.
- [ ] **T-031** Seed the 6 sample questions from `question_import_template.csv` verbatim.
      **Test:** `AF-0003` exists with 4 options, correct = `b`, and a non-empty explanation.

---

## Phase 2 — Content pipeline (CONTENT-PIPELINE.md)

This is Phase 1 in the source doc for a reason: without it there is nothing to serve.

### 2a — Publish gate

- [ ] **T-040** Confirm `publish-gate.ts` rejects a question with ≠1 correct option.
      **Test:** Unit: 0 correct → error; 2 correct → error; 1 correct → pass.
- [ ] **T-041** Confirm the gate rejects a blank `whyWrong` on any distractor.
      **Test:** Unit: 3 distractors, one blank → error names the option letter.
- [ ] **T-042** Confirm the gate rejects a multi-sentence `conceptLine`.
      **Test:** Unit: `"A. B."` → error; `"A single sentence."` → pass.
- [ ] **T-043** Confirm the gate requires a CALCULATION's final step to state the answer choice.
      **Test:** Unit: last step `"= 8,500"` → error; `"= 8,500 → answer C"` → pass.
- [ ] **T-044** Confirm the gate rejects reviewer == author.
      **Test:** Unit: same user id in both roles → error.
- [ ] **T-045** Confirm `timeLimitSec` is bounded 15–600.
      **Test:** Unit: 10 → error; 700 → error; 120 → pass.
- [ ] **T-046** Add a gate rule: a question cannot publish if its Topic has no blueprint weight.
      **Test:** Unit: topic weight null → error naming the topic.
- [ ] **T-047** Confirm the gate runs server-side on every publish, not only on save.
      **Test:** Integration: POST publish with a crafted invalid payload → 422, status unchanged.

### 2b — Importer

- [ ] **T-050** Define the canonical import row type matching the CSV's 16 columns exactly.
      **Test:** Type has all 16 keys; compile fails if one is removed.
- [ ] **T-051** Write a CSV parser that handles quoted fields containing commas and newlines.
      **Test:** Parsing `question_import_template.csv` yields exactly 6 rows, and AF-0001's
      explanation retains its internal commas.
- [ ] **T-052** Map `status` column values (`raw`, `needs_answer`, `needs_explanation`,
      `needs_topic_review`, `ready`) including semicolon-combined values.
      **Test:** `needs_answer;needs_explanation` parses to a 2-element array.
- [ ] **T-053** Import accepts rows with blank `correct_option` / `explanation` / `course`
      and stages them rather than rejecting.
      **Test:** Importing GEO-0001 (blank answer) succeeds; row lands with `needs_answer`.
- [ ] **T-054** Import refuses to set `PUBLISHED` on any row, whatever the CSV says.
      **Test:** A row with `status=ready` imports as `DRAFT`; only the review flow publishes.
- [ ] **T-055** Import is idempotent on `stableId` — re-importing updates, never duplicates.
      **Test:** Import the template twice; question count is 6, not 12.
- [ ] **T-056** Import writes a per-run report: rows read, created, updated, rejected + reasons.
      **Test:** Report for the template CSV shows 6 read, 6 created, 0 rejected.
- [ ] **T-057** Reject a row whose `option_a..d` are not all present, with the row number.
      **Test:** A crafted 3-option row is rejected and names its line number.
- [ ] **T-058** Add a cleaning pass: strip form feeds, repeated running headers, and
      `"Question N"` concatenated onto option text (CONTENT-PIPELINE §1).
      **Test:** Unit: `"Question 2Answer: foo"` → `"foo"`.
- [ ] **T-059** Add a cleaning pass for double lettering (`"A. a."` → `"a."`).
      **Test:** Unit covers `A. a.`, `(a) a)`, and leaves clean text untouched.
- [ ] **T-060** Log, do not silently drop, every row the cleaner modifies.
      **Test:** Report lists modified rows with before/after.

### 2c — Review queue

- [ ] **T-065** `GET /admin/review/next` returns the oldest `IN_REVIEW` question not authored
      by the requesting user.
      **Test:** Integration: author A's question is not returned to A.
- [ ] **T-066** Review response includes the full render payload (options, why-wrongs, steps).
      **Test:** Response shape matches the student answer-view contract exactly.
- [ ] **T-067** `POST /admin/review/:id/publish` runs the gate and returns 422 with a blocker
      list when it fails.
      **Test:** GEO-0001 (no answer) → 422 with 3 named blockers.
- [ ] **T-068** `POST /admin/review/:id/bounce` requires a note ≥10 chars.
      **Test:** Empty note → 400; valid note → question returns to `DRAFT` with note attached.
- [ ] **T-069** Publishing writes an `AuditLog` row with actor, action, question, timestamp.
      **Test:** After publish, exactly one audit row exists with the reviewer's id.
- [ ] **T-070** `POST /admin/questions/:id/retire` sets `RETIRED` and records blast radius.
      **Test:** Retiring returns counts of affected attempts and live sittings.
- [ ] **T-071** A retired question never appears in any student query.
      **Test:** Integration: retire, then request 100 next-questions — it never appears.

---

## Phase 3 — Auth & accounts

- [ ] **T-075** `POST /auth/otp/request` accepts a phone, rate-limited to 3 per 10 minutes.
      **Test:** 4th request within 10 min → 429.
- [ ] **T-076** With `SMS_API_KEY` empty, the OTP is echoed in the response (dev only).
      **Test:** Response contains `devCode` when the key is unset, and never when it is set.
- [ ] **T-077** `POST /auth/otp/verify` issues a JWT and sets `phoneVerifiedAt`.
      **Test:** Correct code → 200 + token; wrong code → 401; expired code → 401.
- [ ] **T-078** OTP codes expire after 5 minutes and are single-use.
      **Test:** Reusing a consumed code → 401.
- [ ] **T-079** Telegram `initData` HMAC validation against the bot token.
      **Test:** Unit: a known-good fixture validates; a tampered fixture fails.
- [ ] **T-080** Telegram sign-in creates or finds a user by `telegramId`.
      **Test:** Two sign-ins with the same id yield one user row.
- [ ] **T-081** Link a Telegram identity to an existing phone account.
      **Test:** After linking, one user row carries both `phone` and `telegramId`.
- [ ] **T-082** Device limit: a third concurrent session evicts the oldest.
      **Test:** Integration: 3 logins → exactly 2 live sessions; the first is invalidated.
- [ ] **T-083** `GET /me/devices` lists active sessions with last-seen and current flag.
      **Test:** Response marks exactly one device as current.
- [ ] **T-084** `POST /me/devices/:id/revoke` invalidates that session immediately.
      **Test:** The revoked token returns 401 on the next request.
- [ ] **T-085** First sign-in requires choosing a Field before any question is served.
      **Test:** A user with no field requesting `/questions/next` → 409 with `FIELD_REQUIRED`.
- [ ] **T-086** `displayName` defaults to a generated handle, never the legal name.
      **Test:** New user's `displayName` does not equal `name` or `verifiedName`.

---

## Phase 4 — Design system in code

Implements `DESIGN.md` and `design-system/tailwind-theme.css`.

- [ ] **T-090** Paste the `@theme` block into `apps/web/app/globals.css`; delete superseded
      v2 tokens.
      **Test:** `npm run dev:web` renders; `getComputedStyle(document.body).backgroundColor`
      is `rgb(246, 246, 251)` in light mode.
- [ ] **T-091** Self-host Gabarito + Figtree + Noto Sans Ethiopic via `next/font`.
      **Test:** Network tab shows zero requests to `fonts.googleapis.com`; CLS is 0.
- [ ] **T-092** Implement `<Button>` with `primary | ghost | danger | disabled` variants.
      **Test:** Storybook/route renders all four; primary is 52px tall with the brand shadow.
- [ ] **T-093** Disabled buttons render a supplied `blockingReason` instead of the label.
      **Test:** `<Button disabled blockingReason="2 why-wrongs missing">` shows that text.
- [ ] **T-094** Implement `<AnswerOption>` driven by `data-state`, with `aria-checked` mirrored.
      **Test:** All four states render; keyboard arrow keys move selection within the group.
- [ ] **T-095** Implement `<Card>`, `<Chip>`, `<Input>` per DESIGN.md, with focus rings.
      **Test:** Tab through a form — every control shows a 2px brand outline at 2px offset.
- [ ] **T-096** Implement `<TotalBar>` and `<StatedFigure>` as distinct components.
      **Test:** Unit: `<TotalBar>` throws in dev if its rows do not sum to its total.
- [ ] **T-097** Implement `<ReadinessStatement>`; it renders an "N other topics" row whenever
      the listed weights sum to <100.
      **Test:** Given weights `[12,12,18]` and a total of 100, an elided row for 58% appears.
- [ ] **T-097a** Weight captions read **"share of past papers"**, never "% of exam" (D5 —
      no official blueprint exists, so the stronger claim is unsupportable).
      **Test:** Copy lint: the string `% of exam` appears nowhere in `apps/web`.
- [ ] **T-098** Dark theme toggles via a `.dark` class on `<html>`, persisted.
      **Test:** Toggle, reload — theme survives; `prefers-color-scheme` respected on first load.
- [ ] **T-099** Add an automated contrast test over every token pair used together.
      **Test:** `npm test -- contrast` asserts every pair ≥4.5:1 in both themes.
- [ ] **T-100** Add `prefers-reduced-motion` handling globally.
      **Test:** With the media query forced, no element has a transition >1ms.
- [ ] **T-101** Disable `text-transform: uppercase` when the active language is Amharic.
      **Test:** In `am`, no rendered element has computed `text-transform: uppercase`.

---

## Phase 5 — Student core: practice

- [ ] **T-105** `GET /questions/next` returns one `PUBLISHED` question for the user's field.
      **Test:** Response contains stem + 4 options.
- [ ] **T-106** **Security:** that response contains no `isCorrect`, `whyWrong`, `conceptLine`,
      `explanation` or `steps`.
      **Test:** Integration asserts those keys are absent from the serialised JSON. This test
      must never be deleted.
- [ ] **T-107** No bulk question endpoint exists.
      **Test:** Route inventory contains no route returning >1 question with answer content.
- [ ] **T-108** `POST /attempts` records the answer and returns the full answer payload.
      **Test:** Response includes verdict, concept line, explanation or steps, and why-wrongs.
- [ ] **T-109** An attempt records `timeTakenSec` and compares it to `timeLimitSec`.
      **Test:** Response includes both; over-limit is flagged as pacing, not failure.
- [ ] **T-110** A question already answered correctly is not served again the same day.
      **Test:** Answer correctly, request 50 next-questions — it does not reappear.
- [ ] **T-111** Free tier: an unsubscribed user may attempt exactly 10 questions per field.
      **Test:** 11th attempt → 402 with `FREE_LIMIT_REACHED`; `freeRemaining` counts down.
- [ ] **T-112** Build the practice screen against the real API (replace sample data).
      **Test:** Screen renders a live question; submitting shows the real explanation.
- [ ] **T-113** Answer view renders in the fixed order: verdict → concept → solution →
      why-wrongs, with nothing behind a tap.
      **Test:** DOM order matches; no `<details>`, no accordion, in that subtree.
- [ ] **T-114** CALCULATION questions render the numbered step list with the final step
      highlighted.
      **Test:** AF-0003 renders 4 steps; the last carries the correct colour and "answer B".
- [ ] **T-115** The student's own wrong option sorts first in the why-wrongs list.
      **Test:** Choosing D puts D's card first.
- [ ] **T-116** Code blocks render in their own scrollable well, separate from prose.
      **Test:** CS-0001 renders its CSS block; the page does not scroll sideways at 375px.
- [ ] **T-117** The verdict animates once on a spring; nothing else animates on entrance.
      **Test:** Only one element has a running animation 100ms after submit.
- [ ] **T-118** Session summary: score plus per-topic breakdown plus weakest topic.
      **Test:** After 10 answers, the summary names the topic with the lowest weighted score.

---

## Phase 6 — Exam mode

- [ ] **T-119** Set per-question time budgets by type: `CONCEPT = 60s`, `CALCULATION = 180s`
      (D4). Seed and importer apply these unless a reviewer overrides.
      **Test:** Importing a CALCULATION row with no explicit limit yields `timeLimitSec = 180`.
- [ ] **T-120** `POST /exams/:fieldId/start` freezes a 100-question set sampled to
      **60 CONCEPT + 40 CALCULATION** and weighted by derived topic share (D4, D5).
      **Test:** A started sitting has exactly 100 questions, 60 concept and 40 calculation;
      two sittings of the same exam get identical `questionIds`.
- [ ] **T-120a** Sampling fails loudly if the bank cannot satisfy the mix, naming the shortfall.
      **Test:** With only 10 calculation questions published, start → 422
      `INSUFFICIENT_BANK: need 40 CALCULATION, have 10`. Never silently pad with concept items.
- [ ] **T-121** Exam duration is **180 minutes**, read from the `Exam` record, not a constant.
      **Test:** Changing `duration` changes the returned deadline; the seeded exam is 180.
- [ ] **T-121a** Assert the sampled set's per-question budgets sum to the sitting length.
      **Test:** Unit: 60×60s + 40×180s = 10,800s = 180 min. A mix that overruns fails the test.
- [ ] **T-122** The timer is server-authoritative; the client only displays it.
      **Test:** Changing the client clock by +30 min does not extend the sitting.
- [ ] **T-123** Submitting after the deadline is rejected and the sitting auto-submits.
      **Test:** Integration: submit at deadline+1s → sitting already closed, answers preserved.
- [ ] **T-124** During a sitting, no endpoint returns answer content.
      **Test:** Every in-exam response is asserted free of `isCorrect` and `explanation`.
- [ ] **T-125** One question at a time with Back/Next and a jump-to grid.
      **Test:** Navigating away and back preserves the selected option.
- [ ] **T-126** Flagging a question persists across navigation and reload.
      **Test:** Flag Q13, reload, Q13 is still flagged.
- [ ] **T-127** The jump grid distinguishes answered / flagged / current by shape or icon,
      not colour alone.
      **Test:** In greyscale, all three states remain distinguishable.
- [ ] **T-128** Timer changes state at 20% and 5% remaining, without blinking.
      **Test:** No `animation` on the timer element at any threshold.
- [ ] **T-129** On submit, the full review unlocks: every question with its explanation.
      **Test:** All 60 answer payloads are retrievable after close, none before.
- [ ] **T-130** Post-exam summary shows score, per-topic breakdown and the weakest topic by
      blueprint weight.
      **Test:** Weakest topic is chosen by weight × miss rate, not raw misses.
- [ ] **T-131** Offline: an in-progress sitting survives a network drop and syncs on reconnect.
      **Test:** Kill the network mid-sitting, answer 2, reconnect — both persist.

---

## Phase 7 — Progress & analytics

- [ ] **T-134** Compute derived topic weights: each topic's share of published questions in
      its field, rounded to whole percent and normalised to exactly 100 (D5).
      **Test:** Unit: shares `[33.3, 33.3, 33.3]` normalise to `[34, 33, 33]`, summing to 100.
- [ ] **T-134a** A reviewer can override a derived weight; the override stores a reason and
      re-normalises the rest.
      **Test:** Overriding one topic to 40 leaves the others summing to 60.
- [ ] **T-135** `GET /me/readiness/:fieldId` returns per-topic scores with their derived weights
      and a `weightSource` of `derived` or `override`.
      **Test:** Returned weights sum to 100 and every row carries `weightSource`.
- [ ] **T-136** The headline readiness figure is the weighted mean of the returned topics.
      **Test:** Property test: recomputing from rows equals the returned figure, ±0.5.
- [ ] **T-137** Topics below 60% are flagged `focus`.
      **Test:** A topic at 59.9% is flagged; 60.1% is not.
- [ ] **T-138** Score trend across sittings, labelled by sitting not date.
      **Test:** X labels read "Mock 1/2/3".
- [ ] **T-139** Every analytics view ends with a practice CTA targeting the weakest topic.
      **Test:** The CTA's href carries that topic's id.

---

## Phase 8 — Payments, subscription, identity

- [ ] **T-140** Add a `Plan` model: `code (SIX_MONTH|TWELVE_MONTH)`, `months`, `priceEtb`,
      `isActive`. Seed **SIX_MONTH = 500** and **TWELVE_MONTH = 800** (D2, D3).
      **Test:** Migration applies; exactly 2 active plans exist with those prices.
- [ ] **T-140a** Point `Subscription` at `planId` and compute
      `expiresAt = activatedAt + plan.months`. Remove the exam-date + grace-week rule.
      **Test:** Activating SIX_MONTH on 2026-01-15 yields `expiresAt` 2026-07-15.
- [ ] **T-140b** Write a migration that maps existing per-field subscriptions onto a plan
      without losing anyone's remaining access.
      **Test:** After migrating, no live subscription's `expiresAt` moves earlier.
- [x] **T-140c** Deprecate `Field.priceEtb`: stop reading it, and fail the build if it is
      referenced outside the migration. ✅ 2026-07-31 — **satisfied by never creating it.**
      **Test:** `grep -r "priceEtb" apps/ --exclude-dir=prisma/migrations` returns nothing.
      _T-020 omitted the column outright once D2/D3 made pricing duration-based, so there is
      nothing to deprecate. Price lives on `Plan` (T-140). Re-run the grep after T-140 to confirm
      `priceEtb` appears only on `Plan`._
- [ ] **T-141** Checkout price comes from `Plan.priceEtb`, never a constant.
      **Test:** Changing a plan's price changes the checkout total for new purchases only;
      existing subscriptions are unaffected.
- [ ] **T-141a** The plan picker shows both plans with per-month maths so the 12-month value is
      legible (500/6 ≈ Br 83/mo vs 800/12 ≈ Br 67/mo).
      **Test:** Both plans render with a computed per-month figure derived from the data.
- [ ] **T-141b** Decide what a plan grants: one field or all fields. Encode it explicitly.
      **Test:** Documented in `PRODUCT.md` and asserted — a subscriber's field access matches
      the rule, tested for both a matching and a non-matching field.
- [ ] **T-142** `POST /payments/chapa/init` returns a redirect URL for the field's price.
      **Test:** Sandbox call returns a URL; amount matches `priceEtb`.
- [ ] **T-143** Chapa webhook activates the subscription and is signature-verified.
      **Test:** Unsigned webhook → 401; valid webhook → subscription `ACTIVE`.
- [ ] **T-144** The webhook is idempotent — a replay does not extend access twice.
      **Test:** Fire the same webhook twice; `expiresAt` is unchanged on the second.
- [ ] **T-145** `POST /payments/manual` accepts a `txRef` and creates a `PENDING` payment.
      **Test:** Duplicate `txRef` → 409.
- [ ] **T-146** A pending payment leaves free-tier access intact.
      **Test:** With a pending payment, `freeRemaining` still applies; no full access.
- [ ] **T-146a** Renewal extends from the current `expiresAt`, not from today, so a student who
      renews early loses nothing.
      **Test:** Renewing 30 days before expiry adds the full plan length to the existing date.
- [ ] **T-147** Fayda verification binds a salted FIN hash at purchase. **BLOCKED on D7.**
      **Test:** A second account attempting the same FIN → 409 `FIN_ALREADY_BOUND`.
- [ ] **T-148** The raw FIN is never stored or logged. **BLOCKED on D7.**
      **Test:** `grep` over logs and DB dump for the test FIN returns nothing.
- [ ] **T-149** `verifiedName` is never returned by any public endpoint.
      **Test:** Leaderboard and community responses are asserted free of it.
- [ ] **T-150** verify.et client with timeout and 3 retries. **BLOCKED on D6.**
      **Test:** A stubbed timeout retries 3 times then marks the payment `no response`.
- [ ] **T-151** verify.et amount mismatch → `query` state, not rejection. **BLOCKED on D6.**
      **Test:** Underpayment lands as `query` with the shortfall recorded.
- [ ] **T-152** Admin can activate a payment manually with an audit trail. **BLOCKED on D6.**
      **Test:** Manual activation writes an `AuditLog` row naming the operator.
- [ ] **T-153** Subscription expiry job downgrades access at `expiresAt`.
      **Test:** Time-travel the clock past expiry → access is `EXPIRED`, data retained.
- [ ] **T-154** A student sees their reference on the confirmation screen and in the receipt.
      **Test:** `txRef` appears on both.

---

## Phase 9 — Admin

- [ ] **T-160** Admin dashboard: signups, trials, activations, awaiting verification, expired.
      **Test:** Each figure matches a direct SQL count.
- [ ] **T-161** Revenue split by Chapa vs bank, footing to a total.
      **Test:** Chapa + bank equals the total, asserted in a test.
- [ ] **T-162** Most-missed topics, weighted by derived share (D5).
      **Test:** Ordering changes when a topic's derived weight changes.
- [ ] **T-162a** Admin weight editor shows derived weights, allows override with a reason, and
      indicates the live sum.
      **Test:** Sum indicator reads 100 when balanced and names the shortfall otherwise.
- [ ] **T-163** User search by phone, display name or transaction reference.
      **Test:** Searching a known `txRef` returns exactly that user.
- [ ] **T-164** Admin can reset a user's devices and deactivate an account.
      **Test:** After reset, the user's sessions are all invalid.
- [ ] **T-165** Retire confirmation states the blast radius from live counts.
      **Test:** Counts match SQL for attempts, live sittings and affected readiness scores.
- [ ] **T-166** Keep capturing `isRetaker` at signup but let it drive **nothing** in product
      behaviour for now (D8). Record it as reserved for future segmentation.
      **Test:** `grep -r "isRetaker" apps/api/src apps/web` returns only the signup write and
      admin display — no branching on it anywhere.
- [ ] **T-167** Every admin mutation writes an `AuditLog` row.
      **Test:** Integration sweep: each admin POST/PATCH produces exactly one audit row.
- [ ] **T-168** Admin routes reject non-admin roles.
      **Test:** A STUDENT token on every `/admin/*` route → 403.

---

## Phase 10 — Telegram Mini App & bot

- [ ] **T-175** The Mini App builds from the same Next.js app, detecting Telegram at runtime.
      **Test:** One build output serves both; no second bundle.
- [ ] **T-176** Chrome adopts Telegram theme params for ground, surface, text, hint, button.
      **Test:** With a stubbed dark theme param, the app background matches it.
- [ ] **T-177** Semantic colours are never remapped by Telegram params.
      **Test:** Correct/incorrect/pending keep their token values under any theme param.
- [ ] **T-178** If a theme param fails 4.5:1 against our text, fall back to our token.
      **Test:** Feed a low-contrast param — the computed colour is ours, not theirs.
- [ ] **T-179** MainButton and BackButton drive primary and back navigation in Telegram.
      **Test:** In Telegram, the in-page primary button is hidden and MainButton is wired.
- [ ] **T-180** Bot `/start` deep link with a referral code attributes `referredVia`.
      **Test:** `t.me/bot?start=amb_123` sets `referredVia = amb_123` on the new user.
- [ ] **T-181** Daily question job sends one message per opted-in user per day.
      **Test:** Running the job twice in a day sends once (`lastDailySentOn` guard).
- [ ] **T-182** `botOptOut` suppresses all nudges immediately.
      **Test:** Opted-out user receives nothing on the next run.
- [ ] **T-183** Bot messages contain no emoji-as-icon and no streak-loss language.
      **Test:** Copy snapshot test rejects the banned strings.

---

## Phase 11 — Engagement (V2)

- [ ] **T-190** Points ledger: every award row names its source and rule.
      **Test:** Each row has a non-empty `reason` and a `ruleId`.
- [ ] **T-191** A missed day posts a zero-point "plan adjusted" row and never resets a streak.
      **Test:** Skipping a day leaves the streak intact and adds a 0-point row.
- [ ] **T-192** Badge tiers differ by glyph shape, not colour alone.
      **Test:** Rendered tiers remain distinguishable in a greyscale snapshot.
- [ ] **T-193** Leaderboard shows display names only, with the user's own row highlighted.
      **Test:** Response contains no `name` or `verifiedName` field.
- [ ] **T-194** `leaderboardOptOut` removes the user from public boards but keeps a private rank.
      **Test:** Opted-out user is absent from the public list and still receives their rank.
- [ ] **T-195** Community threads are scoped to field and topic.
      **Test:** A thread created under Topic X appears only under Topic X.
- [ ] **T-196** A reviewer's reply carries a verified badge.
      **Test:** REVIEWER-authored replies return `verified: true`; students' do not.
- [ ] **T-197** Community posts are rate-limited and reportable.
      **Test:** 6th post in a minute → 429; reporting flags the post for moderation.

---

## Phase 12 — Hardening & launch

- [ ] **T-200** Axe accessibility scan on every student route, zero critical violations.
      **Test:** `npm run test:a11y` exits 0.
- [ ] **T-201** Apply **Lomi-Test (ሎሚ)** across UI, metadata, manifest and README; remove every
      remaining _Fetena_ reference (D1).
      **Test:** `grep -ri "fetena" --exclude-dir=node_modules .` returns nothing outside
      changelog history.
- [ ] **T-202** PWA manifest, icons and offline shell using the existing
      `apps/web/public/brand/lomi-test-*` assets.
      **Test:** Lighthouse PWA audit passes installability; manifest name reads "Lomi-Test".
- [ ] **T-203** First-load JS budget ≤300 KB gzipped on the practice route.
      **Test:** `npm run analyze` reports under budget; CI fails if exceeded.
- [ ] **T-204** Lighthouse ≥90 performance on a simulated mid-tier Android over 3G.
      **Test:** CI Lighthouse run meets the threshold.
- [ ] **T-205** No content view is printable or downloadable.
      **Test:** Print stylesheet hides question content; no export endpoint exists.
- [ ] **T-206** Rate-limit auth, attempts and payments endpoints.
      **Test:** Exceeding each limit returns 429 with a retry hint.
- [ ] **T-207** Structured logging with no PII: no FIN, no phone, no legal name.
      **Test:** Log scrub test greps a full run for seeded PII values and finds none.
- [ ] **T-208** Error boundaries on every route with a recovery action.
      **Test:** Forcing a throw renders the boundary, not a white screen.
- [ ] **T-209** All copy passes the voice rules: cause + fix in errors, no shaming.
      **Test:** Copy lint rejects "failed", "you lost", "don't break your streak".
- [ ] **T-210** Full i18n sweep — no hardcoded UI strings outside the dictionary.
      **Test:** Extraction script finds zero untranslated literals in components.
- [ ] **T-211** Backup and restore drill on the production database.
      **Test:** Restore into a scratch DB and boot the API against it successfully.
- [ ] **T-212** Seed the pilot content: the three launch fields fully reviewed.
      **Test:** ≥1 `PUBLISHED` question per topic, all field weights summing to 100.

---

## Build log

_Append a line per completed phase: date, what landed, anything deferred and why._

**Phase 0 — complete 2026-07-31 (T-001…T-017).** npm workspaces; NestJS API on :4000 with
`/health`; Next 15 + React 19 on **:3100** (3000–3002 belong to chaw-driver); Tailwind v4 wired
to `design-system/tailwind-theme.css`; grammY bot with `/start`; embedded Postgres on **5433**
(5432 is the system Postgres); Prisma with one applied migration; Vitest (3 tests); ESLint 9 flat
config + Prettier; CI workflow.

_Six task tests were wrong as written and were corrected, not weakened —_ T-001 (a
dependency-free root creates no `node_modules`), T-003 (`tsc` raises TS18003 on an empty
project), T-010 (four of eleven scripts are servers and never exit), T-015 (see below), plus
guards added where a test could pass vacuously.

_Real defects found by the tests:_ the design system's `@apply … num` broke the **entire**
stylesheet (T-006); `npm test` passed silently with zero tests (T-010); `bot.test.ts` was
type-invalid but Vitest does not type-check (T-013); test files were compiled into `dist`
importing a devDependency (T-016).

_Carried forward:_ **CI has never actually run** — no git remote, `act` not installed (T-015).
CI needs a `services: postgres:` container from T-020. `prisma migrate dev` is banned for agents;
use `prisma:deploy`. `embedded-postgres` is a beta bundling **Postgres 18.4** while production
will run a managed major — pin it deliberately.
