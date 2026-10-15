#!/usr/bin/env bash
# Applies every migration to an empty PostgreSQL database and runs the security
# checks. Uses the usual PG* variables (PGHOST, PGPORT, PGUSER, PGPASSWORD).
#
#   tools/db-test/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

db="${TEST_DATABASE:-app_fiuba_test}"
dropdb --if-exists "$db"
createdb "$db"

psql -q -v ON_ERROR_STOP=1 -d "$db" -f tools/db-test/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql -q -v ON_ERROR_STOP=1 -1 -d "$db" -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tools/db-test/security.sql
