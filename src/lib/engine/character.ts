/**
 * Chronicle AI — Character Engine
 * Phase 1.2
 *
 * Defines the CharacterSheet type and all pure-TypeScript character logic.
 * No RNG. No Supabase. No React. Fully deterministic.
 *
 * Constitution alignment:
 *   - Six stats: STR / DEX / CON / INT / WIS / CHA
 *   - Modifier formula: floor((score - 10) / 2)
 *   - HP formula: 10 + CON_mod + (level × (hitDie_avg + CON_mod))
 *   - Levels 1–20 (prompt spec; Constitution cap of 10 is a content/balance
 *     decision deferred to Phase 3 — the engine supports the full range now)
 *
 * Dependency note:
 *   statModifier() lives in intent.ts (Phase 1.1) and is re-exported from
 *   the engine index as getAbilityModifier(). character.ts imports it
 *   directly from intent.ts to avoid circular references.
 */

import { statModifier } from './intent'
import type { DieNotation } from './dice'
import type { StatName } from './intent'
import type { SkillId } from './skills'
import type { EquipmentLoadout } from './equipment'
import type { ActiveConditionSet } from './conditions'
import { isValidSkillId } from './skills'

// ─── Re-export as the canonical public name ───────────────────────────────────

/**
 * Compute the ability modifier from a raw score.
 * Canonical formula per the Chronicle Constitution: floor((score - 10) / 2)
 *
 * Alias for `statModifier` from intent.ts — the same function, exposed
 * here under the name requested by the character API contract.
 *
 * @example getAbilityModifier(14) // 2
 * @example getAbilityModifier(8)  // -1
 * @example getAbilityModifier(10) // 0
 */
export const getAbilityModifier = statModifier

// ─── Constants ────────────────────────────────────────────────────────────────

/** Legal ability score range. Scores above 20 require magic; not supported at character creation. */
export const ABILITY_SCORE_MIN = 1
export const ABILITY_SCORE_MAX = 20

/** Legal character level range. */
export const LEVEL_MIN = 1
export const LEVEL_MAX = 20

/** Default unarmored AC = 10 + DEX modifier. */
export const BASE_UNARMORED_AC = 10

// ─── Hit Die ──────────────────────────────────────────────────────────────────

/**
 * Hit dice supported by Chronicle AI archetypes.
 * Restricted to the four that appear in the Dice System table in the Game Loop doc.
 */
export type HitDie = 'd6' | 'd8' | 'd10' | 'd12'

/**
 * Average hit die value (floored), used in the HP formula.
 * Per the Game Loop doc's Dice System table, these are the class hit dice.
 *
 * Floor rounding is standard for "take average" HP at level-up.
 */
export const HIT_DIE_AVERAGE: Record<HitDie, number> = {
  d6: 3,   // 3.5 → floor = 3  (Wizard, Rogue)
  d8: 4,   // 4.5 → floor = 4  (Cleric, Druid)
  d10: 5,  // 5.5 → floor = 5  (Ranger, Fighter)
  d12: 6,  // 6.5 → floor = 6  (Barbarian)
}

// ─── Archetype → Hit Die Map ──────────────────────────────────────────────────

/**
 * The supported archetypes and their associated hit dice.
 * Archetype is stored as a free string on CharacterSheet; this map is used
 * to resolve hit die during HP calculation.
 *
 * If an archetype is not in this map, the HP calculation falls back to d8.
 */
export const ARCHETYPE_HIT_DIE: Record<string, HitDie> = {
  // d12
  barbarian: 'd12',
  berserker: 'd12',
  // d10
  fighter: 'd10',
  ranger: 'd10',
  paladin: 'd10',
  // d8
  cleric: 'd8',
  druid: 'd8',
  bard: 'd8',
  rogue: 'd8',
  // d6
  wizard: 'd6',
  sorcerer: 'd6',
  warlock: 'd6',
}

/** The fallback hit die for archetypes not explicitly listed. */
export const DEFAULT_HIT_DIE: HitDie = 'd8'

