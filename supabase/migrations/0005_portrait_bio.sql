-- ============================================================
--  Chronicle AI — Portrait + Biography
--  Migration: 0005_portrait_bio
--
--  Idempotency strategy:
--    All additions use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
--    Safe to run multiple times; no-ops on subsequent runs.
--
--  Scope:
--    Volume II, Phase 2.1 (Character Creator UI) requires a Portrait step
--    in the creation wizard and a Biography tab on the character sheet.
--    Neither has any DB column or engine field to persist to — this is a
--    genuinely new gap, not a previously-deferred one, and is "required
--    for UI integration" per the phase's stated engine-modification
--    exception.
--
--    portrait_url stores a data: URL (client-side base64-encoded image)
--    for this phase — no server-side image upload/storage pipeline exists
--    yet. A future phase can swap this for a Supabase Storage object key
--    without changing the column's role (still "however we resolve this
--    character's portrait image").
--
--    bio is freeform player-authored text — the in-fiction biography,
--    distinct from `Notes` (player metagame notes, Style Guide character
--    sheet tab table) which remains out of scope until a later phase.
--    Like `conditions`/`equipment`, schema is enforced by the TypeScript
--    layer (a length cap), not the DB.
-- ============================================================

-- ---- characters: new columns -----------------------------------

-- Character portrait, stored as a data: URL for this phase.
alter table public.characters
  add column if not exists portrait_url text;

-- In-fiction biography / backstory, freeform player-authored text.
alter table public.characters
  add column if not exists bio text not null default '';

-- ---- comments --------------------------------------------------

comment on column public.characters.portrait_url is
  'Character portrait. data: URL (base64) in this phase; may migrate to a Supabase Storage key later. Nullable — not every character has a portrait.';
comment on column public.characters.bio is
  'In-fiction biography / backstory, freeform text. Never parsed mechanically by the engine (Constitution Law 3 / Style Guide Notes-tab rule).';

-- ============================================================
--  RLS — no policy changes needed.
--
--  The existing "characters: owner access" policy from migration 0002
--  is a FOR ALL policy keyed on user_id; it already covers these new
--  columns automatically.
-- ============================================================

-- ============================================================
--  Summary of schema state after this migration:
--
--  public.characters columns:
--    id, user_id, name, archetype, ancestry, background,
--    level, experience,
--    str, dex, con, int, wis, cha,
--    max_hp, current_hp, temp_hp, armor_class, speed,
--    proficiency_bonus, hit_die,
--    death_saves_success, death_saves_failure,
--    conditions, features, inventory, spells, concentration,
--    skill_proficiencies, saving_throw_proficiencies, equipment,
--    portrait_url (NEW), bio (NEW),
--    created_at, updated_at
-- ============================================================
