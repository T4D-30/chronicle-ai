#!/usr/bin/env bash
# ============================================================
#  Chronicle AI — Local Test Database Setup
#  Phase 1.5
#
#  Sets up a local PostgreSQL database with migrations 0001-0007
#  applied, plus a minimal auth schema stub, a minimal storage schema
#  stub, and an RLS-enforced test role — everything needed for:
#
#    1. Type generation against a real, fully-migrated schema
#       (prefer the real `supabase gen types --local` command when
#       Docker/Podman is available — see SETUP.md for details)
#    2. `npm run test:integration`
#
#  Usage:
#    bash scripts/setup-test-db.sh
#
#  Idempotent: safe to re-run. Migrations 0002/0003 are themselves
#  idempotent; this script drops and recreates the database fresh
#  each run for a clean slate.
# ============================================================

set -euo pipefail

DB_NAME="chronicle_ai"
PGPASSWORD=postgres
export PGPASSWORD

echo "==> Ensuring PostgreSQL is running..."
if command -v pg_lsclusters >/dev/null 2>&1; then
  service postgresql start || true
fi

echo "==> Setting postgres role password..."
psql -h localhost -U postgres -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true

echo "==> Creating database '${DB_NAME}'..."
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql -h localhost -U postgres -c "CREATE DATABASE ${DB_NAME};"

echo "==> Applying auth schema stub..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/local-test-support/0000_auth_stub.sql

echo "==> Applying storage schema stub..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/local-test-support/0001_storage_stub.sql

echo "==> Applying migration 0001_initial_schema.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0001_initial_schema.sql

echo "==> Applying migration 0002_characters.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0002_characters.sql

echo "==> Applying migration 0003_campaign_data.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0003_campaign_data.sql

echo "==> Applying migration 0004_proficiencies_equipment.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0004_proficiencies_equipment.sql

echo "==> Applying migration 0005_portrait_bio.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0005_portrait_bio.sql

echo "==> Applying migration 0006_director_documents.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0006_director_documents.sql

echo "==> Applying migration 0007_google_oauth_provisioning.sql..."
psql -h localhost -U postgres -d "${DB_NAME}" -f supabase/migrations/0007_google_oauth_provisioning.sql

echo "==> Creating RLS-enforced 'authenticated_test' role..."
psql -h localhost -U postgres -d "${DB_NAME}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated_test') THEN
    CREATE ROLE authenticated_test LOGIN PASSWORD 'authenticated_test' NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO authenticated_test;
GRANT USAGE ON SCHEMA auth TO authenticated_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_test;
GRANT SELECT ON auth.users TO authenticated_test;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated_test;
SQL

echo ""
echo "==> Done. Database ready at:"
echo "      postgresql://postgres:postgres@localhost:5432/${DB_NAME}  (admin / bypasses RLS)"
echo "      postgresql://authenticated_test:authenticated_test@localhost:5432/${DB_NAME}  (RLS enforced)"
echo ""
echo "Next steps:"
echo "  npm run test:integration"
echo "  npm run db:types   (requires Docker/Podman for the real Supabase CLI path)"
