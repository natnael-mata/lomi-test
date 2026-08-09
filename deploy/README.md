# Deploying Lomi-Test

There was no deployment configuration in this repository before this directory.
What is here targets the convention the other boxes already use — nginx in front,
Node under systemd, PostgreSQL local — and nothing in it is specific to a host
until you fill in `deploy/deploy.env`.

## The rule this is built around

**Everything Lomi-Test owns lives under `/srv/lomi-test`, is named `lomi-*`, and
listens on ports nothing else uses.**

That is not tidiness. The target box already runs other people's live products,
and the failure mode of a careless deploy is not "Lomi-Test is broken" — it is
"something unrelated went down and nobody knows why". So:

- Files: `/srv/lomi-test` and nowhere else.
- Services: `lomi-api`, `lomi-web`, `lomi-bot`. No generic `api` or `web`.
- Database: its own role and its own database, never a shared one.
- Ports: checked for a collision **before** anything starts (`deploy.sh` refuses
  rather than binding over something).

## What must be true before the first deploy

| Thing | Why it blocks |
| --- | --- |
| A hostname pointing at the box | The Chapa webhook and Telegram both need a public URL |
| TLS on that hostname | Telegram refuses a non-HTTPS webhook; so should we |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` | **The only way to sign in.** Without it the site opens and nobody can get past the front door |
| A PostgreSQL role and database | Migrations run against it on every deploy |
| Published questions | Without them practice and exams serve nothing. See "Content" below |
| `CHAPA_SECRET_KEY` | Optional. Without it the three Chapa payment routes answer 503 by design; the bank-transfer route still works |

## First-time setup on the box

```bash
sudo mkdir -p /srv/lomi-test
sudo useradd --system --home /srv/lomi-test --shell /usr/sbin/nologin lomi || true
sudo chown -R lomi:lomi /srv/lomi-test
```

Database, with its own role — never the postgres superuser, and never a database
another product is using:

```bash
sudo -u postgres createuser lomi --pwprompt
sudo -u postgres createdb lomi_test --owner lomi
```

Then the units and the site:

```bash
sudo cp deploy/systemd/lomi-*.service /etc/systemd/system/
sudo cp deploy/nginx/lomi-test.conf /etc/nginx/sites-available/lomi-test
sudo ln -sf /etc/nginx/sites-available/lomi-test /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl daemon-reload
```

`/srv/lomi-test/.env` is written by hand, once, from `.env.production.example`.
**It is never deployed from this repository** — a secret that travels with a
build is a secret in every build artefact and every backup of one.

## Deploying

```bash
./deploy/deploy.sh
```

It builds locally, refuses if the tests do not pass, syncs, runs
`prisma migrate deploy`, and restarts the three services. It never runs
`prisma migrate dev` — that command rewrites migration history and would take the
hand-written foreign keys with it (see CLAUDE.md).

## Content

A fresh database has **no published questions**, so practice and exams will serve
nothing at all. Two ways forward:

- **Demo content** — `npm run db:seed -w api` imports the worked examples from
  `docs/question_import_template.csv`. They land as `DRAFT`, because the importer
  never publishes (T-054); `npm run dev:publish -w api` moves them. Fine for a
  smoke test, not fine for students.
- **Real content** — T-212, the three launch fields fully reviewed. That is
  content work, not a deploy step.

## Rolling back

The previous release stays in `/srv/lomi-test/releases`. `deploy.sh` prints the
command to switch back to it.

**A schema migration does not roll back with the code.** Every migration here is
additive so far, so an older build runs against a newer schema — but that is a
property of what has been written, not a guarantee. Check before assuming it.
