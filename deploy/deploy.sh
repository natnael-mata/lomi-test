#!/usr/bin/env bash
#
# Deploys Lomi-Test to the host named in deploy/deploy.env.
#
# Builds and tests HERE, ships the result, migrates, restarts. Nothing is built
# on the box: a server that can compile is a server holding a toolchain, and a
# build that only ever ran in production is a build nobody has seen fail.
#
# Refuses rather than guesses. Every check below exists because the box runs
# other people's live products and the interesting failure is not "Lomi-Test is
# down", it is "something unrelated went down".
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

if [[ ! -f "$HERE/deploy.env" ]]; then
  echo "deploy/deploy.env is missing. Copy deploy.env.example and fill it in." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$HERE/deploy.env"

: "${SSH_TARGET:?set SSH_TARGET in deploy/deploy.env}"
: "${SSH_PORT:=22}"
: "${REMOTE_ROOT:=/srv/lomi-test}"
: "${API_PORT:?set API_PORT}"
: "${WEB_PORT:?set WEB_PORT}"

SSH=(ssh -p "$SSH_PORT" "$SSH_TARGET")

# The neighbours on this box, by name.
#
# 196.190.212.158 also runs Chaw Taxi, EIMS, Elpis and Semayawi, and the
# standing constraint is that deploying one must never disturb another. Every
# remote command goes through `remote()`, which refuses if the script it is
# about to run so much as mentions one of them. It is a blunt instrument and
# that is the point: the mistakes worth catching here are typos and copied
# lines, not clever attacks.
NEIGHBOURS='chaw|eims|elpis|semayawi|postgresql@|nginx\.conf|pg_hba'

remote() {
  local script; script="$(cat)"
  if grep -qiE "$NEIGHBOURS" <<<"$script"; then
    echo "REFUSED: a remote command mentioned a neighbouring product or a shared config file." >&2
    grep -inE "$NEIGHBOURS" <<<"$script" >&2
    exit 1
  fi
  "${SSH[@]}" bash -seuo pipefail <<<"$script"
}
RELEASE="$(git -C "$REPO" rev-parse --short HEAD)"
REMOTE_RELEASE="$REMOTE_ROOT/releases/$RELEASE"

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

say "Checking the working tree"
if [[ -n "$(git -C "$REPO" status --porcelain)" ]]; then
  # A release named after a commit that does not describe what shipped is a
  # release nobody can roll back to with any confidence.
  echo "Working tree is dirty. Commit or stash first — the release is named for HEAD." >&2
  exit 1
fi

say "Tests"
# Before the build, not after. A green build of a broken product is not progress.
npm --prefix "$REPO" run -s typecheck
npm --prefix "$REPO" run -s lint
npm --prefix "$REPO" test --workspaces --if-present

say "Build"
npm --prefix "$REPO" run -s build

say "Checking the box"
remote <<REMOTE
  test -f "$REMOTE_ROOT/.env" || {
    echo "$REMOTE_ROOT/.env is missing. Write it by hand from .env.production.example." >&2
    exit 1
  }

  # Ports, before anything binds. Only complain if the listener is not already
  # ours: on a redeploy our own services are of course holding them.
  for port in $API_PORT $WEB_PORT; do
    holder=\$(ss -ltnp "sport = :\$port" 2>/dev/null | tail -n +2 || true)
    if [[ -n "\$holder" ]] && ! grep -qE 'lomi|node' <<<"\$holder"; then
      echo "Port \$port is held by something that is not ours:" >&2
      echo "\$holder" >&2
      exit 1
    fi
  done
REMOTE

say "Shipping $RELEASE"
# Source is not shipped, only what runs: dist, .next, the Prisma schema and
# migrations, and the manifests needed to install production dependencies.
rsync -az --delete -e "ssh -p $SSH_PORT" \
  --include='apps/' \
  --include='apps/api/***' --include='apps/web/***' --include='apps/bot/***' \
  --include='package.json' --include='package-lock.json' \
  --exclude='**/node_modules' --exclude='**/src/***' --exclude='**/*.test.*' \
  --exclude='**/.env' \
  --exclude='*' \
  "$REPO/" "$SSH_TARGET:$REMOTE_RELEASE/"

say "Installing, migrating, switching"
remote <<REMOTE
  cd "$REMOTE_RELEASE"
  npm ci --omit=dev
  npx prisma generate --schema apps/api/prisma/schema.prisma

  set -a; source "$REMOTE_ROOT/.env"; set +a

  # deploy, never dev. \`migrate dev\` rewrites history and would drop the
  # hand-written foreign keys with it (CLAUDE.md).
  npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

  PREVIOUS=\$(readlink -f "$REMOTE_ROOT/current" 2>/dev/null || echo none)
  ln -sfn "$REMOTE_RELEASE" "$REMOTE_ROOT/current"
  echo "previous release: \$PREVIOUS"
REMOTE

say "Restarting"
# Named explicitly, one by one. Never `systemctl restart all` or anything that
# resolves to a set — on this box that set contains other people's products.
"${SSH[@]}" "systemctl restart lomi-api lomi-web lomi-bot && sleep 3 && systemctl is-active lomi-api lomi-web lomi-bot"

say "Health — ours, then the neighbours"
"${SSH[@]}" "curl -fsS http://127.0.0.1:$API_PORT/health && echo"
# nginx is shared. If this deploy touched it, the neighbours are how you find
# out — checking only our own site is how a shared box goes down quietly.
"${SSH[@]}" "for host in chaw admin eims; do printf '%s: ' \$host; curl -s -o /dev/null -w '%{http_code}\\n' -k https://\$host.196-190-212-158.nip.io/ || echo unreachable; done"

cat <<DONE

Deployed $RELEASE.

To roll back, point the symlink at the previous release printed above and
restart:

  ssh -p $SSH_PORT $SSH_TARGET 'ln -sfn <previous> $REMOTE_ROOT/current && sudo systemctl restart lomi-api lomi-web lomi-bot'

A schema migration does NOT roll back with the code. Every migration so far is
additive, so an older build runs against a newer schema — but check rather than
assume.
DONE
