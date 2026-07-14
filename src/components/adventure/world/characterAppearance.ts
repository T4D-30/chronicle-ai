/**
 * characterAppearance — UI 4.2 (Character Presence Pass)
 *
 * Deterministic, presentation-only derivations from REAL character
 * state, so PlayerSprite can reflect the actual player without a
 * bespoke sprite system:
 *
 * - Body build + palette accent derive from the character's real
 *   `archetype` string (the same free-text field the engine's
 *   ARCHETYPE_HIT_DIE normalizes) — grouped into four silhouettes.
 *   Unknown archetypes render the generic traveler, never a guess.
 * - Weapon silhouette derives from the ACTUALLY EQUIPPED weapon's name
 *   via an explicit keyword table (same honest-parser approach as
 *   timeOfDay.ts). No equipped weapon, or a name with no keyword
 *   match, renders no weapon at all.
 * - Facing derives from the current location id — stable per place,
 *   varies between places, zero randomness.
 *
 * Colors are existing palette tokens only. `mystic` (reserved for
 * spell/magic-specific UI) gets its first legitimate use: the caster
 * robe. `harm`/`heal` are never used here (status-only semantics).
 */

import type { EquipmentItem } from '@/lib/engine'

export type BodyKind = 'bruiser' | 'skirmisher' | 'devout' | 'caster' | 'traveler'
export type WeaponKind = 'sword' | 'dagger' | 'axe' | 'bow' | 'staff' | 'mace' | 'spear'
export type Facing = 'left' | 'right'

const BODY_FOR_ARCHETYPE: Record<string, BodyKind> = {
  barbarian: 'bruiser',
  berserker: 'bruiser',
  fighter:   'bruiser',
  paladin:   'devout',
  cleric:    'devout',
  ranger:    'skirmisher',
  rogue:     'skirmisher',
  bard:      'skirmisher',
  monk:      'skirmisher',
  wizard:    'caster',
  sorcerer:  'caster',
  warlock:   'caster',
  druid:     'caster',
}

export function bodyKindFor(archetype: string | null | undefined): BodyKind {
  if (!archetype) return 'traveler'
  return BODY_FOR_ARCHETYPE[archetype.toLowerCase().trim()] ?? 'traveler'
}

/** Tunic/robe accent per build — existing palette hexes only. */
export const ACCENT_FOR_BODY: Record<BodyKind, string> = {
  bruiser:    '#7a5630', // bronze-600 — battered brigandine
  skirmisher: '#3a2b20', // panel-600 — dark leathers
  devout:     '#e2b562', // bronze-300 — gold tabard trim
  caster:     '#5e83d7', // mystic-400 — the magic accent's first real use
  traveler:   '#3a2b20', // the original hooded traveler
}

/* Substring (not word-boundary) matching on purpose: weapon names
   compound freely ("Longsword", "Warhammer", "Greataxe") and a
   silhouette miss costs more than a rare false positive. Order matters:
   dagger before sword so "Sword-Dagger" oddities lean short. */
const WEAPON_KEYWORDS: Array<[WeaponKind, RegExp]> = [
  ['dagger', /(dagger|knife|dirk|stiletto|shiv)/i],
  ['sword',  /(sword|blade|sabre|saber|scimitar|rapier|falchion|claymore)/i],
  ['axe',    /(axe|hatchet|cleaver)/i],
  ['bow',    /(bow|crossbow)/i],
  ['staff',  /(staff|rod|wand)/i],
  ['mace',   /(mace|hammer|club|flail|maul|morningstar|cudgel)/i],
  ['spear',  /(spear|pike|halberd|lance|glaive|trident|javelin)/i],
]

/** Silhouette for the character's actually-equipped weapon; null when
 *  nothing is equipped or the name gives no honest signal. */
export function weaponKindFor(equipment: EquipmentItem[] | null | undefined): WeaponKind | null {
  const weapon = equipment?.find((e) => e.slot === 'weapon' && e.equipped)
  if (!weapon) return null
  for (const [kind, pattern] of WEAPON_KEYWORDS) {
    if (pattern.test(weapon.name)) return kind
  }
  return null
}

/** Stable per-location facing — deterministic char-code parity. */
export function facingFor(locationId: string | null | undefined): Facing {
  if (!locationId) return 'right'
  let sum = 0
  for (let i = 0; i < locationId.length; i++) sum += locationId.charCodeAt(i)
  return sum % 2 === 0 ? 'right' : 'left'
}