// ─── Ability Scores ───────────────────────────────────────────────────────────

/** The six core ability scores. All values must be in [ABILITY_SCORE_MIN, ABILITY_SCORE_MAX]. */
export interface AbilityScores {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

/** Default ability scores — all 10 (modifier 0). */
export const DEFAULT_ABILITY_SCORES: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
}

// ─── Character Sheet ──────────────────────────────────────────────────────────

/**
 * The canonical character record used by the engine at runtime.
 * This is the shape the resolver, Director, and session loop operate on.
 *
 * All values are validated and computed — no raw user input lives here.
 */
export interface CharacterSheet {
  /** Display name. 1–60 chars, trimmed. */
  name: string

  /** Character level. Integer in [LEVEL_MIN, LEVEL_MAX]. */
  level: number

  /**
   * Archetype / class, e.g. "fighter", "wizard", "rogue".
   * Stored lowercase-normalised. Used to resolve hitDie.
   */
  archetype: string

  /**
   * Ancestry / species, e.g. "human", "elf", "dwarf".
   * Stored lowercase-normalised. Mechanical effects deferred to Phase 3.
   */
  ancestry: string

  /**
   * Background, e.g. "soldier", "scholar", "criminal".
   * Stored lowercase-normalised. Mechanical effects deferred to Phase 3.
   */
  background: string

  /** The six ability scores. */
  scores: AbilityScores

  /** Pre-computed ability modifiers, derived from scores. */
  modifiers: AbilityScores

  /** Hit die resolved from archetype. */
  hitDie: HitDie

  /** Maximum hit points (computed from CON + level + hitDie). */
  maxHp: number

  /** Current hit points. Starts equal to maxHp. */
  currentHp: number

  /** Armor class. Defaults to 10 + DEX modifier (unarmored). */
  armorClass: number

  /** Proficiency bonus derived from level. */
  proficiencyBonus: number

  /**
   * Phase 1.6: Skills the character is proficient in.
   * A proficient skill adds proficiencyBonus to checks using that skill.
   * Defaults to an empty array (no proficiencies) for backward compatibility
   * with characters built before this field existed.
   */
  skillProficiencies: SkillId[]

  /**
   * Phase 1.6: Abilities the character is proficient in for saving throws.
   * A proficient saving throw adds proficiencyBonus to saves using that ability.
   * Defaults to an empty array.
   */
  savingThrowProficiencies: StatName[]

  /**
   * Phase 1.6: Equipped and carried items contributing flat numeric bonuses.
   * Defaults to an empty array. See equipment.ts — magical effects unsupported.
   */
  equipment: EquipmentLoadout

  /**
   * Phase 1.6: Active conditions on this character, read directly into the
   * resolver pipeline. Defaults to an empty array. This is the in-memory
   * mirror of the `conditions` JSONB column — callers loading from the DB
   * should populate this via parseConditionsFromDb() before calling the resolver.
   */
  conditions: ActiveConditionSet

  /**
   * Phase 1.7: Death saving throw successes accumulated since the character
   * last dropped to 0 HP. Resets to 0 on stabilising or healing above 0 HP.
   * Range 0–3; a 3rd success stabilises the character (still unconscious,
   * but no longer at risk of dying from failed saves).
   *
   * Promoted from CharacterRecord (DB-only, Phase 1.4) onto CharacterSheet
   * so actionValidation.ts's death check can read it directly without
   * reaching into the Supabase service layer (Constitution Law 3).
   */
  deathSaveSuccesses: number

