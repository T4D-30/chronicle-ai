-- ============================================================
--  Chronicle AI — Campaign & Session Enhancements
--  Migration: 0003_campaign_data
--
--  Idempotency strategy:
--    All additions use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
--    Index creation uses CREATE INDEX IF NOT EXISTS.
--    Policy drops are guarded with IF EXISTS.
--    Safe to run multiple times; no-ops on subsequent runs.
--
--  Scope:
--    1. Add director_config and world_state JSONB to campaigns
--    2. Add mode column to narrative_turns
--    3. Add session_mode to game_sessions for audit trail
--    4. Add composite indexes for common query patterns
-- ============================================================

-- ---- campaigns: new columns -----------------------------------

-- Director configuration per campaign.
-- Schema (enforced by engine/Director type):
-- {
--   tone: 'grim' | 'heroic' | 'mysterious' | 'comedic',
--   difficulty: 'easy' | 'standard' | 'brutal',
--   hiddenArc: string,
--   worldSeed: string,
--   npcMemory: NpcMemoryEntry[],
--   activeThreads: Thread[],
--   currentMode: 'exploration' | 'combat' | 'map'
-- }
alter table public.campaigns
  add column if not exists director_config jsonb not null default '{}'::jsonb;

-- Living World state — persists between sessions.
-- Schema (evolves in Phase 3 Living World dispatcher):
-- {
--   version: number,
--   locations: LocationState[],
--   npcs: NpcState[],
--   factions: FactionState[],
--   events: WorldEvent[],
--   atlasEntries: AtlasEntry[]
-- }
alter table public.campaigns
  add column if not exists world_state jsonb not null default '{}'::jsonb;

-- Tone shortcut for quick Director reads (denormalized from director_config).
alter table public.campaigns
  add column if not exists tone text
    check (tone in ('grim', 'heroic', 'mysterious', 'comedic') or tone is null);

-- Difficulty shortcut (denormalized from director_config).
alter table public.campaigns
  add column if not exists difficulty text not null default 'standard'
    check (difficulty in ('easy', 'standard', 'brutal'));

-- ---- campaigns: comments --------------------------------------
comment on column public.campaigns.director_config is
  'DirectorConfig JSON. Tone, difficulty, hiddenArc, worldSeed, npcMemory, activeThreads.';
comment on column public.campaigns.world_state is
  'Living World state. Locations, NPCs, factions, events. Evolved by Director, never reset.';
comment on column public.campaigns.tone is
  'Campaign tone shortcut (grim/heroic/mysterious/comedic). Mirrors director_config.tone.';
comment on column public.campaigns.difficulty is
  'Campaign difficulty shortcut. Mirrors director_config.difficulty.';

-- ---- game_sessions: session mode tracking ---------------------

-- Which game mode this session started in.
-- Populated on session creation; updated on mode transitions.
alter table public.game_sessions
  add column if not exists current_mode text not null default 'exploration'
    check (current_mode in ('exploration', 'combat', 'map'));

comment on column public.game_sessions.current_mode is
  'Active game mode: exploration | combat | map. Reflects last mode before session end.';

-- ---- narrative_turns: mode column ----------------------------

-- Which mode produced this turn's narration.
-- Needed by the Director to load the correct context prompt.
alter table public.narrative_turns
  add column if not exists mode text not null default 'exploration'
    check (mode in ('exploration', 'combat', 'map'));

comment on column public.narrative_turns.mode is
  'Game mode when this turn was produced: exploration | combat | map.';

-- ---- additional indexes for Phase 2+ query patterns ----------

-- The narrate Edge Function will query recent turns by session.
-- session_id is already indexed; add turn_number for ordered fetch.
create index if not exists narrative_turns_session_turn_idx
  on public.narrative_turns(session_id, turn_number desc);

-- Campaign queries filtered by status (active campaigns for dashboard).
create index if not exists campaigns_status_idx
  on public.campaigns(user_id, status);

-- ============================================================
--  RLS — campaigns policies update
--
--  The existing "campaigns: owner access" policy from 0001 already
--  covers the new columns (it is a FOR ALL policy using user_id).
--  No policy changes needed.
-- ============================================================

-- ============================================================
--  Verify narrative_turns has the dice_rolls column
--  (was typed as jsonb in 0001; add type annotation if missing)
-- ============================================================

-- dice_rolls column already exists from migration 0001.
-- No action needed.

-- ============================================================
--  Summary of schema state after this migration:
--
--  public.campaigns columns:
--    id, user_id, title, description, status, character_id,
--    director_config (NEW), world_state (NEW),
--    tone (NEW), difficulty (NEW),
--    created_at, updated_at
--
--  public.game_sessions columns:
--    id, campaign_id, turn_number, status,
--    current_mode (NEW),
--    started_at, ended_at
--
--  public.narrative_turns columns:
--    id, session_id, turn_number, player_input,
--    ai_narration, dice_rolls, mode (NEW), created_at
-- ============================================================
