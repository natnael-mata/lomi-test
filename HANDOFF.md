# Handoff — Phase 8: Payments, subscription, identity

This is a **second git worktree** of `lomi-test`, running in parallel with the main
session. Same repository and history, separate working directory, separate branch,
**separate database**.

- Worktree: `/home/beki-dev/dev/lomi-test-payments`
- Branch: `phase-8-payments` (branched from `main` at `db0a6f5`)
- Database: `lomi_test_payments` on `localhost:5433`
- Main session is on `main`, working Phases 4 → 5 → 6 → 7

## Start here

Read `TASK.md` and work **Phase 8 only** (T-140 … T-159). Everything before it is
done or owned by someone else. Then follow `CLAUDE.md`, which carries the
conventions and the mistakes already paid for.

## The rules that keep the two sessions from colliding

**1. Never start the database.** The embedded Postgres on 5433 is started by the
_main_ worktree (`npm run db:dev`). It is already running and this worktree points
at its own database inside it. If it is down, ask — do not start a second one, the
port will not allow it.

**2. Only ever APPEND to `apps/api/prisma/schema.prisma`.** The other session is
adding `Attempt` and `Sitting` to the same file. Add `Plan`, `Subscription`,
`Payment` and the Fayda models at the **end**; do not reformat, reorder or edit any
existing model. Migration filenames are timestamped, so they will not collide — but
two edits to the same lines will.

**3. Only tick Phase 8 lines in `TASK.md`.** Both sessions write to this file. Stay
inside your phase's block and the merge stays trivial.

**4. Do not touch these** — the other session is actively changing them:
`design-system/tailwind-theme.css`, `apps/web/components/*`, `apps/web/app/design/*`,
`apps/api/src/{questions,review,import,audit}/`.

**5. Port 3100 belongs to the main session.** If you need a web dev server, use a
different port and say so.

## What is already built that you will need

- **Auth** (Phase 3): `SessionGuard` at `apps/api/src/auth/session.guard.ts` gives you
  `req.auth.userId`. Sessions are rows, not just JWTs — revocation is real.
- **`User`** already has `phone`, `telegramId`, `displayName`, `fieldId`. Fayda's FIN
  hash and the verified name are yours to add (T-155+).
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

When Phase 8 is done (or you stop), the main session merges:

```bash
git -C /home/beki-dev/dev/lomi-test merge phase-8-payments
```

Expect conflicts only in `TASK.md` and the tail of `schema.prisma`, and only if rule
2 or 3 was broken.
