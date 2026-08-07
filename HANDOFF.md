# Handoff — Phase 8: Payments, subscription, identity

This is a **second git worktree** of `lomi-test`, running in parallel with the main
session. Same repository and history, separate working directory, separate branch,
**separate database**.

- Worktree: `/home/beki-dev/dev/lomi-test-payments`
- Branch: `phase-8-payments`, **rebased onto `main` at `6df4e18` on 2026-08-05**
- Database: `lomi_test_payments` on `localhost:5433` — migrated to the current schema
- Main session is on `main`; Phases 0–2, 4, 6 and 7 are now complete

## What changed under you (rebase, 2026-08-05)

This branch had one commit of its own — this file — and was ten behind. It has been
replayed onto current `main`, the database migrated, and the whole suite is green
(951 tests). **Four of those changes affect Phase 8 directly:**

**1. Sign-in is Telegram, not SMS.** The owner replaced the OTP flow (T-075–T-078):
a bot cannot message a phone number, so the SMS shape was never buildable. Sign-in is
now a `t.me/<bot>?start=login_<nonce>` deep link. Two consequences for you:

- **The phone number is no longer collected at signup.** It is collected at
  **checkout**, by you, in **T-078a** — the bot asks via `request_contact`, which
  returns a number Telegram has already verified, so `phoneVerifiedAt` is set with no
  SMS provider involved. That task is now Phase 8's, not Phase 3's.
- Rule: reject a shared contact whose `user_id` is not the sender. Telegram lets a
  user forward somebody else's contact card.

**2. The session is an httpOnly cookie** (T-112a), set by
`POST /auth/login-link/claim` and `POST /auth/telegram`, cleared by
`POST /auth/sign-out`. `SessionGuard` reads the cookie first and still accepts a
bearer header. **Any new route that issues a session must set the cookie**, and any
new destructive route must be added to the exclusion list in the T-124 route sweep in
`sitting.e2e.test.ts` — see CLAUDE.md, it has now bitten twice.

**3. `SUBSCRIPTION_ACCESS` is the seam you plug into.** It lives at
`apps/api/src/practice/subscription-access.ts` and currently answers `false` for
everyone (`NoSubscriptionsYet`). The exam paywall and the free-practice limit both
already go through it. **T-111a is one line in `practice.module.ts`** once your
`Subscription` model exists — that is the whole integration.

**4. Two models were appended since you forked:** `TopicWeightOverride` and
`LoginRequest`. Rule 2 below still holds — append after those.

Also: `prisma migrate diff` will offer to **drop eight hand-written foreign keys** on
the exam tables. They are deliberate and invisible to the datamodel. Read the
generated SQL and delete the `DropForeignKey` block before saving any migration.
CLAUDE.md says so too.

## Start here

Read `TASK.md` and work **Phase 8 only** (T-140 … T-159). Everything before it is
done or owned by someone else. Then follow `CLAUDE.md`, which carries the
conventions and the mistakes already paid for.

## The rules that keep the two sessions from colliding

**1. Never start the database.** The embedded Postgres on 5433 is started by the
_main_ worktree (`npm run db:dev`). It is already running and this worktree points
at its own database inside it. If it is down, ask — do not start a second one, the
port will not allow it.

**2. Only ever APPEND to `apps/api/prisma/schema.prisma`.** Add `Plan`,
`Subscription`, `Payment` and the Fayda models **after `LoginRequest`**, the current
last model; do not reformat, reorder or edit any existing model. Migration filenames
are timestamped, so they will not collide — but two edits to the same lines will.

**3. Only tick Phase 8 lines in `TASK.md`.** Both sessions write to this file. Stay
inside your phase's block and the merge stays trivial.

**4. Do not touch these** — the main session is actively changing them. It is now on
**Phase 10, the Telegram Mini App and bot**, so the list has moved:
`design-system/tailwind-theme.css`, `apps/web/components/*`, `apps/web/app/design/*`,
`apps/bot/*`, and `apps/api/src/auth/login-link*`.

`apps/api/src/{questions,review,import,audit}/` are finished and stable — read them
freely, and say so if you need to change one.

**5. Port 3100 belongs to the main session.** If you need a web dev server, use a
different port and say so.

## What is already built that you will need

- **Auth** (Phase 3): `SessionGuard` at `apps/api/src/auth/session.guard.ts` gives you
  `req.auth.userId`. Sessions are rows, not just JWTs — revocation is real.
- **`User`** already has `phone`, `telegramId`, `displayName`, `fieldId`. `phone` is
  now **null for almost everyone** — see the sign-in change above; you are the one who
  fills it, at checkout. Fayda's FIN hash and the verified name are yours to add
  (T-155+).
- **Topic weights are real now** (T-134): `Topic.weightPct` is derived from each
  topic's share of the published bank and always sums to 100. Nothing in Phase 8 needs
  it, but the admin dashboard tasks in Phase 9 do, and they are not yours.
- **Field** has no price column, deliberately. Access is sold by **duration**, not per
  field — 6 months Br 500, 12 months Br 800 (decisions D2/D3). `Plan.priceEtb` is the
  only source of price; T-141 forbids a constant.
- **`AuditService`** (`apps/api/src/audit/audit.service.ts`) writes append-only rows
  inside the caller's transaction. Payment state changes belong in it.

## Standing constraints from the product owner

- **SMS and email tasks are handled separately — skip them**, leave a `> blocked:`
  note under the task and move on.
- Anything needing a real credential (Chapa keys, Fayda API access) is blocked, not
  faked. Write the integration against a documented interface and a stub, mark the
  task blocked, and say exactly which secret is missing.
- A verified real name is **never** shown on a public surface. Fayda binds at purchase
  only, stored as a salted FIN hash: one FIN, one account.

## Definition of done, per task

Green baseline before every commit, from the worktree root:

```bash
npm run format:check && npm run typecheck && npm run lint && npm run build && npm test
```

Then tick the task in `TASK.md` with what was actually verified, and commit.

## Merging back

Rebase onto `main` again before you start a long stretch, and before merging —
this branch fell ten commits behind once already, and the only reason that was
painless is that it had a single doc commit of its own.

When Phase 8 is done (or you stop), the main session merges:

```bash
git -C /home/beki-dev/dev/lomi-test merge phase-8-payments
```

Expect conflicts only in `TASK.md` and the tail of `schema.prisma`, and only if rule
2 or 3 was broken.
