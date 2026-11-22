#!/usr/bin/env bash
# Runs every SQL file twice against a real Postgres (with a small stand-in for Supabase's auth schema),
# then checks the security rules. Needs: psql, and PG* env vars or a local server.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${PGDATABASE:-lbtest}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end$$;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.uid',true),'')::uuid $f$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
SQL
for f in supabase-setup supabase-social supabase-update-3 supabase-update-4; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f.sql" 2>&1 | grep -v NOTICE || true
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f.sql" 2>&1 | grep -v NOTICE || true
done
psql -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql_checks.sql
echo "SQL checks passed"
