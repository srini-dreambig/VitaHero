#!/bin/bash
# Make the whole test suite runnable, not just the half that needs no database.
#
# functions/*.test.ts is two suites in one. The stubbed-driver tests run
# anywhere; the ones that matter most — the full school -> camp -> screening ->
# review -> release chain — need real Postgres and skip themselves silently
# without TEST_DATABASE_URL. That was 187 of 325 tests quietly not running, and
# it is how a release path that could not survive a forty-child camp sat in a
# green suite.
#
# Postgres 16 is already in the image, so this starts it rather than installing
# it. Safe to run twice: an existing cluster is reused and the databases are
# recreated per run by the tests themselves.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PGBIN=/usr/lib/postgresql/16/bin
PGDATA=/var/tmp/pgdata
PGSOCK=/var/tmp/pgsock
PGPORT=5433
PGUSER_RUN=pgrunner

# ── Worker dependencies ────────────────────────────────────────
# bun install rather than a frozen install: the container image is cached after
# this hook, so the cost is paid once.
if [ -d "$PROJECT_DIR/functions" ]; then
  (cd "$PROJECT_DIR/functions" && bun install >/dev/null 2>&1) || \
    echo "session-start: bun install failed; the stubbed tests still run" >&2
fi

# ── Postgres ───────────────────────────────────────────────────
if [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "session-start: no Postgres in this image; database tests will skip" >&2
  exit 0
fi

# initdb refuses to run as root, so the cluster belongs to its own user.
id -u "$PGUSER_RUN" >/dev/null 2>&1 || useradd -m "$PGUSER_RUN"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  rm -rf "$PGDATA"
  mkdir -p "$PGDATA"
  chown "$PGUSER_RUN:$PGUSER_RUN" "$PGDATA"
  su "$PGUSER_RUN" -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
fi

# The default socket directory is /var/run/postgresql, which this user cannot
# write to; without -k the server starts and immediately dies on the lock file.
mkdir -p "$PGSOCK"
chown "$PGUSER_RUN:$PGUSER_RUN" "$PGSOCK"

if ! su "$PGUSER_RUN" -c "$PGBIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
  su "$PGUSER_RUN" -c \
    "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPORT -k $PGSOCK -c listen_addresses=127.0.0.1' -l /var/tmp/pg.log start" >/dev/null
fi

# pg_ctl returns before the server is accepting connections.
for _ in $(seq 1 30); do
  psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tAc "SELECT 1" >/dev/null 2>&1 && break
  sleep 0.5
done

if ! psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "session-start: Postgres did not come up; database tests will skip" >&2
  exit 0
fi

psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='vitahero_test'" | grep -q 1 || \
  psql -h 127.0.0.1 -p "$PGPORT" -U postgres -c "CREATE DATABASE vitahero_test" >/dev/null

# Each suite creates and drops its own database off this connection string, so
# it points at a throwaway rather than at anything worth keeping.
URL="postgres://postgres@127.0.0.1:$PGPORT/vitahero_test"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export TEST_DATABASE_URL=\"$URL\"" >> "$CLAUDE_ENV_FILE"
  echo "export DATABASE_URL=\"$URL\"" >> "$CLAUDE_ENV_FILE"
fi

# ── Kotlin front end ───────────────────────────────────────────
# Warm the compiler jars so ./tools/kotlin-parse.sh is instant. Maven Central
# is reachable here even though dl.google.com is not, which is why a real parse
# is possible at all while a real build is not.
if [ -x "$PROJECT_DIR/tools/kotlin-parse.sh" ]; then
  KOTLIN_PARSE_CACHE=/var/tmp/vitahero-kotlinc \
    "$PROJECT_DIR/tools/kotlin-parse.sh" >/dev/null 2>&1 || true
  echo "export KOTLIN_PARSE_CACHE=/var/tmp/vitahero-kotlinc" >> "${CLAUDE_ENV_FILE:-/dev/null}"
fi

echo "session-start: Postgres 16 ready on $PGPORT; the database tests will run"
