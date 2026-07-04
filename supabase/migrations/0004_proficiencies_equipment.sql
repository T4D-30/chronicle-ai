-- ============================================================
--  Chronicle AI — Skill Proficiencies, Save Proficiencies, Equipment
--  Migration: 0004_proficiencies_equipment
--
--  Idempotency strategy:
--    All additions use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
--    Safe to run multiple times; no-ops on subsequent runs.
--
--  Scope:
--    Phase 1.6 extended CharacterSheet (the in-memory engine type) with
--    skillProficiencies, savingThrowProficiencies, and equipment fields,
--    but no DB columns existed to persist them — every character loaded
--    from the database hydrated these as empty arrays regardless of what
--    had actually been set. This migration closes that gap.
--
--    Schema for each column is enforced by the TypeScript engine layer
--    (src/lib/engine/skills.ts, equipment.ts), not the DB — consistent
--    with how `conditions`, `features`, `inventory`, and `spells` already
--    work on this table (migration 0002).
-- ============================================================

-- ---- characters: new columns -----------------------------------

-- Skill proficiencies — SkillId[] from src/lib/engine/skills.ts.
-- e.g. ["stealth", "athletics", "sleight_of_hand"]
alter table public.characters
  add column if not exists skill_proficiencies jsonb not null default '[]'::jsonb;

-- Saving throw proficiencies — StatName[] ('STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA').
-- e.g. ["DEX", "INT"]
alter table public.characters
  add column if not exists saving_throw_proficiencies jsonb not null default '[]'::jsonb;

-- Equipment loadout — EquipmentItem[] from src/lib/engine/equipment.ts.
-- Flat numeric bonuses only (attackBonus, armorBonus, skillBonus, saveBonus,
-- passiveBonus) — magical effects out of scope per the Phase 1.6 spec.
alter table public.characters
  add column if not exists equipment jsonb not null default '[]'::jsonb;

-- ---- comments --------------------------------------------------

comment on column public.characters.skill_proficiencies is
  'Serialized SkillId[] from skills.ts. Validated by engine on write via buildCharacter().';
comment on column public.characters.saving_throw_proficiencies is
  'Serialized StatName[] (six-letter ability codes). Validated by engine on write.';
comment on column public.characters.equipment is
  'Serialized EquipmentItem[] from equipment.ts. Flat numeric bonuses only — no magical effects.';

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
--    skill_proficiencies (NEW), saving_throw_proficiencies (NEW), equipment (NEW),
--    created_at, updated_at
-- ============================================================
