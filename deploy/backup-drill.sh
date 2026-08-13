#!/usr/bin/env bash
#
# The backup and restore drill (T-211). Runs ON the box.
#
# **A backup nobody has restored is a rumour.** This dumps the live database,
# restores it into a scratch database, boots the API against the *copy*, and
# only then reports success — because "pg_dump exited 0" proves the dump ran,
# not that anything in it can be brought back.
#
# Everything here is scoped to Lomi-Test:
#
#   - `pg_dump` of `lomi_test` only, NEVER `pg_dumpall`. This cluster also holds
#     Chaw Taxi's and EIMS's databases, and a cluster-wide dump would copy other
#     people's data into our directory.
#   - The scratch database is created and dropped by this script and named so it
#     cannot be mistaken for anything real.
#   - The API is booted on its own port so the live one is never touched.
set -euo pipefail

set -a; . /srv/lomi-test/.env; set +a

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR=/srv/lomi-test/backups
SCRATCH_DB=lomi_test_restore_check
DRILL_PORT=4401

mkdir -p "$BACKUP_DIR"

say() { printf '\n== %s\n' "$1"; }

cleanup() {
  # The scratch database goes whether the drill passed or failed. Leaving a
  # copy of every student's data lying around is a worse outcome than a failed
  # drill.
  sudo -u postgres dropdb --if-exists "$SCRATCH_DB" >/dev/null 2>&1 || true
  [[ -n "${DRILL_PID:-}" ]] && kill "$DRILL_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

say "Dumping lomi_test (never pg_dumpall — this cluster is shared)"
DUMP="$BACKUP_DIR/lomi_test-$STAMP.dump"
pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$DUMP"
ls -lh "$DUMP" | awk '{print $5, $9}'

say "Restoring into $SCRATCH_DB"
sudo -u postgres dropdb --if-exists "$SCRATCH_DB"
sudo -u postgres createdb "$SCRATCH_DB" --owner lomi_app
RESTORE_URL="${DATABASE_URL%/*}/$SCRATCH_DB"
pg_restore --no-owner --no-acl --dbname="$RESTORE_URL" "$DUMP"

say "Comparing what came back"
FAILED=0
for table in User Question Subscription Payment PointEntry Thread Post AuditLog; do
  live=$(psql "$DATABASE_URL" -tAc "select count(*) from \"$table\"")
  copy=$(psql "$RESTORE_URL" -tAc "select count(*) from \"$table\"")
  status="ok"
  if [[ "$live" != "$copy" ]]; then status="MISMATCH"; FAILED=1; fi
  printf '  %-14s live=%-6s restored=%-6s %s\n' "$table" "$live" "$copy" "$status"
done

# The schema too, not only the rows. A restore that brought the data back
# without the constraints would pass a row count and fail the first write.
say "Constraints and triggers"
for check in Payment_settled_has_actor PointEntry_names_its_source Post_body_not_empty; do
  found=$(psql "$RESTORE_URL" -tAc "select count(*) from pg_constraint where conname='$check'")
  printf '  %-32s %s\n' "$check" "$([[ "$found" == "1" ]] && echo ok || { echo MISSING; FAILED=1; })"
done
triggers=$(psql "$RESTORE_URL" -tAc "select count(*) from pg_trigger where not tgisinternal")
printf '  %-32s %s\n' "triggers" "$triggers"
[[ "$triggers" -lt 1 ]] && FAILED=1

say "Booting the API against the restored copy"
# The real thing, not a connection test: a restore is only proven when the
# application it exists for can start on it.
(
  cd /srv/lomi-test/current/apps/api
  DATABASE_URL="$RESTORE_URL" API_PORT="$DRILL_PORT" node dist/main.js > /tmp/drill-api.log 2>&1 &
  echo $! > /tmp/drill-api.pid
)
DRILL_PID=$(cat /tmp/drill-api.pid)

for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$DRILL_PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

if curl -fsS --max-time 5 "http://127.0.0.1:$DRILL_PORT/health"; then
  echo
  echo "  the API started on the restored database"
else
  echo "  the API did NOT start on the restored database:"
  tail -20 /tmp/drill-api.log
  FAILED=1
fi

say "Result"
if [[ "$FAILED" == "0" ]]; then
  echo "  DRILL PASSED — $DUMP restores, and the API runs on it."
else
  echo "  DRILL FAILED — see above. The backup cannot be relied on."
fi

# Keep the last few dumps and no more. An unbounded backup directory fills a
# shared 20 GB disk and takes the neighbours down with it.
ls -1t "$BACKUP_DIR"/lomi_test-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f
echo "  kept: $(ls -1 "$BACKUP_DIR"/lomi_test-*.dump 2>/dev/null | wc -l) dump(s)"

exit "$FAILED"
