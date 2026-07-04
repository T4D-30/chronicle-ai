/**
 * Chronicle AI — Character Service
 * Phase 1.4
 *
 * Typed Supabase operations for the characters table.
 * All writes are validated through the engine before hitting the DB.
 * All reads parse JSONB columns safely.
 *
 * Constitution Law 3: "The Character Sheet Is the Source of Truth"
 * This module is the only place where character data crosses the DB boundary.
 * Nothing gets written to the characters table that hasn't passed buildCharacter().
 */

import { supabase } from './client'
import { ServiceError, fromPostgrestError, assertFound } from './errors'
import {
  buildCharacter,
  validateAbilityScores,
  isValidLevel,
  resolveHitDie,
  calculateMaxHp,
  getProficiencyBonus,
  getAbilityModifier,
  BASE_UNARMORED_AC,
} from '@/lib/engine/character'
import type { CharacterInput, CharacterSheet } from '@/lib/engine/character'
import { parseConditionsFromDb } from '@/lib/engine/conditions'
import type { ActiveCondition } from '@/lib/engine/conditions'
import { isValidSkillId } from '@/lib/engine/skills'
import type { SkillId } from '@/lib/engine/skills'
import type { StatName } from '@/lib/engine/intent'
import type { EquipmentItem, EquipmentLoadout } from '@/lib/engine/equipment'
import type { Tables, TablesInsert, TablesUpdate, Json } from '@/types/supabase-generated'
import type { FeatureRow, InventoryItemRow, SpellDataRow } from '@/types/database'

// Generated DB row type — JSONB columns are typed as `Json` at the DB boundary
type CharacterRow = Tables<'characters'>
type CharacterInsert = TablesInsert<'characters'>
type CharacterUpdate = TablesUpdate<'characters'>

/**
 * Cast a rich domain JSONB shape to the generated client's `Json` type at the
 * write boundary. Domain types here are plain serialisable objects/arrays,
 * so this is a safe structural cast — not a type lie.
 */
function toJson<T>(value: T): Json {
  return value as unknown as Json
}

/**
 * Safely parse a raw JSONB value into a SkillId[].
 * Mirrors parseConditionsFromDb's philosophy: unknown or malformed entries
 * are dropped rather than propagated, so a future schema change to the
 * skill table never crashes character hydration.
 */
function parseSkillProficienciesFromDb(raw: unknown): SkillId[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is SkillId => typeof entry === 'string' && isValidSkillId(entry))
}

/**
 * Safely parse a raw JSONB value into a StatName[] for saving throw
 * proficiencies. Same defensive philosophy as parseSkillProficienciesFromDb.
 */
function parseSavingThrowProficienciesFromDb(raw: unknown): StatName[] {
  const validStats: StatName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is StatName =>
    typeof entry === 'string' && validStats.includes(entry as StatName),
  )
}

/**
 * Safely parse a raw JSONB value into an EquipmentLoadout.
 * Drops entries missing the minimum required shape (id, name, slot, equipped)
 * rather than throwing — malformed equipment data should never block a
 * character from loading.
 */
function parseEquipmentFromDb(raw: unknown): EquipmentLoadout {
  if (!Array.isArray(raw)) return []

  const validSlots = ['weapon', 'armor', 'shield', 'accessory']

  return raw.filter((entry): entry is EquipmentItem => {
    if (typeof entry !== 'object' || entry === null) return false
    const e = entry as Record<string, unknown>
    return (
      typeof e['id'] === 'string' &&
      typeof e['name'] === 'string' &&
      typeof e['slot'] === 'string' &&
      validSlots.includes(e['slot']) &&
      typeof e['equipped'] === 'boolean'
    )
  })
}

// ─── Domain Object ────────────────────────────────────────────────────────────

/**
 * A character as it exists in the app layer — DB row hydrated to a domain object.
 * `id`, `userId`, and `createdAt`/`updatedAt` are DB-assigned and not on CharacterSheet.
 */
export interface CharacterRecord {
  id: string
  userId: string
  sheet: CharacterSheet
  experience: number
  tempHp: number
  deathSavesSuccess: number
  deathSavesFailure: number
  conditions: ActiveCondition[]
  features: FeatureRow[]
  inventory: InventoryItemRow[]
  spells: SpellDataRow
  /** Volume II / Phase 2.1: portrait image as a data: URL. Null if unset. */
  portraitUrl: string | null
  /** Volume II / Phase 2.1: in-fiction biography. Never parsed mechanically. */
  bio: string
  createdAt: string
  updatedAt: string
}

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Input to createCharacter — a subset of CharacterInput plus userId, plus
 * the two presentation fields (portraitUrl, bio) that live outside the
 * pure engine CharacterSheet type (Constitution: the engine has no concept
 * of a portrait image or freeform biography — those are service/UI concerns).
 */
