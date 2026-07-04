-- ============================================================
--  Chronicle AI — Characters Table
--  Migration: 0002_characters
--
--  Idempotency strategy:
--    All objects use CREATE TABLE/INDEX IF NOT EXISTS.
--    Policy creation uses DROP IF EXISTS + CREATE to stay safe.
--    Trigger uses CREATE OR REPLACE.
--    Safe to run multiple times on a clean or existing DB.
-- ============================================================

-- ---- characters ------------------------------------------------
-- Stores one row per character. Multiple characters may exist per
-- user (character library), but only one is linked to a campaign
-- at a time (via campaigns.character_id, set in Phase 1.3).

create table if not exists public.characters (
  -- Identity
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- Narrative identity fields
  name         text not null,
  archetype    text not null default 'adventurer',  -- class/subclass e.g. "fighter"
  ancestry     text not null default 'human',        -- species/race e.g. "elf"
  background   text not null default 'wanderer',     -- background e.g. "soldier"

  -- Progression
  level        integer not null default 1
                 check (level between 1 and 20),
  experience   integer not null default 0
                 check (experience >= 0),

  -- Core ability scores (1–20 at creation; engine enforces range)
  str          integer not null default 10 check (str between 1 and 20),
  dex          integer not null default 10 check (dex between 1 and 20),
  con          integer not null default 10 check (con between 1 and 20),
  int          integer not null default 10 check (int between 1 and 20),
  wis          integer not null default 10 check (wis between 1 and 20),
  cha          integer not null default 10 check (cha between 1 and 20),

  -- Derived combat stats (computed by engine, stored for fast reads)
  max_hp           integer not null default 10 check (max_hp >= 1),
  current_hp       integer not null default 10,   -- can go negative (death state)
  temp_hp          integer not null default 0 check (temp_hp >= 0),
  armor_class      integer not null default 10 check (armor_class >= 1),
  speed            integer not null default 30 check (speed >= 0),  -- ft per turn
  proficiency_bonus integer not null default 2 check (proficiency_bonus between 2 and 6),
  hit_die          text not null default 'd8'
                     check (hit_die in ('d6', 'd8', 'd10', 'd12')),

  -- Death saving throws (reset each encounter)
  death_saves_success integer not null default 0 check (death_saves_success between 0 and 3),
  death_saves_failure integer not null default 0 check (death_saves_failure between 0 and 3),

  -- JSONB columns for complex, variable-length structures
  -- Schema for each is enforced by the TypeScript engine layer, not the DB.

  -- ActiveCondition[] — serialized from conditions.ts
  conditions   jsonb not null default '[]'::jsonb,

  -- Feature/trait objects: { id, name, description, source }[]
  features     jsonb not null default '[]'::jsonb,

  -- Inventory: { id, name, quantity, weight, equipped, description }[]
  -- Placeholder: full item schema in Phase 5 (Equipment/Inventory)
  inventory    jsonb not null default '[]'::jsonb,

  -- Spell data: { slots, prepared, known }
  -- Placeholder: full spell schema in Phase 5 (Spells)
  spells       jsonb not null default '{}'::jsonb,

  -- Concentration state: null | { spell, startedAtTurn, targetIds }
  concentration jsonb,

  -- Timestamps
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---- indexes ---------------------------------------------------
create index if not exists characters_user_id_idx on public.characters(user_id);
create index if not exists characters_level_idx   on public.characters(level);

-- ---- comments --------------------------------------------------
comment on table public.characters is
  'Player characters. Each row belongs to one user. Linked to campaigns via campaigns.character_id.';

comment on column public.characters.conditions is
  'Serialized ActiveCondition[] from conditions.ts. Validated by engine on read.';
comment on column public.characters.features is
  'Class/race/background features. { id, name, description, source }[].';
comment on column public.characters.inventory is
  'Item list placeholder. Full schema defined in Phase 5.';
comment on column public.characters.spells is
  'Spell slot and spell data placeholder. Full schema defined in Phase 5.';
comment on column public.characters.concentration is
  'Active concentration: null or { spell, startedAtTurn, targetIds }.';

-- ============================================================
--  Row Level Security
-- ============================================================

alter table public.characters enable row level security;

-- Drop and recreate policies to stay idempotent
drop policy if exists "characters: owner access" on public.characters;

create policy "characters: owner access"
  on public.characters for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
--  updated_at trigger
-- ============================================================

-- update_updated_at() function already exists from migration 0001.
-- We only need to attach the trigger.

drop trigger if exists characters_updated_at on public.characters;

create trigger characters_updated_at
  before update on public.characters
  for each row execute procedure public.update_updated_at();

-- ============================================================
--  Enforce FK from campaigns → characters (deferred add)
--
--  campaigns.character_id was left as a bare uuid column in
--  migration 0001. Now that the characters table exists, we add
--  the FK constraint. This is safe to run once; subsequent runs
--  will see the constraint already exists and skip cleanly via
--  the DO block's exception handler.
-- ============================================================

do $$
begin
  alter table public.campaigns
    add constraint campaigns_character_id_fkey
    foreign key (character_id)
    references public.characters(id)
    on delete set null;
exception
  when duplicate_object then null;  -- constraint already exists, skip
end $$;