  /**
   * Phase 1.7: Death saving throw failures accumulated since the character
   * last dropped to 0 HP. Range 0–3; a 3rd failure means the character dies.
   * See deathSaveSuccesses for the companion counter.
   */
  deathSaveFailures: number
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Check if a value is a valid ability score (integer, 1–20).
 *
 * Character creation is capped at 20; magical enhancement beyond that
 * is a runtime state change, not part of the base sheet.
 */
export function isValidAbilityScore(value: number): boolean {
  return Number.isInteger(value) && value >= ABILITY_SCORE_MIN && value <= ABILITY_SCORE_MAX
}

/**
 * Check if a value is a valid character level (integer, 1–20).
 */
export function isValidLevel(value: number): boolean {
  return Number.isInteger(value) && value >= LEVEL_MIN && value <= LEVEL_MAX
}

/**
 * Validate all six ability scores in a block.
 * Returns the first error string found, or null if all are valid.
 */
export function validateAbilityScores(scores: AbilityScores): string | null {
  const fields: Array<[keyof AbilityScores, string]> = [
    ['strength',     'Strength'],
    ['dexterity',    'Dexterity'],
    ['constitution', 'Constitution'],
    ['intelligence', 'Intelligence'],
    ['wisdom',       'Wisdom'],
    ['charisma',     'Charisma'],
  ]

  for (const [key, label] of fields) {
    if (!isValidAbilityScore(scores[key])) {
      return (
        `[character] ${label} must be an integer between ${ABILITY_SCORE_MIN} and ${ABILITY_SCORE_MAX}, ` +
        `got ${scores[key]}.`
      )
    }
  }

  return null
}

// ─── Derived Stats ────────────────────────────────────────────────────────────

/**
 * Compute all six ability modifiers from a set of scores.
 * Returns an AbilityScores-shaped object where each value is the modifier.
 */
export function computeModifiers(scores: AbilityScores): AbilityScores {
  return {
    strength:     getAbilityModifier(scores.strength),
    dexterity:    getAbilityModifier(scores.dexterity),
    constitution: getAbilityModifier(scores.constitution),
    intelligence: getAbilityModifier(scores.intelligence),
    wisdom:       getAbilityModifier(scores.wisdom),
    charisma:     getAbilityModifier(scores.charisma),
  }
}

/**
 * Proficiency bonus by level, per the standard D&D-adjacent table.
 *
 * Tier thresholds:
 *   Levels  1– 4 → +2
 *   Levels  5– 8 → +3
 *   Levels  9–12 → +4
 *   Levels 13–16 → +5
 *   Levels 17–20 → +6
 *
 * Formula: Math.ceil(level / 4) + 1  — produces the same table.
 *
 * @throws {Error} if level is outside [LEVEL_MIN, LEVEL_MAX]
 */
export function getProficiencyBonus(level: number): number {
  if (!isValidLevel(level)) {
    throw new Error(
      `[character] Level must be an integer between ${LEVEL_MIN} and ${LEVEL_MAX}, got ${level}.`,
    )
  }
  return Math.ceil(level / 4) + 1
}

/**
 * Resolve the hit die for a given archetype string.
 * Normalises to lowercase before lookup; falls back to DEFAULT_HIT_DIE.
 */
export function resolveHitDie(archetype: string): HitDie {
  return ARCHETYPE_HIT_DIE[archetype.toLowerCase().trim()] ?? DEFAULT_HIT_DIE
}

// ─── HP Calculation ───────────────────────────────────────────────────────────

export interface HpConfig {
  level: number
  constitution: number
  hitDie: HitDie
}

/**
 * Calculate maximum HP per the Chronicle Constitution formula:
 *
 *   maxHP = 10 + CON_mod + (level × (hitDie_avg + CON_mod))
 *
 * Implementation notes:
 *   - The base 10 represents the character's innate vitality (first "hit die max").
 *   - CON modifier applies twice at level 1: once to the base, once inside the
 *     level multiplier — this is intentional per the Constitution spec and means
 *     a CON 20 (+5) Fighter at level 1 gets 10+5+(1×(5+5)) = 25 HP.
 *   - Hit die averages are floored (d6→3, d8→4, d10→5, d12→6).
 *   - Minimum HP is always 1 (guards against extreme negative CON modifiers).
 *
 * @throws {Error} if level or constitution are out of range
 */
export function calculateMaxHp(config: HpConfig): number {
  const { level, constitution, hitDie } = config

  if (!isValidLevel(level)) {
    throw new Error(
      `[character] calculateMaxHp: level must be ${LEVEL_MIN}–${LEVEL_MAX}, got ${level}.`,
    )
  }
  if (!isValidAbilityScore(constitution)) {
    throw new Error(
      `[character] calculateMaxHp: constitution must be ${ABILITY_SCORE_MIN}–${ABILITY_SCORE_MAX}, ` +
        `got ${constitution}.`,
    )
  }

  const conMod = getAbilityModifier(constitution)
  const dieAvg = HIT_DIE_AVERAGE[hitDie]
  const hp = 10 + conMod + level * (dieAvg + conMod)

  return Math.max(1, hp)
}

// ─── Character Factory ────────────────────────────────────────────────────────

/**
 * Input to buildCharacter(). All fields are optional — omitted fields
 * receive sensible defaults so a minimal character can be created quickly.
 */
export interface CharacterInput {
  name?: string
  level?: number
  archetype?: string
  ancestry?: string
  background?: string
  scores?: Partial<AbilityScores>
  /** Override current HP. If omitted, defaults to computed maxHp. */
  currentHp?: number
  /** Override armor class. If omitted, defaults to 10 + DEX modifier. */
  armorClass?: number
  /** Phase 1.6: Skills this character is proficient in. Defaults to none. */
  skillProficiencies?: SkillId[]
  /** Phase 1.6: Abilities this character has saving throw proficiency in. Defaults to none. */
  savingThrowProficiencies?: StatName[]
  /** Phase 1.6: Starting equipment loadout. Defaults to empty. */
  equipment?: EquipmentLoadout
  /** Phase 1.6: Starting active conditions. Defaults to empty (healthy character). */
  conditions?: ActiveConditionSet
  /** Phase 1.7: Starting death save successes (0-3). Defaults to 0. */
  deathSaveSuccesses?: number
  /** Phase 1.7: Starting death save failures (0-3). Defaults to 0. */
  deathSaveFailures?: number
}

/**
 * Build a validated, fully-computed CharacterSheet from raw input.
 *
 * Performs:
 *   1. Name normalisation + length validation
 *   2. Level validation
 *   3. Ability score merging with defaults + validation
 *   4. Modifier computation
 *   5. Hit die resolution from archetype
 *   6. maxHp calculation
 *   7. currentHp defaulting
 *   8. AC defaulting (unarmored: 10 + DEX mod)
 *   9. Proficiency bonus computation
 *
 * @throws {Error} with a descriptive message if any validation fails
 */
export function buildCharacter(input: CharacterInput = {}): CharacterSheet {
  // ── Name ────────────────────────────────────────────────────────────────────
  const rawName = (input.name ?? 'Unknown Adventurer').trim()
  if (rawName.length === 0) {
    throw new Error('[character] Name cannot be empty.')
  }
  if (rawName.length > 60) {
    throw new Error(
      `[character] Name must be 60 characters or fewer, got ${rawName.length}.`,
    )
  }

  // ── Level ───────────────────────────────────────────────────────────────────
  const level = input.level ?? 1
  if (!isValidLevel(level)) {
    throw new Error(
      `[character] Level must be an integer between ${LEVEL_MIN} and ${LEVEL_MAX}, got ${level}.`,
    )
  }

  // ── Ability Scores ──────────────────────────────────────────────────────────
  const scores: AbilityScores = {
    ...DEFAULT_ABILITY_SCORES,
    ...input.scores,
  }

  const scoreError = validateAbilityScores(scores)
  if (scoreError) throw new Error(scoreError)

  // ── Derived values ──────────────────────────────────────────────────────────
  const modifiers = computeModifiers(scores)
  const archetype = (input.archetype ?? 'adventurer').toLowerCase().trim()
  const ancestry = (input.ancestry ?? 'human').toLowerCase().trim()
  const background = (input.background ?? 'wanderer').toLowerCase().trim()
  const hitDie = resolveHitDie(archetype)
  const proficiencyBonus = getProficiencyBonus(level)

  const maxHp = calculateMaxHp({ level, constitution: scores.constitution, hitDie })
  const currentHp = input.currentHp ?? maxHp
  const armorClass = input.armorClass ?? BASE_UNARMORED_AC + modifiers.dexterity

  // ── currentHp bounds check ──────────────────────────────────────────────────
  // Permit setting currentHp below 0 for death-state tracking,
  // but not above maxHp (caller error).
  if (currentHp > maxHp) {
    throw new Error(
      `[character] currentHp (${currentHp}) cannot exceed maxHp (${maxHp}).`,
    )
  }

  // ── Phase 1.6: Skills, saves, equipment, conditions ─────────────────────────
  const skillProficiencies = input.skillProficiencies ?? []
  for (const skill of skillProficiencies) {
    if (!isValidSkillId(skill)) {
      throw new Error(`[character] Unknown skill proficiency: "${skill}".`)
    }
  }

  const savingThrowProficiencies = input.savingThrowProficiencies ?? []
  const validStats: StatName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  for (const stat of savingThrowProficiencies) {
    if (!validStats.includes(stat)) {
      throw new Error(`[character] Unknown saving throw proficiency: "${stat}".`)
    }
  }

  const equipment = input.equipment ?? []
  const conditions = input.conditions ?? []

  // ── Phase 1.7: Death saves ───────────────────────────────────────────────────
  const deathSaveSuccesses = input.deathSaveSuccesses ?? 0
  const deathSaveFailures = input.deathSaveFailures ?? 0

  if (!Number.isInteger(deathSaveSuccesses) || deathSaveSuccesses < 0 || deathSaveSuccesses > 3) {
    throw new Error(
      `[character] deathSaveSuccesses must be an integer between 0 and 3, got ${deathSaveSuccesses}.`,
    )
  }
  if (!Number.isInteger(deathSaveFailures) || deathSaveFailures < 0 || deathSaveFailures > 3) {
    throw new Error(
      `[character] deathSaveFailures must be an integer between 0 and 3, got ${deathSaveFailures}.`,
    )
  }

  return {
    name: rawName,
    level,
    archetype,
    ancestry,
    background,
    scores,
    modifiers,
    hitDie,
    maxHp,
    currentHp,
    armorClass,
    proficiencyBonus,
    skillProficiencies,
    savingThrowProficiencies,
    equipment,
    conditions,
    deathSaveSuccesses,
    deathSaveFailures,
  }
}

// ─── Serialisation ────────────────────────────────────────────────────────────

/**
 * A JSON-safe flat summary of a CharacterSheet.
 * This is the shape stored alongside narrative turns and passed to the Director.
 * Redundant nested structures (modifiers) are flattened for readability.
 */
export interface CharacterSummary {
  name: string
  level: number
  archetype: string
  ancestry: string
  background: string
  proficiencyBonus: number
  hitDie: DieNotation
  maxHp: number
  currentHp: number
  armorClass: number
  // Scores
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
  // Modifiers
  strMod: number
  dexMod: number
  conMod: number
  intMod: number
  wisMod: number
  chaMod: number
}

/**
 * Flatten a CharacterSheet to a JSON-serialisable summary.
 * Useful for Director payloads, DB storage, and debug panels.
 */
export function summarizeCharacter(character: CharacterSheet): CharacterSummary {
  return {
    name:             character.name,
    level:            character.level,
    archetype:        character.archetype,
    ancestry:         character.ancestry,
    background:       character.background,
    proficiencyBonus: character.proficiencyBonus,
    hitDie:           character.hitDie,
    maxHp:            character.maxHp,
    currentHp:        character.currentHp,
    armorClass:       character.armorClass,
    // Scores
    str:    character.scores.strength,
    dex:    character.scores.dexterity,
    con:    character.scores.constitution,
    int:    character.scores.intelligence,
    wis:    character.scores.wisdom,
    cha:    character.scores.charisma,
    // Modifiers
    strMod: character.modifiers.strength,
    dexMod: character.modifiers.dexterity,
    conMod: character.modifiers.constitution,
    intMod: character.modifiers.intelligence,
    wisMod: character.modifiers.wisdom,
    chaMod: character.modifiers.charisma,
  }
}
