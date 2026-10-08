#!/usr/bin/env bash
# Valide les migrations et lance les tests pgTAP sur un PostgreSQL local
# (sans Docker). Prérequis : PostgreSQL 15+ et pgTAP installés, accès superutilisateur.
# Usage : PGURL=postgresql://postgres@localhost:5432/postgres ./scripts/check-sql.sh
# Avec Docker et la Supabase CLI, préférez : npx supabase db reset && npx supabase test db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGURL="${PGURL:-postgresql://postgres@localhost:5432/postgres}"
DB="mememasters_check_$$"

psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "create database $DB"
trap 'psql "$PGURL" -q -c "drop database if exists $DB" >/dev/null' EXIT
URL="${PGURL%/*}/$DB"

psql "$URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/sql/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"
psql "$URL" -v ON_ERROR_STOP=1 -q -c "create extension if not exists pgtap"
FAILED=0
for t in "$ROOT"/supabase/tests/database/*.test.sql; do
  echo "→ $(basename "$t")"
  OUT="$(psql "$URL" -v ON_ERROR_STOP=1 -q -X --no-psqlrc -t -f "$t" | sed '/^\s*$/d')"
  echo "$OUT" | grep -E "^ *(1\.\.|not ok)" || true
  if echo "$OUT" | grep -qE "^ *not ok"; then FAILED=1; fi
done
if [ "$FAILED" -ne 0 ]; then
  echo "Des tests SQL ont échoué."
  exit 1
fi
echo "Migrations et tests SQL : OK"
