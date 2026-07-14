/**
 * characterAppearance Tests — UI 4.2 (Character Presence Pass)
 *
 * Deterministic derivations from real character state; unknowns always
 * fall back honestly (traveler body, no weapon) rather than guessing.
 */
import { describe, it, expect } from 'vitest'
import {
  bodyKindFor,
  weaponKindFor,
  facingFor,
  ACCENT_FOR_BODY,
} from '@/components/adventure/world/characterAppearance'
import type { EquipmentItem } from '@/lib/engine'

function weapon(name: string, equipped = true): EquipmentItem {
  return { id: 'w1', name, slot: 'weapon', equipped }
}

describe('bodyKindFor — archetype grouping (engine-normalized, honest fallback)', () => {
  it.each([
    ['fighter', 'bruiser'], ['Barbarian', 'bruiser'], ['berserker', 'bruiser'],
    ['paladin', 'devout'], ['cleric', 'devout'],
    ['rogue', 'skirmisher'], ['ranger', 'skirmisher'], ['bard', 'skirmisher'],
    ['wizard', 'caster'], ['sorcerer', 'caster'], ['warlock', 'caster'], ['druid', 'caster'],
  ] as const)('%s → %s', (archetype, body) => {
    expect(bodyKindFor(archetype)).toBe(body)
  })

  it('normalizes case/whitespace like the engine does', () => {
    expect(bodyKindFor('  WIZARD  ')).toBe('caster')
  })

  it('unknown or missing archetypes render the generic traveler', () => {
    expect(bodyKindFor('gunslinger')).toBe('traveler')
    expect(bodyKindFor(null)).toBe('traveler')
    expect(bodyKindFor(undefined)).toBe('traveler')
  })

  it('every body kind has a palette accent', () => {
    for (const body of ['bruiser', 'skirmisher', 'devout', 'caster', 'traveler'] as const) {
      expect(ACCENT_FOR_BODY[body]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('weaponKindFor — silhouette from the actually-equipped weapon', () => {
  it.each([
    ['Longsword of the Vale', 'sword'],
    ['Rusty Dagger', 'dagger'],
    ['Bearded Axe', 'axe'],
    ['Hunting Bow', 'bow'],
    ['Gnarled Oak Staff', 'staff'],
    ['Iron Mace', 'mace'],
    ['Boar Spear', 'spear'],
  ] as const)('"%s" → %s', (name, kind) => {
    expect(weaponKindFor([weapon(name)])).toBe(kind)
  })

  it('returns null when no weapon is equipped', () => {
    expect(weaponKindFor([weapon('Longsword', false)])).toBeNull()
    expect(weaponKindFor([])).toBeNull()
    expect(weaponKindFor(null)).toBeNull()
  })

  it('returns null for names with no honest keyword signal — never guesses', () => {
    expect(weaponKindFor([weapon('The Whisper of Dawn')])).toBeNull()
  })

  it('ignores equipped non-weapon slots', () => {
    const shield: EquipmentItem = { id: 's1', name: 'Sword-Sigil Shield', slot: 'shield', equipped: true }
    expect(weaponKindFor([shield])).toBeNull()
  })
})

describe('facingFor — stable per location, deterministic', () => {
  it('is stable for the same id and defaults right with no location', () => {
    expect(facingFor('loc-abc')).toBe(facingFor('loc-abc'))
    expect(facingFor(null)).toBe('right')
  })

  it('differs across ids with different parity', () => {
    // 'a' (97, odd) vs 'b' (98, even)
    expect(facingFor('a')).toBe('left')
    expect(facingFor('b')).toBe('right')
  })
})
