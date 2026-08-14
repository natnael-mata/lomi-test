# Deploying to AletCloud App Hosting

The alternative to `deploy/README.md`, which deploys to the shared VPS. Both are
kept: the VPS deployment is verified and working, and it stays up until this one
is proven.

Decided 2026-08-13: **a private GitHub repo, two apps (API and web), and the
existing database migrated into managed PostgreSQL.** The Telegram bot is a
third app that lands when its token does.

## Why two apps still work as one origin

The web app proxies `/api/*` to the API through a Next.js rewrite, target from
`API_ORIGIN`. **The browser only ever talks to the web app's origin.** That is
what keeps the session cookie working across two separately hosted apps:

- The cookie is httpOnly and `SameSite=Lax`. Same-origin means the browser sends
  it without being asked, and a cross-origin setup would need `SameSite=None`,
  CORS and credentialed fetches — three things to keep in step with every
  environment.
- No preflight on every answer submission, which is a real cost on a slow
  connection.

So the API app does **not** need a public hostname of its own for the product to
work. It needs one only because the web app must reach it, and because Chapa's
webhook must.

`NEXT_PUBLIC_API_BASE_URL` is vestigial — nothing in the web source reads it. The
client calls `/api/*` relative, always.

## The two apps

Both deploy from the **repository root**, not from `apps/*`. This is an npm
workspaces monorepo: building `apps/api` needs the root `package-lock.json` and
the root `node_modules`, so a subdirectory deploy would install the wrong tree.

### App 1 — `lomi-api`

| Setting | Value |
| --- | --- |
| Root directory | `/` (repository root) |
| Build | `npm ci && npx prisma generate --schema apps/api/prisma/schema.prisma && npm run build -w api` |
| Start | `node apps/api/dist/main.js` |
| Port | Assigned by the platform. The app reads `PORT` first |

`prisma generate` runs **before** `build`: the generated client is what the
TypeScript compile type-checks against, and without it the build fails on
missing types rather than on anything informative.

### App 2 — `lomi-web`

| Setting | Value |
| --- | --- |
| Root directory | `/` (repository root) |
| Build | `npm ci && npm run build -w web` |
| Start | `npm run start -w web` |
| Port | Assigned by the platform. `next start` takes `PORT` |

## Migrations

`prisma migrate deploy` must run against the managed database **after** it
exists and **before** the API serves traffic.

If AletCloud has a release or pre-deploy command, put it there. If it does not,
run it by hand from a machine that can reach the database:

```bash
DATABASE_URL='<managed postgres url>' npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

**Never `prisma migrate dev`.** It rewrites migration history and would take the
hand-written foreign keys and triggers with it (see CLAUDE.md).

## Environment

Set on the **API** app:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | From the managed PostgreSQL instance |
| `JWT_SECRET` | `openssl rand -base64 48`. A new one signs out every session |
| `TELEGRAM_BOT_TOKEN` | The only way in. Blank means nobody can sign in |
| `TELEGRAM_BOT_USERNAME` | Without the `@` |
| `BOT_SHARED_SECRET`, `BOT_INTERNAL_TOKEN` | `openssl rand -hex 32` each |
| `CHAPA_SECRET_KEY` | Blank leaves telebirr, CBE Birr and the Chapa page answering 503 by design; bank transfer still works |
| `CHAPA_WEBHOOK_SECRET` | Blank verifies against `CHAPA_SECRET_KEY`, which is what Chapa signs with by default |
| `WEB_BASE_URL` | The **web** app's public URL. Chapa's return URL is built from it |
| `API_BASE_URL` | The web app's URL plus `/api` — that is the address Chapa's webhook must reach |
| `NODE_ENV` | `production` |

Set on the **web** app:

| Variable | Notes |
| --- | --- |
| `API_ORIGIN` | The **API** app's internal or public URL. The rewrite target |
| `NODE_ENV` | `production` |

**`DEV_LOGIN_SECRET` is deliberately absent.** It is the smoke-test sign-in door
(T-206a) and a launch blocker. Set it only if you need to click through before
the Telegram bot exists, and delete the variable afterwards.

## Moving the data

There is a verified dump — today's restore drill (T-211) proved it restores and
that the API boots on it.

```bash
# From the VPS
ssh chaw-taxi 'ls -t /srv/lomi-test/backups/*.dump | head -1'
scp chaw-taxi:/srv/lomi-test/backups/<newest>.dump ./lomi_test.dump

# Into managed PostgreSQL
pg_restore --no-owner --no-acl --dbname='<managed postgres url>' ./lomi_test.dump
```

Restore **before** pointing the API at it, and check the row counts afterwards —
`deploy/backup-drill.sh` shows which tables are worth comparing.

## What to check once it is up

1. `GET /api/health` returns `{"status":"ok"}` through the **web** app's origin,
   which proves the rewrite is pointed correctly.
2. Sign in, and confirm the session survives a page load — that is the
   same-origin cookie working across two apps.
3. `GET /api/payments/plans` returns both plans, which proves the database is
   connected and migrated.

## Sleeping

The free Solo plan sleeps an app when it is idle. A cold start in the middle of
a **three-hour mock exam** is the case to think about before relying on it: the
sitting is server-authoritative and survives, but the student waits. Worth a paid
plan for the API before real students sit papers.
