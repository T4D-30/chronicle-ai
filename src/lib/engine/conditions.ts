/**
 * Chronicle AI — Conditions Engine
 * Phase 1.3
 *
 * Implements the D&D-adjacent condition system.
 * All logic is pure TypeScript — no Supabase, no React, no RNG.
 *
 * Two-layer design:
 *   ConditionDefinition — static rulebook entry (what does this condition DO?)
 *   ActiveCondition     — runtime instance on a character (applied when, expires when?)
 *
 * The engine reads ActiveCondition[] from the character sheet and resolves
 * mechanical effects (roll modifiers, immunity flags, incapacitation state)
 * before any dice roll or action resolution.
 *
 * Constitution alignment:
 *   - Pillar 5: "conditions — the vocabulary is intentionally standard"
 *   - Law 3: "The Character Sheet Is the Source of Truth" — conditions live on
 *             the sheet and are read structurally, never inferred from prose
 *   - Law 6: transparency — each condition exposes exactly what it modifies
 */

import type { RollMode } from './dice'

// ─── Condition Identifiers ────────────────────────────────────────────────────

/**
 * All supported condition IDs. Using a const enum keeps values as literal
 * strings at runtime (not numbers), which is safe for JSONB round-trips.
 *
 * Ordered alphabetically for readability.
 */
export const CONDITION_IDS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const

export type ConditionId = (typeof CONDITION_IDS)[number]

// ─── Roll Modifier Shape ──────────────────────────────────────────────────────

/**
 * The roll-context categories that conditions can affect.
 * Mirrors the categories used by the resolver — no new coupling surface.
 */
export type RollContext =
  | 'attack_roll'
  | 'ability_check'
  | 'saving_throw'
  | 'damage_roll'
  | 'death_saving_throw'

/**
 * A mechanical modifier a condition applies to a specific roll context.
 * The resolver reads these and applies them to CheckConfig before rolling.
 */
export interface ConditionModifier {
  context: RollContext
  /** 'advantage' or 'disadvantage' overrides. Normal = no change. */
  mode?: RollMode
  /** Flat numeric penalty/bonus (rare for conditions; most use mode). */
  flatBonus?: number
  /** Human-readable explanation for the combat log / UI tooltip. */
  reason: string
}

// ─── Condition Definition ─────────────────────────────────────────────────────

/**
 * The static rulebook definition of a condition.
 * One entry per ConditionId — never changes at runtime.
 */
export interface ConditionDefinition {
  id: ConditionId
  /** Display name for UI. */
  name: string
  /** One-sentence mechanical summary for combat log tooltips. */
  summary: string
  /**
   * Full mechanical effects list, human-readable.
   * Displayed in the Conditions tab of the character sheet.
   */
  effects: string[]
  /**
   * Machine-readable roll modifiers applied while this condition is active.
   * The engine applies these before any affected roll.
   */
  modifiers: ConditionModifier[]
  /**
   * Whether this condition prevents the creature from taking actions.
   * Incapacitated, paralyzed, stunned, unconscious all set this.
   */
  preventsActions: boolean
  /**
   * Whether this condition prevents movement.
   */
  preventsMovement: boolean
  /**
   * Conditions that are automatically applied alongside this one.
   * e.g. unconscious implies incapacitated.
   */
  implies: ConditionId[]
  /**
   * If true, attacks against a creature with this condition have advantage.
   */
  grantsMeleeAdvantageToAttackers: boolean
  /**
   * If true, attacks against a creature with this condition have disadvantage.
   */
  grantsMeleeDisadvantageToAttackers: boolean
}

// ─── Condition Definitions Table ─────────────────────────────────────────────

