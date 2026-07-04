/**
 * Chronicle AI — Skills Engine
 * Phase 1.6
 *
 * Defines the standard 18-skill table and its mapping to ability scores.
 * Pure data + pure functions — no RNG, no Supabase, no React.
 *
 * Constitution alignment:
 *   - Pillar 5: "Familiar to Players Who Already Know D&D" — skill names
 *     and ability mappings are the standard D&D 5e set, unmodified.
 *   - Law 3: skills are read from structured character data
 *     (CharacterSheet.skillProficiencies), never inferred from prose.
 */

import type { StatName } from './intent'

// ─── Skill Identifiers ────────────────────────────────────────────────────────

/**
 * The eighteen standard skills. Using a const tuple keeps values as literal
 * strings at runtime — safe for JSONB round-trips and Director payloads.
 */
export const SKILL_IDS = [
  'acrobatics',
  'animal_handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight_of_hand',
  'stealth',
  'survival',
] as const

export type SkillId = (typeof SKILL_IDS)[number]

// ─── Skill → Ability Mapping ──────────────────────────────────────────────────

/**
 * The governing ability for each skill, per standard D&D 5e rules.
 * This mapping is fixed — Chronicle AI does not support reassigning
 * a skill's governing ability (some D&D variant rules allow this; out of scope).
 */
export const SKILL_ABILITY: Record<SkillId, StatName> = {
  athletics: 'STR',

  acrobatics: 'DEX',
  sleight_of_hand: 'DEX',
  stealth: 'DEX',

  arcana: 'INT',
  history: 'INT',
  investigation: 'INT',
  nature: 'INT',
  religion: 'INT',

  animal_handling: 'WIS',
  insight: 'WIS',
  medicine: 'WIS',
  perception: 'WIS',
  survival: 'WIS',

  deception: 'CHA',
  intimidation: 'CHA',
  performance: 'CHA',
  persuasion: 'CHA',
}

/** Display names for UI — Roll20/D&D 2024 familiar capitalisation. */
export const SKILL_DISPLAY_NAME: Record<SkillId, string> = {
  acrobatics: 'Acrobatics',
  animal_handling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Type guard: is this string a known skill id? */
export function isValidSkillId(value: string): value is SkillId {
  return (SKILL_IDS as readonly string[]).includes(value)
}

/**
 * Get the governing ability for a skill.
 * @throws {Error} if the skill id is unknown
 */
export function getSkillAbility(skill: SkillId): StatName {
  const ability = SKILL_ABILITY[skill]
  if (!ability) {
    throw new Error(`[skills] Unknown skill id: "${skill}".`)
  }
  return ability
}
