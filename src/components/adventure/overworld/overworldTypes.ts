/**
 * overworldTypes — Presentation 3 (Playable Overworld Foundation)
 *
 * The typed model for the top-down overworld. THE CORE RULE: the
 * overworld is a presentation and input layer. It reads real campaign/
 * character state, renders fixture map content, and emits typed
 * intents; the adapter grounds those intents as plain-text actions
 * through the EXISTING Adventure Controller (actions.submitAction —
 * the same mechanism the StoryHud, ActionStrip, and AtlasMapPanel's
 * movement buttons use). It never mutates game state, never
 * writes to Supabase, never bypasses the controller.
 *
 * Movement is deliberately NOT an emitted intent: tile position is
 * pure presentation state (like scroll position), and per the phase
 * spec only meaningful named-location changes persist — via `exit`
 * intents — never per-tile steps.
 *
 * Maps are handcrafted fixture/content data for the vertical slice
 * (see maps/), declared in an ASCII legend for readability. They are
 * never written into campaign data.
 */

// ─── Geometry ─────────────────────────────────────────────────────────────────

export interface TileCoord {
  x: number
  y: number
}

export type FacingDirection = 'up' | 'down' | 'left' | 'right'

export const FACING_DELTA: Record<FacingDirection, TileCoord> = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

// ─── Tiles ────────────────────────────────────────────────────────────────────

/** Visual kind only — walkability is explicit, never inferred from looks. */
export type TileKind =
  | 'grass'
  | 'path'
  | 'stone'
  | 'wall'
  | 'tree'
  | 'water'
  | 'floor'

export interface OverworldTile {
  kind: TileKind
  walkable: boolean
}

/** ASCII legend → tile row decoding, so fixture maps stay readable. */
export type TileLegend = Record<string, OverworldTile>

export function buildTiles(legend: TileLegend, rows: string[]): OverworldTile[][] {
  return rows.map((row, y) =>
    [...row].map((ch, x) => {
      const tile = legend[ch]
      if (!tile) throw new Error(`Unknown legend character "${ch}" at ${x},${y}`)
      return { ...tile }
    }),
  )
}

// ─── Entities / zones ─────────────────────────────────────────────────────────

export type InteractionVerb = 'talk' | 'inspect' | 'collect' | 'enter'

export type EntityKind = 'npc' | 'object'

export interface OverworldEntity {
  id: string
  kind: EntityKind
  name: string
  pos: TileCoord
  /** MVP rendering glyph (emoji, same registry approach as Icon). */
  glyph: string
  /** Verbs this entity supports (npc: talk; objects: inspect/collect/enter). */
  interactions: InteractionVerb[]
  /** Grounded action text per verb — exactly what the adapter submits
   *  through the existing controller. */
  intentText: Partial<Record<InteractionVerb, string>>
  /** Whether the entity's tile blocks movement. */
  blocking: boolean
}

export interface SpawnPoint {
  id: string
  pos: TileCoord
  facing: FacingDirection
}

export interface ExitZone {
  id: string
  pos: TileCoord
  /** Destination map id + spawn point id within it. */
  to: string
  spawn: string
  label: string
  /** Grounded action text submitted on exit — the ONLY persistence
   *  path for area changes (a named-location change the controller
   *  resolves), never per-tile steps. */
  intentText: string
}

export interface EncounterTrigger {
  id: string
  pos: TileCoord
  label: string
}

export interface OverworldMap {
  id: string
  name: string
  width: number
  height: number
  tiles: OverworldTile[][]
  spawns: SpawnPoint[]
  entities: OverworldEntity[]
  exits: ExitZone[]
  encounters: EncounterTrigger[]
}

// ─── Intents — the overworld's ONLY output ───────────────────────────────────

export type OverworldIntent =
  | { type: 'interact'; verb: InteractionVerb; entityId: string; entityName: string; text: string }
  | { type: 'exit'; exitId: string; to: string; spawn: string; text: string }
  | { type: 'encounter'; triggerId: string; label: string }

// ─── Collision / queries ─────────────────────────────────────────────────────

export function inBounds(map: OverworldMap, pos: TileCoord): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < map.width && pos.y < map.height
}

export function entityAt(map: OverworldMap, pos: TileCoord): OverworldEntity | null {
  return map.entities.find((e) => e.pos.x === pos.x && e.pos.y === pos.y) ?? null
}

export function exitAt(map: OverworldMap, pos: TileCoord): ExitZone | null {
  return map.exits.find((e) => e.pos.x === pos.x && e.pos.y === pos.y) ?? null
}

export function encounterAt(map: OverworldMap, pos: TileCoord): EncounterTrigger | null {
  return map.encounters.find((e) => e.pos.x === pos.x && e.pos.y === pos.y) ?? null
}

/** A tile is walkable when in bounds, its tile allows it, and no
 *  blocking entity occupies it. Exits and encounter triggers are
 *  walkable by design (you step onto them). */
export function isWalkable(map: OverworldMap, pos: TileCoord): boolean {
  if (!inBounds(map, pos)) return false
  if (!map.tiles[pos.y][pos.x].walkable) return false
  const entity = entityAt(map, pos)
  if (entity?.blocking) return false
  return true
}

// ─── Fixture-map validation (unit-tested; run in tests, not production) ──────

export function validateMap(map: OverworldMap): string[] {
  const errors: string[] = []

  if (map.tiles.length !== map.height) {
    errors.push(`tiles rows ${map.tiles.length} ≠ height ${map.height}`)
  }
  map.tiles.forEach((row, y) => {
    if (row.length !== map.width) errors.push(`row ${y} width ${row.length} ≠ ${map.width}`)
  })

  const ids = new Set<string>()
  for (const list of [map.spawns, map.entities, map.exits, map.encounters] as const) {
    for (const item of list) {
      if (ids.has(item.id)) errors.push(`duplicate id "${item.id}"`)
      ids.add(item.id)
      if (!inBounds(map, item.pos)) errors.push(`"${item.id}" out of bounds`)
    }
  }

  for (const spawn of map.spawns) {
    if (inBounds(map, spawn.pos) && !map.tiles[spawn.pos.y][spawn.pos.x].walkable) {
      errors.push(`spawn "${spawn.id}" on unwalkable tile`)
    }
  }
  for (const exit of map.exits) {
    if (inBounds(map, exit.pos) && !map.tiles[exit.pos.y][exit.pos.x].walkable) {
      errors.push(`exit "${exit.id}" on unwalkable tile`)
    }
    if (!exit.intentText) errors.push(`exit "${exit.id}" missing intent text`)
  }
  for (const entity of map.entities) {
    for (const verb of entity.interactions) {
      if (!entity.intentText[verb]) {
        errors.push(`entity "${entity.id}" missing intent text for "${verb}"`)
      }
    }
  }

  return errors
}
