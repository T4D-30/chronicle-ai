-- ============================================================
--  Minimal auth schema stub for local Postgres testing.
--
--  Real Supabase projects provide a full `auth` schema (GoTrue).
--  This stub provides ONLY what our migrations (0001–0003) require:
--    - auth.users table (FK target)
--    - auth.uid() function (used in RLS policies)
--
--  This file is NOT part of the Chronicle AI migration set.
--  It exists solely to let migrations 0001-0003 apply cleanly
--  against a bare local Postgres instance for type generation
--  and integration testing purposes.
-- ============================================================

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  -- Required by public.handle_new_user() trigger (migration 0001), which
  -- reads NEW.raw_user_meta_data ->> 'display_name' on every auth.users insert.
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Stub auth.uid() — returns NULL by default (no session context).
-- Tests that need RLS to pass will SET request.jwt.claim.sub explicitly,
-- mirroring how Supabase's PostgREST layer sets it from the JWT.
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$ language sql stable;
