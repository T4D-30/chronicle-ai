-- ============================================================
--  Chronicle AI — Director Reference Documents
--  Migration: 0006_director_documents
--
--  Idempotency strategy:
--    Table/index creation uses CREATE TABLE/INDEX IF NOT EXISTS.
--    Policy creation uses DROP IF EXISTS + CREATE to stay safe.
--    Trigger uses DROP IF EXISTS + CREATE.
--    Storage bucket creation is guarded with a NOT EXISTS check.
--    Safe to run multiple times on a clean or existing DB.
--
--  Scope:
--    1. Create director_documents table (metadata + extracted text)
--    2. Full-text search column + GIN index (first retrieval strategy —
--       see docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md for why full-text
--       search was chosen over embeddings as the starting implementation)
--    3. Row Level Security — owner-only, same pattern as every other table
--    4. Storage bucket for the raw uploaded file (private, signed-URL
--       access only — this is the first Storage bucket this project uses;
--       every prior file upload, e.g. portraits, has used a base64 text
--       column instead, which is not appropriate here given file sizes)
-- ============================================================

-- ---- director_documents -----------------------------------------------

-- One row per uploaded reference document (DM guide, campaign bible,
-- homebrew rules, world lore, character notes). Belongs to exactly one
-- campaign — see docs/design/CAMPAIGN_MODE.md and
-- docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md for why this is deliberately
-- distinct from Campaign Import (src/lib/campaignImport/), which parses a
-- document ONCE at creation time and discards it; this table is for
-- documents that persist and are referenced across many future turns.

create table if not exists public.director_documents (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,

  category         text not null default 'other'
                     check (category in (
                       'dm_guide', 'campaign_bible', 'homebrew_rules',
                       'world_lore', 'character_notes', 'other'
                     )),

  file_name        text not null,
  file_type        text not null
                     check (file_type in (
                       'application/pdf',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'text/plain',
                       'text/markdown'
                     )),
  file_size_bytes  integer not null check (file_size_bytes > 0),

  storage_path     text not null,

  extracted_text   text,

  search_vector    tsvector generated always as (
                     to_tsvector('english', coalesce(extracted_text, ''))
                   ) stored,

  is_indexed       boolean not null default false,

  uploaded_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.director_documents is
  'Persistent reference material (DM guides, campaign bibles, homebrew rules, world lore, character notes) the Director can retrieve from during narration. Distinct from Campaign Import, which parses a document once at campaign creation and does not persist it.';
comment on column public.director_documents.extracted_text is
  'Plain text extracted by a DirectorDocumentParser implementation. Null (and is_indexed = false) until a real parser runs — the shipped ManualDocumentParser never populates this.';
comment on column public.director_documents.search_vector is
  'Generated full-text search column. The first (and, as of this migration, only) retrieval strategy — see docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md for the embeddings alternative considered and deferred.';

create index if not exists director_documents_campaign_id_idx
  on public.director_documents (campaign_id);

create index if not exists director_documents_search_vector_idx
  on public.director_documents using gin (search_vector);

-- ============================================================
--  Row Level Security
-- ============================================================

alter table public.director_documents enable row level security;

drop policy if exists "director_documents: owner access" on public.director_documents;

create policy "director_documents: owner access"
  on public.director_documents for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
--  updated_at trigger
-- ============================================================

drop trigger if exists director_documents_updated_at on public.director_documents;

create trigger director_documents_updated_at
  before update on public.director_documents
  for each row execute procedure public.update_updated_at();

-- ============================================================
--  Storage bucket
-- ============================================================

-- Private bucket — no public read access. Every read goes through a
-- signed URL generated server-side after an RLS-checked ownership lookup
-- against director_documents, same access-control shape as the table
-- itself. This is the first Storage bucket this project uses (portraits
-- use a base64 text column instead — see migration 0005) because
-- reference documents can be tens of pages, too large to store inline
-- without bloating row size.

insert into storage.buckets (id, name, public)
select 'director-documents', 'director-documents', false
where not exists (
  select 1 from storage.buckets where id = 'director-documents'
);

-- Storage RLS: a user may only read/write objects in their own
-- "<user_id>/..." path prefix within the bucket. The upload service is
-- responsible for always writing to storagePath = `${userId}/${uuid}`
-- (see src/lib/supabase/directorDocuments.ts) so this policy's path-prefix
-- check is meaningful.

drop policy if exists "director_documents storage: owner access" on storage.objects;

create policy "director_documents storage: owner access"
  on storage.objects for all
  using (
    bucket_id = 'director-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'director-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
--  Retrieval function
-- ============================================================

-- Full-text search across one campaign's indexed documents, ranked by
-- relevance (ts_rank) with a generated excerpt (ts_headline) around the
-- best-matching portion of each document. This is the query the
-- application-layer FullTextRetriever (src/lib/directorDocuments/
-- fullTextRetriever.ts) calls via supabase.rpc() — a plain PostgREST
-- filter (.textSearch()) alone cannot produce ranked results with
-- excerpts in one round-trip, hence a dedicated function.
--
-- SECURITY DEFINER is intentionally NOT used — this function runs with
-- the caller's privileges, so the existing RLS policy on
-- director_documents (owner-only) applies automatically. A user can only
-- ever search their own documents, same as every other read path.

create or replace function public.search_director_documents(
  p_campaign_id uuid,
  p_query text,
  p_limit integer default 5
)
returns table (
  document_id uuid,
  file_name text,
  category text,
  excerpt text,
  relevance_score real
)
language sql
stable
as $$
  select
    id as document_id,
    file_name,
    category,
    ts_headline(
      'english',
      coalesce(extracted_text, ''),
      websearch_to_tsquery('english', p_query),
      'MaxFragments=1, MaxWords=60, MinWords=15'
    ) as excerpt,
    ts_rank(search_vector, websearch_to_tsquery('english', p_query)) as relevance_score
  from public.director_documents
  where campaign_id = p_campaign_id
    and is_indexed = true
    and search_vector @@ websearch_to_tsquery('english', p_query)
  order by relevance_score desc
  limit greatest(p_limit, 0)
$$;

comment on function public.search_director_documents is
  'Full-text search across one campaign''s indexed director_documents, ranked by ts_rank with a ts_headline excerpt. Runs with caller privileges (not SECURITY DEFINER) so the owner-only RLS policy on director_documents applies. websearch_to_tsquery tolerates free-form player input (unlike plainto_tsquery, it understands quotes and OR) without requiring the caller to construct tsquery syntax.';
