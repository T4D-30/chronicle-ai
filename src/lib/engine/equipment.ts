/**
 * Chronicle AI — Equipment Engine
 * Phase 1.6
 *
 * Defines the equipment bonus contract used by the resolver pipeline.
 * Scope is deliberately narrow per the Phase 1.6 spec: flat numeric
 * bonuses only. Magical effects (resistances, conditional triggers,
 * on-hit effects) are out of scope until a later volume.
 *
 * Pure data + pure functions — no RNG, no Supabase, no React.
 */

import type { SkillId } from './skills'
import type { StatName } from './intent'

// ─── Equipment Item ───────────────────────────────────────────────────────────

export type EquipmentSlot = 'weapon' | 'armor' | 'shield' | 'accessory'

/**
 * A single piece of equipment contributing flat numeric bonuses.
 * All bonus fields are optional — an item only contributes what it defines.
 *
 * Magical effects (e.g. "on hit, target is poisoned") are explicitly NOT
 * supported here — see module header. Only `+N`-style flat bonuses.
 */
export interface EquipmentItem {
  id: string
  name: string
  slot: EquipmentSlot
  /** Whether this item is currently equipped (unequipped items contribute nothing). */
  equipped: boolean
  /** Flat bonus to attack rolls when this item is the weapon used. */
  attackBonus?: number
  /** Flat bonus to armor class. */
  armorBonus?: number
  /** Flat bonus to one specific skill's checks. */
  skillBonus?: { skill: SkillId; value: number }
  /** Flat bonus to one specific ability's saving throws. */
  saveBonus?: { ability: StatName; value: number }
  /** Flat bonus to a passive score (e.g. passive Perception). */
  passiveBonus?: { skill: SkillId; value: number }
}

/** The full equipment loadout on a character. Order is insertion order; not significant. */
export type EquipmentLoadout = EquipmentItem[]

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a single equipment item's shape.
 * Returns an error string, or null if valid.
 */
export function validateEquipmentItem(item: EquipmentItem): string | null {
  if (!item.id || item.id.trim().length === 0) {
    return '[equipment] Equipment item id cannot be empty.'
  }
  if (!item.name || item.name.trim().length === 0) {
    return `[equipment] Equipment item "${item.id}" must have a name.`
  }
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'shield', 'accessory']
  if (!slots.includes(item.slot)) {
    return `[equipment] Equipment item "${item.id}" has invalid slot "${item.slot}".`
  }
  return null
}

// ─── Bonus Extraction ─────────────────────────────────────────────────────────

/**
 * Sum the attack bonus contribution from all equipped weapons.
 * Multiple equipped weapons (e.g. dual wielding) stack additively —
 * Chronicle AI does not yet model "only the active weapon counts";
 * the caller is expected to pass only the weapon currently in use
 * via context, or rely on this summing all equipped weapons (Volume I
 * simplification, documented as a known limitation).
 */
export function getEquipmentAttackBonus(loadout: EquipmentLoadout): number {
  return loadout
    .filter((item) => item.equipped && item.attackBonus !== undefined)
    .reduce((sum, item) => sum + (item.attackBonus ?? 0), 0)
}

/** Sum the armor class bonus contribution from all equipped armor/shield items. */
export function getEquipmentArmorBonus(loadout: EquipmentLoadout): number {
  return loadout
    .filter((item) => item.equipped && item.armorBonus !== undefined)
    .reduce((sum, item) => sum + (item.armorBonus ?? 0), 0)
}

/** Sum the skill-check bonus contribution from all equipped items for a specific skill. */
export function getEquipmentSkillBonus(loadout: EquipmentLoadout, skill: SkillId): number {
  return loadout
    .filter((item) => item.equipped && item.skillBonus?.skill === skill)
    .reduce((sum, item) => sum + (item.skillBonus?.value ?? 0), 0)
}

/** Sum the saving-throw bonus contribution from all equipped items for a specific ability. */
export function getEquipmentSaveBonus(loadout: EquipmentLoadout, ability: StatName): number {
  return loadout
    .filter((item) => item.equipped && item.saveBonus?.ability === ability)
    .reduce((sum, item) => sum + (item.saveBonus?.value ?? 0), 0)
}

/** Sum the passive-score bonus contribution from all equipped items for a specific skill. */
export function getEquipmentPassiveBonus(loadout: EquipmentLoadout, skill: SkillId): number {
  return loadout
    .filter((item) => item.equipped && item.passiveBonus?.skill === skill)
    .reduce((sum, item) => sum + (item.passiveBonus?.value ?? 0), 0)
}