export interface CreateCharacterInput extends CharacterInput {
  userId: string
  /** Portrait image as a data: URL. Optional; defaults to null. */
  portraitUrl?: string | null
  /** In-fiction biography. Optional; defaults to empty string. */
  bio?: string
}

/** Fields that can be updated on an existing character. */
export interface UpdateCharacterInput {
  /** Core identity fields */
  name?: string
  archetype?: string
  ancestry?: string
  background?: string
  level?: number
  experience?: number
  /** HP state (current session values, not recalculated from formula) */
  currentHp?: number
  tempHp?: number
  armorClass?: number
  deathSavesSuccess?: number
  deathSavesFailure?: number
  /** Ability scores — triggers HP/AC recalculation if changed */
  scores?: CharacterInput['scores']
  /** JSONB columns */
  features?: FeatureRow[]
  inventory?: InventoryItemRow[]
  spells?: SpellDataRow
  /** Phase 1.7: Skill/saving throw proficiencies and equipment loadout */
  skillProficiencies?: SkillId[]
  savingThrowProficiencies?: StatName[]
  equipment?: EquipmentLoadout
  /**
   * Volume II / Phase 2.1: active conditions. Previously this could only be
   * set at creation time (sheetToInsertRow) — there was no way to apply or
   * remove a condition on an existing character. Required for the
   * Character Sheet's Conditions tab.
   */
  conditions?: ActiveCondition[]
  /** Volume II / Phase 2.1: portrait image and biography */
  portraitUrl?: string | null
  bio?: string
}

// ─── Row → Domain Converter ───────────────────────────────────────────────────

/**
 * Convert a CharacterRow (DB snake_case) to a CharacterRecord (domain camelCase).
 * Parses JSONB columns safely via engine helpers.
 */
/**
 * Convert a CharacterRow (DB snake_case) to a CharacterRecord (domain camelCase).
 * Parses the `conditions` JSONB column safely via the engine's parser — unknown
 * or malformed entries are dropped rather than propagated. This is the single
 * place conditions are parsed; callers never need to pre-parse before calling.
 */