export const CONDITIONS: Record<ConditionId, ConditionDefinition> = {
  blinded: {
    id: 'blinded',
    name: 'Blinded',
    summary: 'Cannot see; attacks made with disadvantage; attackers have advantage.',
    effects: [
      'Automatically fails any ability check requiring sight.',
      'Attack rolls have disadvantage.',
      'Attacks against this creature have advantage.',
    ],
    modifiers: [
      { context: 'attack_roll', mode: 'disadvantage', reason: 'Blinded: cannot see target' },
    ],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },

  charmed: {
    id: 'charmed',
    name: 'Charmed',
    summary: 'Cannot attack the charmer; charmer has advantage on social checks.',
    effects: [
      'Cannot attack or target the charmer with harmful abilities or effects.',
      'The charmer has advantage on Charisma checks directed at this creature.',
    ],
    modifiers: [],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  deafened: {
    id: 'deafened',
    name: 'Deafened',
    summary: 'Cannot hear; automatically fails hearing-based ability checks.',
    effects: [
      'Cannot hear.',
      'Automatically fails any ability check requiring hearing.',
    ],
    modifiers: [],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  exhaustion: {
    id: 'exhaustion',
    name: 'Exhaustion',
    summary: 'Stacking debuff. Level 1: disadvantage on ability checks. Level 6: death.',
    effects: [
      'Level 1: Disadvantage on ability checks.',
      'Level 2: Speed halved.',
      'Level 3: Disadvantage on attack rolls and saving throws.',
      'Level 4: Hit point maximum halved.',
      'Level 5: Speed reduced to 0.',
      'Level 6: Death.',
      'Reduced by one level per long rest.',
    ],
    modifiers: [
      { context: 'ability_check', mode: 'disadvantage', reason: 'Exhaustion (level 1+): ability checks with disadvantage' },
    ],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  frightened: {
    id: 'frightened',
    name: 'Frightened',
    summary: 'Disadvantage on checks and attacks while source of fear is visible; cannot move toward it.',
    effects: [
      'Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.',
      'Cannot willingly move closer to the source of fear.',
    ],
    modifiers: [
      { context: 'attack_roll', mode: 'disadvantage', reason: 'Frightened: source of fear in sight' },
      { context: 'ability_check', mode: 'disadvantage', reason: 'Frightened: source of fear in sight' },
    ],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  grappled: {
    id: 'grappled',
    name: 'Grappled',
    summary: 'Speed becomes 0; ends if grappler is incapacitated or moved out of reach.',
    effects: [
      'Speed becomes 0 and cannot benefit from bonuses to speed.',
      'Ends if the grappler is incapacitated or the creature is moved beyond the grappler\'s reach.',
    ],
    modifiers: [],
    preventsActions: false,
    preventsMovement: true,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  incapacitated: {
    id: 'incapacitated',
    name: 'Incapacitated',
    summary: 'Cannot take actions or reactions.',
    effects: [
      'Cannot take actions.',
      'Cannot take reactions.',
    ],
    modifiers: [],
    preventsActions: true,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  invisible: {
    id: 'invisible',
    name: 'Invisible',
    summary: 'Cannot be seen; attacks with advantage; attackers have disadvantage.',
    effects: [
      'Impossible to see without special sense.',
      'Considered heavily obscured for hiding purposes.',
      'Attack rolls have advantage.',
      'Attack rolls against this creature have disadvantage.',
    ],
    modifiers: [
      { context: 'attack_roll', mode: 'advantage', reason: 'Invisible: attackers cannot see you' },
    ],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: true,
  },

  paralyzed: {
    id: 'paralyzed',
    name: 'Paralyzed',
    summary: 'Incapacitated; auto-fails STR/DEX saves; attacks have advantage; hits within 5 ft are critical.',
    effects: [
      'Is incapacitated (cannot take actions or reactions).',
      'Cannot move or speak.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against the creature have advantage.',
      'Any attack that hits the creature is a critical hit if the attacker is within 5 feet.',
    ],
    modifiers: [
      { context: 'saving_throw', mode: 'disadvantage', reason: 'Paralyzed: auto-fail STR/DEX saves' },
    ],
    preventsActions: true,
    preventsMovement: true,
    implies: ['incapacitated'],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },

  petrified: {
    id: 'petrified',
    name: 'Petrified',
    summary: 'Transformed to stone; incapacitated; auto-fails STR/DEX saves; resistance to all damage.',
    effects: [
      'Is transformed to stone along with any nonmagical equipment.',
      'Weight increases tenfold and ceases aging.',
      'Is incapacitated, cannot move or speak, and is unaware of surroundings.',
      'Attack rolls against the creature have advantage.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Resistance to all damage.',
      'Immune to poison and disease (already present poison/disease is suspended).',
    ],
    modifiers: [
      { context: 'saving_throw', mode: 'disadvantage', reason: 'Petrified: auto-fail STR/DEX saves' },
    ],
    preventsActions: true,
    preventsMovement: true,
    implies: ['incapacitated'],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },

  poisoned: {
    id: 'poisoned',
    name: 'Poisoned',
    summary: 'Disadvantage on attack rolls and ability checks.',
    effects: [
      'Disadvantage on attack rolls.',
      'Disadvantage on ability checks.',
    ],
    modifiers: [
      { context: 'attack_roll', mode: 'disadvantage', reason: 'Poisoned: disadvantage on attacks' },
      { context: 'ability_check', mode: 'disadvantage', reason: 'Poisoned: disadvantage on ability checks' },
    ],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: false,
    grantsMeleeDisadvantageToAttackers: false,
  },

  prone: {
    id: 'prone',
    name: 'Prone',
    summary: 'Attacks with disadvantage; melee attacks against have advantage; ranged attacks have disadvantage.',
    effects: [
      'Only movement option is to crawl (each foot costs 1 extra foot of movement).',
      'Can stand up using half of movement speed.',
      'Attack rolls have disadvantage.',
      'Melee attack rolls against the creature have advantage.',
      'Ranged attack rolls against the creature have disadvantage.',
    ],
    modifiers: [
      { context: 'attack_roll', mode: 'disadvantage', reason: 'Prone: disadvantage on attacks' },
    ],
    preventsActions: false,
    preventsMovement: false,
    implies: [],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },

  restrained: {
    id: 'restrained',
    name: 'Restrained',
    summary: 'Speed 0; attacks with disadvantage; attackers have advantage; disadvantage on DEX saves.',
    effects: [
      'Speed becomes 0 and cannot benefit from bonuses to speed.',
      'Attack rolls have disadvantage.',
      'Attack rolls against the creature have advantage.',
      'Dexterity saving throws have disadvantage.',
    ],
    modifiers: [
      { context: 'attack_roll', mode: 'disadvantage', reason: 'Restrained: attacks with disadvantage' },
      { context: 'saving_throw', mode: 'disadvantage', reason: 'Restrained: Dexterity saves with disadvantage' },
    ],
    preventsActions: false,
    preventsMovement: true,
    implies: [],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },

  stunned: {
    id: 'stunned',
    name: 'Stunned',
    summary: 'Incapacitated; auto-fails STR/DEX saves; attackers have advantage.',
    effects: [
      'Is incapacitated (cannot take actions or reactions).',
      'Cannot move.',
      'Can only speak falteringly.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against the creature have advantage.',
    ],
    modifiers: [
      { context: 'saving_throw', mode: 'disadvantage', reason: 'Stunned: auto-fail STR/DEX saves' },
    ],
    preventsActions: true,
    preventsMovement: true,
    implies: ['incapacitated'],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },

  unconscious: {
    id: 'unconscious',
    name: 'Unconscious',
    summary: 'Incapacitated; drops held items; falls prone; auto-fails STR/DEX saves; attacks crit within 5 ft.',
    effects: [
      'Is incapacitated (cannot take actions or reactions).',
      'Cannot move or speak.',
      'Drops held items and falls prone.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against the creature have advantage.',
      'Any attack that hits the creature is a critical hit if the attacker is within 5 feet.',
    ],
    modifiers: [
      { context: 'saving_throw', mode: 'disadvantage', reason: 'Unconscious: auto-fail STR/DEX saves' },
    ],
    preventsActions: true,
    preventsMovement: true,
    implies: ['incapacitated', 'prone'],
    grantsMeleeAdvantageToAttackers: true,
    grantsMeleeDisadvantageToAttackers: false,
  },
}

// ─── Active Condition (runtime instance) ─────────────────────────────────────

/**
 * A condition that is currently applied to a specific character.
 * This is what gets stored in the `conditions` JSONB column on the characters table.
 *
 * Serialization-safe: all values are primitives or plain objects.
 */
export interface ActiveCondition {
  /** Which condition this is. */
  id: ConditionId
  /**
   * Narrative source — for the combat log and character sheet display.
   * e.g. "spider bite", "Hold Person spell", "tavern brawl"
   */
  source: string
  /**
   * Turn number at which this condition was applied.
   * Used for duration tracking and "expires at turn X" display.
   */
  appliedAtTurn: number
  /**
   * Turn number at which this condition expires, inclusive.
   * null = indefinite (lasts until actively removed or cured).
   */
  expiresAtTurn: number | null
  /**
   * For stackable conditions (exhaustion), the current stack level.
   * Defaults to 1 for non-stackable conditions.
   */
  stackLevel: number
  /**
   * Whether this condition requires concentration to maintain (by the applier).
   * If the caster loses concentration, this condition should be removed.
   */
  requiresConcentration: boolean
  /**
   * The caster/applier's character ID if concentration-dependent.
   * null if not applicable.
   */
  concentrationSourceId: string | null
}

// ─── Active Condition Set ─────────────────────────────────────────────────────

/**
 * The full set of active conditions on a character.
 * Stored as an array in the `conditions` JSONB column.
 */
export type ActiveConditionSet = ActiveCondition[]

// ─── Concentration State ──────────────────────────────────────────────────────

/**
 * A character's concentration state.
 * A character can only concentrate on one thing at a time.
 * Stored as a nullable column on the character sheet.
 */
export interface ConcentrationState {
  /** What the character is concentrating on (spell name, effect). */
  spell: string
  /** Turn when concentration started. */
  startedAtTurn: number
  /** Target character ID(s) affected by the concentration. */
  targetIds: string[]
}

// ─── Condition Helpers ────────────────────────────────────────────────────────

/**
 * Get the static definition for a condition.
 * @throws if the id is not a known ConditionId
 */
export function getConditionDefinition(id: ConditionId): ConditionDefinition {
  const def = CONDITIONS[id]
  if (!def) {
    throw new Error(`[conditions] Unknown condition id: "${id}".`)
  }
  return def
}

/**
 * Check if a condition ID string is valid.
 */
export function isValidConditionId(id: string): id is ConditionId {
  return (CONDITION_IDS as readonly string[]).includes(id)
}

/**
 * Create a new ActiveCondition instance with sensible defaults.
 *
 * @param id              - The condition to apply
 * @param source          - Narrative source for the log
 * @param appliedAtTurn   - Current turn number
 * @param options         - Optional overrides
 */
export function createActiveCondition(
  id: ConditionId,
  source: string,
  appliedAtTurn: number,
  options: {
    expiresAtTurn?: number | null
    stackLevel?: number
    requiresConcentration?: boolean
    concentrationSourceId?: string | null
  } = {},
): ActiveCondition {
  if (!isValidConditionId(id)) {
    throw new Error(`[conditions] Cannot create active condition: unknown id "${id}".`)
  }
  if (source.trim().length === 0) {
    throw new Error('[conditions] Active condition source cannot be empty.')
  }
  if (!Number.isInteger(appliedAtTurn) || appliedAtTurn < 0) {
    throw new Error(`[conditions] appliedAtTurn must be a non-negative integer, got ${appliedAtTurn}.`)
  }

  return {
    id,
    source: source.trim(),
    appliedAtTurn,
    expiresAtTurn: options.expiresAtTurn ?? null,
    stackLevel: options.stackLevel ?? 1,
    requiresConcentration: options.requiresConcentration ?? false,
    concentrationSourceId: options.concentrationSourceId ?? null,
  }
}

/**
 * Apply a condition to an existing set, returning a new set.
 * Pure function — does not mutate the input array.
 *
 * Rules:
 *   - If the condition is already present and non-stackable: returns set unchanged.
 *   - If stackable (exhaustion): increments stack level, capped at max.
 *   - Implied conditions are also applied (e.g. stunned → incapacitated).
 *
 * @param set           - Current active conditions
 * @param condition     - The condition to apply
 * @param currentTurn   - For applying implied conditions at the same turn
 */
export function applyCondition(
  set: ActiveConditionSet,
  condition: ActiveCondition,
  currentTurn: number,
): ActiveConditionSet {
  const def = getConditionDefinition(condition.id)
  let result = [...set]

  // Handle stackable conditions
  if (condition.id === 'exhaustion') {
    const existing = result.findIndex((c) => c.id === 'exhaustion')
    if (existing >= 0) {
      const prev = result[existing]
      const newStack = Math.min((prev.stackLevel ?? 1) + 1, 6)
      result[existing] = { ...prev, stackLevel: newStack }
      return result
    }
  } else {
    // Non-stackable: skip if already present
    if (result.some((c) => c.id === condition.id)) {
      return result
    }
  }

  result.push(condition)

  // Apply implied conditions that aren't already active
  for (const impliedId of def.implies) {
    if (!result.some((c) => c.id === impliedId)) {
      result.push(
        createActiveCondition(impliedId, `implied by ${condition.id}`, currentTurn),
      )
    }
  }

  return result
}

/**
 * Remove a specific condition by ID from a set.
 * Pure function — does not mutate the input array.
 *
 * For stackable conditions (exhaustion): decrements stack.
 * Removes the condition entirely when stack reaches 0.
 *
 * Does NOT remove implied conditions — those must be removed explicitly
 * (they may have been applied independently from another source).
 */
export function removeCondition(
  set: ActiveConditionSet,
  id: ConditionId,
): ActiveConditionSet {
  if (id === 'exhaustion') {
    const idx = set.findIndex((c) => c.id === 'exhaustion')
    if (idx < 0) return set
    const current = set[idx]
    if ((current.stackLevel ?? 1) <= 1) {
      return set.filter((c) => c.id !== 'exhaustion')
    }
    return set.map((c) =>
      c.id === 'exhaustion' ? { ...c, stackLevel: (c.stackLevel ?? 1) - 1 } : c,
    )
  }

  return set.filter((c) => c.id !== id)
}

/**
 * Toggle a condition on/off. If present, removes it; if absent, applies it.
 * Uses default values for the new condition if applying.
 *
 * Primarily useful for UI toggles and testing.
 * For gameplay, prefer applyCondition / removeCondition with full context.
 */
export function toggleCondition(
  set: ActiveConditionSet,
  id: ConditionId,
  source: string,
  currentTurn: number,
): ActiveConditionSet {
  if (hasCondition(set, id)) {
    return removeCondition(set, id)
  }
  return applyCondition(set, createActiveCondition(id, source, currentTurn), currentTurn)
}

/**
 * Check if a condition is currently active on the set.
 */
export function hasCondition(set: ActiveConditionSet, id: ConditionId): boolean {
  return set.some((c) => c.id === id)
}

/**
 * Get the active condition record for a specific ID, if present.
 */
export function getActiveCondition(
  set: ActiveConditionSet,
  id: ConditionId,
): ActiveCondition | undefined {
  return set.find((c) => c.id === id)
}

/**
 * Check whether a character can take actions.
 * Returns true if ANY active condition sets preventsActions = true.
 */
export function isIncapacitated(set: ActiveConditionSet): boolean {
  return set.some((c) => CONDITIONS[c.id]?.preventsActions === true)
}

/**
 * Check whether a character can move.
 * Returns true if ANY active condition sets preventsMovement = true.
 */
export function isImmobilized(set: ActiveConditionSet): boolean {
  return set.some((c) => CONDITIONS[c.id]?.preventsMovement === true)
}

/**
 * Collect all ConditionModifiers currently active on the set.
 * The resolver calls this to build the situational modifier list before any roll.
 *
 * Deduplicates by context+mode: if two conditions both impose disadvantage on
 * attack rolls, only one disadvantage modifier is returned (advantage/disadvantage
 * don't stack in D&D; they cancel each other if both present).
 */
export function resolveConditionModifiers(
  set: ActiveConditionSet,
  context: RollContext,
): ConditionModifier[] {
  if (set.length === 0) return []

  const raw: ConditionModifier[] = []
  for (const ac of set) {
    const def = CONDITIONS[ac.id]
    if (!def) continue
    for (const mod of def.modifiers) {
      if (mod.context === context) {
        raw.push(mod)
      }
    }
  }

  if (raw.length === 0) return raw

  // D&D rule: advantage and disadvantage cancel each other out.
  const hasAdvantage = raw.some((m) => m.mode === 'advantage')
  const hasDisadvantage = raw.some((m) => m.mode === 'disadvantage')

  if (hasAdvantage && hasDisadvantage) {
    // They cancel — return only flat bonuses if any
    return raw.filter((m) => m.mode === undefined)
  }

  // Deduplicate: only one advantage or one disadvantage entry needed
  const seenMode = new Set<string>()
  return raw.filter((m) => {
    const key = m.mode ?? 'flat'
    if (seenMode.has(key)) return false
    seenMode.add(key)
    return true
  })
}

/**
 * Expire conditions whose expiresAtTurn <= currentTurn.
 * Returns a new set with expired conditions removed.
 * Pure function — does not mutate input.
 */
export function expireConditions(
  set: ActiveConditionSet,
  currentTurn: number,
): ActiveConditionSet {
  return set.filter(
    (c) => c.expiresAtTurn === null || c.expiresAtTurn > currentTurn,
  )
}

/**
 * Remove all conditions that requiresConcentration from a specific source.
 * Called when a caster loses concentration (takes damage, fails CON save, etc.).
 */
export function breakConcentration(
  set: ActiveConditionSet,
  concentrationSourceId: string,
): ActiveConditionSet {
  return set.filter(
    (c) => !(c.requiresConcentration && c.concentrationSourceId === concentrationSourceId),
  )
}

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Validate and parse a raw JSONB value into a typed ActiveConditionSet.
 * Called when loading character data from Supabase.
 *
 * Unknown condition IDs are filtered out with a warning (forward-compat).
 * Malformed entries are also dropped rather than throwing.
 */
export function parseConditionsFromDb(raw: unknown): ActiveConditionSet {
  if (!Array.isArray(raw)) return []

  return raw.filter((entry): entry is ActiveCondition => {
    if (typeof entry !== 'object' || entry === null) return false
    const e = entry as Record<string, unknown>
    return (
      typeof e['id'] === 'string' &&
      isValidConditionId(e['id']) &&
      typeof e['source'] === 'string' &&
      typeof e['appliedAtTurn'] === 'number'
    )
  })
}

/**
 * Prepare ActiveConditionSet for DB storage.
 * Returns the plain array — JSONB accepts it directly.
 * Included for API symmetry and future transformation hooks.
 */
export function serializeConditionsForDb(set: ActiveConditionSet): ActiveCondition[] {
  return set.map((c) => ({ ...c }))
}
