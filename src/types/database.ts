/**
 * Chronicle AI — Database Row Types
 * Phase 1.3
 *
 * These mirror the Supabase schema after migrations 0001–0003.
 * Run `supabase gen types typescript --local > src/types/supabase-generated.ts`
 * after applying migrations to replace this file with generated types.
 *
 * JSONB columns use typed interfaces defined in src/types/campaign.ts.
 * Importing those types here keeps DB types and domain types in sync.
 */

import type { ActiveCondition, ConcentrationState } from '@/lib/engine/conditions'
import type { DirectorConfig, WorldState } from './campaign'

// ── profiles ──────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string               // references auth.users.id
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ── characters ────────────────────────────────────────────────────────────────

export interface CharacterRow {
  id: string
  user_id: string

  // Narrative identity
  name: string
  archetype: string
  ancestry: string
  background: string

  // Progression
  level: number
  experience: number

  // Ability scores
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number

  // Derived combat stats
  max_hp: number
  current_hp: number
  temp_hp: number
  armor_class: number
  speed: number
  proficiency_bonus: number
  hit_die: string

  // Death saves
  death_saves_success: number
  death_saves_failure: number

  // JSONB
  conditions: ActiveCondition[]
  features: FeatureRow[]
  inventory: InventoryItemRow[]
  spells: SpellDataRow
  concentration: ConcentrationState | null

  // Added in migration 0004 (Phase 1.7)
  skill_proficiencies: string[]          // SkillId[] from skills.ts
  saving_throw_proficiencies: string[]   // StatName[] from intent.ts
  equipment: EquipmentRowItem[]          // EquipmentItem[] from equipment.ts

  // Added in migration 0005 (Volume II, Phase 2.1)
  portrait_url: string | null            // data: URL in this phase
  bio: string                            // freeform in-fiction biography

  created_at: string
  updated_at: string
}

/** Mirrors EquipmentItem from src/lib/engine/equipment.ts for DB row typing. */
export interface EquipmentRowItem {
  id: string
  name: string
  slot: 'weapon' | 'armor' | 'shield' | 'accessory'
  equipped: boolean
  attackBonus?: number
  armorBonus?: number
  skillBonus?: { skill: string; value: number }
  saveBonus?: { ability: string; value: number }
  passiveBonus?: { skill: string; value: number }
}

/** A single class/race/background feature stored in the features JSONB column. */
export interface FeatureRow {
  id: string
  name: string
  description: string
  source: string   // e.g. "Fighter 1", "Human", "Soldier background"
}

/** A single inventory item stored in the inventory JSONB column. */
export interface InventoryItemRow {
  id: string
  name: string
  quantity: number
  weight: number    // lbs
  equipped: boolean
  description: string
}

/** Spell data shape stored in the spells JSONB column. Phase 5 full schema. */
export interface SpellDataRow {
  slots?: Record<string, number>   // "1" → 4, "2" → 3, etc.
  prepared?: string[]              // spell names/ids
  known?: string[]
}

// ── campaigns ────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string
  user_id: string
  title: string
  description: string | null
  status: 'idle' | 'active' | 'paused' | 'completed'
  character_id: string | null

  // Added in migration 0003
  director_config: DirectorConfig
  world_state: WorldState
  tone: 'grim' | 'heroic' | 'mysterious' | 'comedic' | null
  difficulty: 'easy' | 'standard' | 'brutal'

  created_at: string
  updated_at: string
}

// ── game_sessions ─────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string
  campaign_id: string
  turn_number: number
  status: 'active' | 'paused' | 'completed'
  current_mode: 'exploration' | 'combat' | 'map'   // added in 0003
  started_at: string
  ended_at: string | null
}

// ── narrative_turns ───────────────────────────────────────────────────────────

export interface NarrativeTurnRow {
  id: string
  session_id: string
  turn_number: number
  player_input: string
  ai_narration: string
  dice_rolls: DiceRollRecord[]   // typed from ResolutionSummary in Phase 1.1
  mode: 'exploration' | 'combat' | 'map'   // added in 0003
  created_at: string
}

/**
 * The shape of each element in narrative_turns.dice_rolls.
 * Matches ResolutionSummary from resolveAction.ts.
 */
export interface DiceRollRecord {
  rawInput: string
  category: string
  stat: string
  dc: number
  roll: {
    faces: number[]
    modifier: number
    total: number
    mode: string
    isNatural20: boolean
    isNatural1: boolean
  }
  outcome: string
  outcomeLabel: string
  margin: number
  isSuccess: boolean
  timestamp: string
}

// ── Database interface (for Supabase client generic) ──────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles:        { Row: ProfileRow }
      characters:      { Row: CharacterRow }
      campaigns:       { Row: CampaignRow }
      game_sessions:   { Row: SessionRow }
      narrative_turns: { Row: NarrativeTurnRow }
    }
  }
}

// ── Supabase GenericTable-compatible Database interface ────────────────────────
// The previous Database interface only had Row types. Supabase requires
// Row, Insert, Update, and Relationships for full type inference on
// .insert(), .update(), and .upsert() calls.
//
// Insert = Row minus auto-generated fields (id, timestamps)
// Update = Partial<Insert>
// Relationships = [] (no FK metadata needed for our query patterns)

type EmptyRelationships = []

export interface DatabaseV2 {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: EmptyRelationships
      }
      characters: {
        Row: CharacterRow
        Insert: Omit<CharacterRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CharacterRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: EmptyRelationships
      }
      campaigns: {
        Row: CampaignRow
        Insert: Omit<CampaignRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampaignRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: EmptyRelationships
      }
      game_sessions: {
        Row: SessionRow
        Insert: Omit<SessionRow, 'id' | 'started_at' | 'ended_at'>
        Update: Partial<Omit<SessionRow, 'id' | 'campaign_id' | 'started_at'>>
        Relationships: EmptyRelationships
      }
      narrative_turns: {
        Row: NarrativeTurnRow
        Insert: Omit<NarrativeTurnRow, 'id' | 'created_at'>
        Update: Partial<Omit<NarrativeTurnRow, 'id' | 'session_id' | 'created_at'>>
        Relationships: EmptyRelationships
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