function rowToCharacterRecord(row: CharacterRow): CharacterRecord {
  // Reconstruct the CharacterSheet from flat DB columns.
  // We don't call buildCharacter() here — that would recalculate derived values
  // (like maxHp) from scratch and overwrite whatever the DB currently holds.
  const parsedConditions = parseConditionsFromDb(row.conditions)

  const sheet: CharacterSheet = {
    name: row.name,
    level: row.level,
    archetype: row.archetype,
    ancestry: row.ancestry,
    background: row.background,
    scores: {
      strength: row.str,
      dexterity: row.dex,
      constitution: row.con,
      intelligence: row.int,
      wisdom: row.wis,
      charisma: row.cha,
    },
    modifiers: {
      strength: getAbilityModifier(row.str),
      dexterity: getAbilityModifier(row.dex),
      constitution: getAbilityModifier(row.con),
      intelligence: getAbilityModifier(row.int),
      wisdom: getAbilityModifier(row.wis),
      charisma: getAbilityModifier(row.cha),
    },
    hitDie: row.hit_die as CharacterSheet['hitDie'],
    maxHp: row.max_hp,
    currentHp: row.current_hp,
    armorClass: row.armor_class,
    proficiencyBonus: row.proficiency_bonus,
    // Phase 1.7: hydrated from real DB columns (migration 0004).
    // Malformed/unknown entries are dropped by the parse helpers rather
    // than propagated or thrown, matching parseConditionsFromDb's philosophy.
    skillProficiencies: parseSkillProficienciesFromDb(row.skill_proficiencies),
    savingThrowProficiencies: parseSavingThrowProficienciesFromDb(row.saving_throw_proficiencies),
    equipment: parseEquipmentFromDb(row.equipment),
    conditions: parsedConditions,
    // Phase 1.7: promoted from CharacterRecord-only onto the sheet itself
    // so actionValidation.ts can read death-save state directly.
    deathSaveSuccesses: row.death_saves_success,
    deathSaveFailures: row.death_saves_failure,
  }

  return {
    id: row.id,
    userId: row.user_id,
    sheet,
    experience: row.experience,
    tempHp: row.temp_hp,
    deathSavesSuccess: row.death_saves_success,
    deathSavesFailure: row.death_saves_failure,
    conditions: parsedConditions,
    features: Array.isArray(row.features) ? (row.features as unknown as FeatureRow[]) : [],
    inventory: Array.isArray(row.inventory) ? (row.inventory as unknown as InventoryItemRow[]) : [],
    spells: (row.spells as unknown as SpellDataRow | null) ?? {},
    portraitUrl: row.portrait_url,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Convert a validated CharacterSheet + metadata to DB insert shape.
 */
function sheetToInsertRow(
  userId: string,
  sheet: CharacterSheet,
  experience = 0,
  portraitUrl: string | null = null,
  bio = '',
): CharacterInsert {
  return {
    user_id: userId,
    name: sheet.name,
    archetype: sheet.archetype,
    ancestry: sheet.ancestry,
    background: sheet.background,
    level: sheet.level,
    experience,
    str: sheet.scores.strength,
    dex: sheet.scores.dexterity,
    con: sheet.scores.constitution,
    int: sheet.scores.intelligence,
    wis: sheet.scores.wisdom,
    cha: sheet.scores.charisma,
    max_hp: sheet.maxHp,
    current_hp: sheet.currentHp,
    temp_hp: 0,
    armor_class: sheet.armorClass,
    speed: 30,
    proficiency_bonus: sheet.proficiencyBonus,
    hit_die: sheet.hitDie,
    death_saves_success: sheet.deathSaveSuccesses,
    death_saves_failure: sheet.deathSaveFailures,
    conditions: toJson(sheet.conditions),
    features: toJson([]),
    inventory: toJson([]),
    spells: toJson({}),
    concentration: null,
    skill_proficiencies: toJson(sheet.skillProficiencies),
    saving_throw_proficiencies: toJson(sheet.savingThrowProficiencies),
    equipment: toJson(sheet.equipment),
    portrait_url: portraitUrl,
    bio,
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new character, validated through the engine before writing.
 *
 * @throws ServiceError('VALIDATION') if engine validation fails
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function createCharacter(input: CreateCharacterInput): Promise<CharacterRecord> {
  const { userId, portraitUrl, bio, ...characterInput } = input

  // Engine validation — throws if invalid
  let sheet: CharacterSheet
  try {
    sheet = buildCharacter(characterInput)
  } catch (err) {
    throw new ServiceError(
      err instanceof Error ? err.message : 'Invalid character input.',
      'VALIDATION',
    )
  }

  const row = sheetToInsertRow(userId, sheet, 0, portraitUrl ?? null, bio ?? '')

  const { data, error } = await supabase
    .from('characters')
    .insert(row)
    .select()
    .single()

  if (error) throw fromPostgrestError(error, 'createCharacter')
  assertFound(data, 'createCharacter')

  return rowToCharacterRecord(data)
}

/**
 * Get a single character by ID.
 * RLS ensures only the owner can access their own characters.
 *
 * @throws ServiceError('NOT_FOUND') if no character found (or RLS blocks it)
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function getCharacter(id: string): Promise<CharacterRecord> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[getCharacter] Character not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'getCharacter')
  }
  assertFound(data, 'getCharacter')

  return rowToCharacterRecord(data)
}

/**
 * List all characters belonging to the given user.
 * Returns empty array if none exist.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function listCharacters(userId: string): Promise<CharacterRecord[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw fromPostgrestError(error, 'listCharacters')

  return (data ?? []).map((row) => rowToCharacterRecord(row))
}

/**
 * Partially update a character.
 * Score updates trigger recalculation of maxHp, modifiers, AC, and proficiency bonus.
 *
 * @throws ServiceError('VALIDATION') if updated values fail engine validation
 * @throws ServiceError('NOT_FOUND') if character doesn't exist / RLS blocks it
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function updateCharacter(
  id: string,
  patch: UpdateCharacterInput,
): Promise<CharacterRecord> {
  // If scores OR level are changing, we need the character's CURRENT values
  // to merge against — NOT hardcoded defaults. A caller patching only
  // { strength: 18 } must not silently reset dexterity/constitution/.../
  // level/archetype to placeholder values; that would corrupt the character.
  // Level alone (e.g. a level-up action with no score change) still needs
  // this read: max_hp, armor_class, and proficiency_bonus are level-derived
  // and must be recalculated even when scores themselves don't move.
  let currentForRecalc: CharacterRecord | null = null
  if (patch.scores || patch.level !== undefined) {
    currentForRecalc = await getCharacter(id)
  }

  // If scores are being updated, run them through engine validation
  if (patch.scores) {
    const current = currentForRecalc as CharacterRecord
    const scoreError = validateAbilityScores({
      strength: patch.scores.strength ?? current.sheet.scores.strength,
      dexterity: patch.scores.dexterity ?? current.sheet.scores.dexterity,
      constitution: patch.scores.constitution ?? current.sheet.scores.constitution,
      intelligence: patch.scores.intelligence ?? current.sheet.scores.intelligence,
      wisdom: patch.scores.wisdom ?? current.sheet.scores.wisdom,
      charisma: patch.scores.charisma ?? current.sheet.scores.charisma,
    })
    if (scoreError) throw new ServiceError(scoreError, 'VALIDATION')
  }

  if (patch.level !== undefined && !isValidLevel(patch.level)) {
    throw new ServiceError(
      `[updateCharacter] Invalid level: ${patch.level}. Must be 1–20.`,
      'VALIDATION',
    )
  }

  if (patch.skillProficiencies !== undefined) {
    for (const skill of patch.skillProficiencies) {
      if (!isValidSkillId(skill)) {
        throw new ServiceError(
          `[updateCharacter] Unknown skill proficiency: "${skill}".`,
          'VALIDATION',
        )
      }
    }
  }

  if (patch.savingThrowProficiencies !== undefined) {
    const validStats: StatName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
    for (const stat of patch.savingThrowProficiencies) {
      if (!validStats.includes(stat)) {
        throw new ServiceError(
          `[updateCharacter] Unknown saving throw proficiency: "${stat}".`,
          'VALIDATION',
        )
      }
    }
  }

  // Build the DB update object — only include fields that are in the patch
  const dbPatch: CharacterUpdate = {}

  if (patch.name !== undefined) dbPatch.name = patch.name.trim()
  if (patch.archetype !== undefined) dbPatch.archetype = patch.archetype.toLowerCase().trim()
  if (patch.ancestry !== undefined) dbPatch.ancestry = patch.ancestry.toLowerCase().trim()
  if (patch.background !== undefined) dbPatch.background = patch.background.toLowerCase().trim()
  if (patch.level !== undefined) dbPatch.level = patch.level
  if (patch.experience !== undefined) dbPatch.experience = patch.experience
  if (patch.currentHp !== undefined) dbPatch.current_hp = patch.currentHp
  if (patch.tempHp !== undefined) dbPatch.temp_hp = patch.tempHp
  if (patch.armorClass !== undefined) dbPatch.armor_class = patch.armorClass
  if (patch.deathSavesSuccess !== undefined) dbPatch.death_saves_success = patch.deathSavesSuccess
  if (patch.deathSavesFailure !== undefined) dbPatch.death_saves_failure = patch.deathSavesFailure
  if (patch.features !== undefined) dbPatch.features = toJson(patch.features)
  if (patch.inventory !== undefined) dbPatch.inventory = toJson(patch.inventory)
  if (patch.spells !== undefined) dbPatch.spells = toJson(patch.spells)
  if (patch.skillProficiencies !== undefined) {
    dbPatch.skill_proficiencies = toJson(patch.skillProficiencies)
  }
  if (patch.savingThrowProficiencies !== undefined) {
    dbPatch.saving_throw_proficiencies = toJson(patch.savingThrowProficiencies)
  }
  if (patch.equipment !== undefined) dbPatch.equipment = toJson(patch.equipment)
  if (patch.conditions !== undefined) dbPatch.conditions = toJson(patch.conditions)
  if (patch.portraitUrl !== undefined) dbPatch.portrait_url = patch.portraitUrl
  if (patch.bio !== undefined) dbPatch.bio = patch.bio

  // If scores or level changed, recalculate all derived stats.
  // (Level-only changes still need this: max_hp/armor_class/proficiency_bonus
  // are level-derived and must not go stale on a level-up with unchanged scores.)
  if (patch.scores || patch.level !== undefined) {
    const current = currentForRecalc as CharacterRecord
    const merged = {
      strength: patch.scores?.strength ?? current.sheet.scores.strength,
      dexterity: patch.scores?.dexterity ?? current.sheet.scores.dexterity,
      constitution: patch.scores?.constitution ?? current.sheet.scores.constitution,
      intelligence: patch.scores?.intelligence ?? current.sheet.scores.intelligence,
      wisdom: patch.scores?.wisdom ?? current.sheet.scores.wisdom,
      charisma: patch.scores?.charisma ?? current.sheet.scores.charisma,
    }
    const level = patch.level ?? current.sheet.level
    const archetype = patch.archetype ?? current.sheet.archetype
    const hitDie = resolveHitDie(archetype)

    dbPatch.str = merged.strength
    dbPatch.dex = merged.dexterity
    dbPatch.con = merged.constitution
    dbPatch.int = merged.intelligence
    dbPatch.wis = merged.wisdom
    dbPatch.cha = merged.charisma
    dbPatch.hit_die = hitDie
    dbPatch.max_hp = calculateMaxHp({ level, constitution: merged.constitution, hitDie })
    dbPatch.armor_class = patch.armorClass ?? BASE_UNARMORED_AC + getAbilityModifier(merged.dexterity)
    dbPatch.proficiency_bonus = getProficiencyBonus(level)
  }

  const { data, error } = await supabase
    .from('characters')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[updateCharacter] Character not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'updateCharacter')
  }
  assertFound(data, 'updateCharacter')

  return rowToCharacterRecord(data)
}

/**
 * Delete a character by ID.
 * RLS ensures only the owner can delete their own characters.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', id)

  if (error) throw fromPostgrestError(error, 'deleteCharacter')
}

/**
 * Duplicate an existing character, owned by the same user, as a brand new row.
 *
 * Reuses createCharacter() under the hood, so the duplicate is re-validated
 * and re-derived through buildCharacter() exactly like any other creation —
 * no bespoke copy logic, no duplicated rules. The copy:
 *   - Gets a fresh id, createdAt, updatedAt (DB-assigned)
 *   - Carries over every CharacterInput-shaped field (scores, archetype,
 *     ancestry, background, skills, saves, equipment, conditions)
 *   - Resets experience, current HP (to the recalculated max), death saves,
 *     features, inventory, and spells to a clean starting state — duplicating
 *     a character is "make me another one like this", not "clone this exact
 *     mid-campaign moment"
 *   - Appends " (Copy)" to the name, trimmed to the 60-char engine limit
 *
 * @param id            - The character to duplicate
 * @param requestingUserId - The user performing the duplication; the copy is owned by them
 *
 * @throws ServiceError('NOT_FOUND') if the source character doesn't exist or RLS blocks it
 * @throws ServiceError('VALIDATION') if the copy somehow fails engine validation
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function duplicateCharacter(
  id: string,
  requestingUserId: string,
): Promise<CharacterRecord> {
  const source = await getCharacter(id)

  const copyName = buildCopyName(source.sheet.name)

  return createCharacter({
    userId: requestingUserId,
    name: copyName,
    level: source.sheet.level,
    archetype: source.sheet.archetype,
    ancestry: source.sheet.ancestry,
    background: source.sheet.background,
    scores: { ...source.sheet.scores },
    armorClass: source.sheet.armorClass,
    skillProficiencies: [...source.sheet.skillProficiencies],
    savingThrowProficiencies: [...source.sheet.savingThrowProficiencies],
    equipment: source.sheet.equipment.map((item) => ({ ...item })),
    // Portrait and bio are carried over — they're identity, not combat
    // state, so "duplicate this character" reasonably keeps them.
    portraitUrl: source.portraitUrl,
    bio: source.bio,
    // Deliberately NOT carried over: currentHp, conditions, deathSaveSuccesses/
    // Failures, experience — a duplicate starts as a fresh, healthy character.
  })
}

/**
 * Build a "Copy" name, respecting buildCharacter()'s 60-character limit.
 * "Foo" -> "Foo (Copy)". If appending " (Copy)" would exceed 60 chars,
 * the base name is truncated first so the suffix always fits.
 */
function buildCopyName(originalName: string): string {
  const suffix = ' (Copy)'
  const maxBaseLength = 60 - suffix.length
  const base =
    originalName.length > maxBaseLength ? originalName.slice(0, maxBaseLength) : originalName
  return `${base}${suffix}`
}
