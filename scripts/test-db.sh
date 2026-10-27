#!/usr/bin/env bash
# Kör databastester mot en temporär Postgres (kräver Postgres 15+ lokalt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v postgres || ls /usr/lib/postgresql/*/bin/postgres | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN=()
# Postgres vägrar köra som root.
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$TMP"
  RUN=(runuser -u postgres --)
fi
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null

PSQL=("${RUN[@]}" "$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/backend/supabase/tests/supabase_stub.sql"
for f in "$ROOT"/backend/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/backend/supabase/tests/grants.sql"
"${PSQL[@]}" -f "$ROOT/backend/supabase/tests/schema.test.sql"
