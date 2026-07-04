-- ============================================================
--  Minimal storage schema stub for local Postgres testing.
--
--  Real Supabase projects provide a full `storage` schema (the Storage
--  API service). This stub provides ONLY what our migrations (0006+)
--  require to apply cleanly against a bare local Postgres instance:
--    - storage.buckets table (bucket registry)
--    - storage.objects table (object metadata, RLS target)
--    - storage.foldername() function (path-prefix helper used in RLS)
--
--  This file is NOT part of the Chronicle AI migration set. It exists
--  solely to let migration 0006 (director_documents) apply cleanly for
--  integration testing purposes — actual file upload/download against
--  Supabase Storage is not exercised by local integration tests (no
--  local Storage API server exists here), only the RLS policies and
--  table/column presence are.
-- ============================================================

create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- Real Supabase's storage.foldername() splits an object path like
-- "user-uuid/doc-uuid.pdf" into an array of path segments, e.g.
-- ARRAY['user-uuid', 'doc-uuid.pdf'] — used by our RLS policy to check
-- the first path segment matches auth.uid(). This stub reproduces that
-- exact behavior using string_to_array on '/'.
create or replace function storage.foldername(name text) returns text[] as $$
  select string_to_array(name, '/')
$$ language sql immutable;
