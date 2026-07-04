/**
 * Chronicle AI — Campaign Domain Types
 * Phase 1.3
 *
 * Domain types for campaign-level structures stored as JSONB.
 * These are the TypeScript contracts the Director AI reads and writes.
 * The DB stores raw JSON; these types make it safe to work with.
 */

import type { GameStatus } from './game'

// ── Director Configuration ────────────────────────────────────────────────────

export type CampaignTone = 'grim' | 'heroic' | 'mysterious' | 'comedic'
export type CampaignDifficulty = 'easy' | 'standard' | 'brutal'
export type GameMode = 'exploration' | 'combat' | 'map'

/**
 * Narration framing preference — distinct from mechanical difficulty.
 * Purely presentational: the dice resolver, outcome ladder, and every
 * other engine module are identical regardless of this value (Constitution:
 * "the rules engine remains constant"). This only shapes how the Director
 * narrates outcomes — e.g. a 'cinematic' campaign gets more dramatic prose
 * around the same FULL_SUCCESS roll a 'crunchy' campaign reports tersely.
 */
export type RulesStyle = 'narrative' | 'standard' | 'crunchy' | 'cinematic'

/**
 * Configuration that defines how the AI Director runs a specific campaign.
 * Set at campaign creation; can be updated between sessions.
 * Stored in campaigns.director_config JSONB.
 */
export interface DirectorConfig {
  tone: CampaignTone
  difficulty: CampaignDifficulty
  /**
   * Narration framing preference. See RulesStyle — never affects mechanics.
   */
  rulesStyle: RulesStyle
  /**
   * The hidden narrative arc — the campaign's secret overarching plot.
   * Only revealed through play; the player never sees this directly.
   * e.g. "The merchant guild is secretly funding the necromancer."
   */
  hiddenArc: string
  /**
   * Deterministic seed for world generation consistency.
   * Used to reproduce consistent world details across sessions.
   */
  worldSeed: string
  /** The Director's memory of individual NPCs across the campaign. */
  npcMemory: NpcMemoryEntry[]
  /** Active plot threads the Director is tracking. */
  activeThreads: PlotThread[]
  /** Current game mode at the time of last session save. */
  currentMode: GameMode
}

/** Default empty DirectorConfig for new campaigns. */
export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  tone: 'heroic',
  difficulty: 'standard',
  rulesStyle: 'standard',
  hiddenArc: '',
  worldSeed: '',
  npcMemory: [],
  activeThreads: [],
  currentMode: 'exploration',
}

// ── NPC Memory ────────────────────────────────────────────────────────────────

/**
 * The Director's persistent memory of a named NPC across the campaign.
 * Allows consistent characterisation across sessions.
 */
export interface NpcMemoryEntry {
  id: string
  name: string
  /** Current disposition toward the player character. */
  disposition: 'friendly' | 'neutral' | 'suspicious' | 'hostile'
  /** Key facts the Director remembers about this NPC. */
  knownFacts: string[]
  /** Last known location (location ID or description). */
  lastKnownLocation: string | null
  /** Whether the player knows this NPC is alive. */
  isAlive: boolean
  /** Whether the player has met this NPC. */
  metPlayer: boolean
}

// ── Plot Threads ──────────────────────────────────────────────────────────────

export type ThreadStatus = 'active' | 'resolved' | 'abandoned'

/**
 * An active narrative plot thread the Director is tracking.
 * Threads are the Director's internal structure for dramatic pacing.
 */
export interface PlotThread {
  id: string
  title: string
  description: string
  status: ThreadStatus
  /** Turn number when this thread became active. */
  startedAtTurn: number
  /** Turn number when this thread resolved/ended, or null if ongoing. */
  resolvedAtTurn: number | null
  /** Whether this thread is part of the hidden arc. */
  isHidden: boolean
}

// ── World State ───────────────────────────────────────────────────────────────

/**
 * The Living World state — the current state of the campaign world.
 * Persists between sessions. Never reset; only evolved.
 * Stored in campaigns.world_state JSONB.
 *
 * The AI Director can update this between turns.
 * The player's client reads it to render the map and context panels.
 */
export interface WorldState {
  /** Version counter — incremented on each Director update. */
  version: number
  /** Known locations the player has discovered. */
  locations: LocationState[]
  /** All NPCs in the world, regardless of whether the player has met them. */
  npcs: NpcWorldState[]
  /** Faction power states. */
  factions: FactionState[]
  /** Scheduled world events (triggers by turn number). */
  scheduledEvents: WorldEvent[]
  /** The current in-world date/time description. */
  worldTime: string | null
  /**
   * The location ID the player character is currently at, per the Director's
   * most recent narration. Null until the Director sets it (Phase 9.2).
   * Distinct from `visited`/`discovered` on LocationState, which track
   * history rather than "where the player is right now."
   */
  currentLocationId: string | null
}

/** Default empty WorldState for new campaigns. */
export const DEFAULT_WORLD_STATE: WorldState = {
  version: 0,
  locations: [],
  npcs: [],
  factions: [],
  scheduledEvents: [],
  worldTime: null,
  currentLocationId: null,
}

// ── Location State ────────────────────────────────────────────────────────────

export type LocationType =
  | 'region'
  | 'town'
  | 'dungeon'
  | 'building'
  | 'floor'
  | 'room'
  | 'outdoor'

export interface LocationState {
  id: string
  name: string
  type: LocationType
  parentId: string | null        // Hierarchy: room belongs to floor, floor to building, etc.
  description: string
  /** Whether the player has physically visited this location. */
  visited: boolean
  /** Whether this location is visible on the player's map layer. */
  discovered: boolean
  /** Key-value properties the Director can set. e.g. { cleared: true, alertLevel: 'high' } */
  properties: Record<string, string | number | boolean>
}

// ── NPC World State ───────────────────────────────────────────────────────────

export interface NpcWorldState {
  id: string
  name: string
  /** Current location ID. */
  locationId: string | null
  isAlive: boolean
  /** Brief stat summary for combat (Director-set). */
  combatStats: NpcCombatStats | null
}

export interface NpcCombatStats {
  maxHp: number
  currentHp: number
  armorClass: number
  attackBonus: number
  damageDice: string    // e.g. "1d8+3"
  isHostile: boolean
}

// ── Faction State ─────────────────────────────────────────────────────────────

export interface FactionState {
  id: string
  name: string
  /** Player's current standing with this faction. */
  standing: 'allied' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile'
  /** Brief description for Director context. */
  description: string
}

// ── World Events ──────────────────────────────────────────────────────────────

export interface WorldEvent {
  id: string
  description: string
  /** Turn number at which this event triggers. */
  triggerAtTurn: number
  /** Whether the event has already fired. */
  triggered: boolean
  /** What the Director should do when this fires (prompt hint). */
  directorHint: string
}

// ── Campaign Domain Object ─────────────────────────────────────────────────────

/**
 * Full campaign domain object — the hydrated form of CampaignRow.
 * Used in app-layer code (Zustand stores, Edge Function payloads).
 * The DB returns CampaignRow; this is what the engine and UI work with.
 */
export interface Campaign {
  id: string
  userId: string
  title: string
  description: string | null
  status: GameStatus
  characterId: string | null
  directorConfig: DirectorConfig
  worldState: WorldState
  tone: CampaignTone | null
  difficulty: CampaignDifficulty
  createdAt: string
  updatedAt: string
}
