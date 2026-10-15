#!/usr/bin/env bash
# Starts a local copy of the database with PostgREST and the gateway (see README.md).
# Uses the usual PG* variables for a local PostgreSQL.
set -euo pipefail
cd "$(dirname "$0")/../.."
here=tools/local-supabase
db="${LOCAL_DATABASE:-app_fiuba_local}"
version=v12.2.3

if [ ! -x "$here/.bin/postgrest" ]; then
  mkdir -p "$here/.bin"
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$version/postgrest-$version-linux-static-x64.tar.xz" | tar xJ -C "$here/.bin"
fi

dropdb --if-exists "$db"
createdb "$db"
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tools/db-test/supabase-stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -1 -d "$db" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$db" <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end \$\$;
grant anon, authenticated to authenticator;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'prueba@fi.uba.ar');
SQL

host="${PGHOST:-localhost}"
cat > "$here/.bin/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@/$db?host=$host&port=${PGPORT:-5432}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "local-test-secret-local-test-secret-123"
server-port = 3001
CONF

"$here/.bin/postgrest" "$here/.bin/postgrest.conf" > "$here/.bin/postgrest.log" 2>&1 &
node "$here/gateway.mjs" > "$here/.bin/gateway.log" 2>&1 &
sleep 2
echo "Listo. En otra terminal:"
echo "  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local npm run dev"
echo "Cookie de sesión del usuario de prueba (prueba@fi.uba.ar):"
node "$here/gateway.mjs" cookie
