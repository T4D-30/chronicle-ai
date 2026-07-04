/**
 * Chronicle AI — Equipment Engine Tests
 * Phase 1.6
 */

import { describe, it, expect } from 'vitest'
import {
  validateEquipmentItem,
  getEquipmentAttackBonus,
  getEquipmentArmorBonus,
  getEquipmentSkillBonus,
  getEquipmentSaveBonus,
  getEquipmentPassiveBonus,
} from '@/lib/engine/equipment'
import type { EquipmentItem, EquipmentLoadout } from '@/lib/engine/equipment'

function makeItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    slot: 'weapon',
    equipped: true,
    ...overrides,
  }
}

describe('validateEquipmentItem', () => {
  it('returns null for a valid item', () => {
    expect(validateEquipmentItem(makeItem())).toBeNull()
  })

  it('rejects empty id', () => {
    expect(validateEquipmentItem(makeItem({ id: '' }))).toContain('id cannot be empty')
  })

  it('rejects empty name', () => {
    expect(validateEquipmentItem(makeItem({ name: '' }))).toContain('must have a name')
  })

  it('rejects invalid slot', () => {
    // @ts-expect-error — intentional bad value
    expect(validateEquipmentItem(makeItem({ slot: 'helmet' }))).toContain('invalid slot')
  })

  it('accepts all four valid slots', () => {
    expect(validateEquipmentItem(makeItem({ slot: 'weapon' }))).toBeNull()
    expect(validateEquipmentItem(makeItem({ slot: 'armor' }))).toBeNull()
    expect(validateEquipmentItem(makeItem({ slot: 'shield' }))).toBeNull()
    expect(validateEquipmentItem(makeItem({ slot: 'accessory' }))).toBeNull()
  })
})

describe('getEquipmentAttackBonus', () => {
  it('returns 0 for empty loadout', () => {
    expect(getEquipmentAttackBonus([])).toBe(0)
  })

  it('sums attack bonus from a single equipped weapon', () => {
    const loadout: EquipmentLoadout = [makeItem({ attackBonus: 1 })]
    expect(getEquipmentAttackBonus(loadout)).toBe(1)
  })

  it('ignores unequipped items', () => {
    const loadout: EquipmentLoadout = [makeItem({ attackBonus: 1, equipped: false })]
    expect(getEquipmentAttackBonus(loadout)).toBe(0)
  })

  it('ignores items with no attackBonus field', () => {
    const loadout: EquipmentLoadout = [makeItem({ attackBonus: undefined })]
    expect(getEquipmentAttackBonus(loadout)).toBe(0)
  })

  it('stacks attack bonus across multiple equipped items', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ id: 'sword', attackBonus: 1 }),
      makeItem({ id: 'ring', attackBonus: 1, slot: 'accessory' }),
    ]
    expect(getEquipmentAttackBonus(loadout)).toBe(2)
  })

  it('ignores items contributing other bonus types', () => {
    const loadout: EquipmentLoadout = [makeItem({ armorBonus: 2, slot: 'armor' })]
    expect(getEquipmentAttackBonus(loadout)).toBe(0)
  })
})

describe('getEquipmentArmorBonus', () => {
  it('returns 0 for empty loadout', () => {
    expect(getEquipmentArmorBonus([])).toBe(0)
  })

  it('sums armor bonus from equipped armor', () => {
    const loadout: EquipmentLoadout = [makeItem({ slot: 'armor', armorBonus: 3 })]
    expect(getEquipmentArmorBonus(loadout)).toBe(3)
  })

  it('stacks armor + shield bonuses', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ id: 'mail', slot: 'armor', armorBonus: 4 }),
      makeItem({ id: 'shield', slot: 'shield', armorBonus: 2 }),
    ]
    expect(getEquipmentArmorBonus(loadout)).toBe(6)
  })

  it('ignores unequipped armor', () => {
    const loadout: EquipmentLoadout = [makeItem({ slot: 'armor', armorBonus: 5, equipped: false })]
    expect(getEquipmentArmorBonus(loadout)).toBe(0)
  })
})

describe('getEquipmentSkillBonus', () => {
  it('returns 0 when no item grants the skill', () => {
    const loadout: EquipmentLoadout = [makeItem({ skillBonus: { skill: 'stealth', value: 2 } })]
    expect(getEquipmentSkillBonus(loadout, 'athletics')).toBe(0)
  })

  it('returns the bonus for a matching skill', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ slot: 'accessory', skillBonus: { skill: 'stealth', value: 2 } }),
    ]
    expect(getEquipmentSkillBonus(loadout, 'stealth')).toBe(2)
  })

  it('stacks multiple items granting the same skill', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ id: 'boots', slot: 'accessory', skillBonus: { skill: 'stealth', value: 2 } }),
      makeItem({ id: 'cloak', slot: 'accessory', skillBonus: { skill: 'stealth', value: 1 } }),
    ]
    expect(getEquipmentSkillBonus(loadout, 'stealth')).toBe(3)
  })

  it('ignores unequipped items', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ skillBonus: { skill: 'stealth', value: 5 }, equipped: false }),
    ]
    expect(getEquipmentSkillBonus(loadout, 'stealth')).toBe(0)
  })
})

describe('getEquipmentSaveBonus', () => {
  it('returns 0 when no item grants the save', () => {
    const loadout: EquipmentLoadout = [makeItem({ saveBonus: { ability: 'CON', value: 1 } })]
    expect(getEquipmentSaveBonus(loadout, 'WIS')).toBe(0)
  })

  it('returns the bonus for a matching ability', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ slot: 'accessory', saveBonus: { ability: 'WIS', value: 1 } }),
    ]
    expect(getEquipmentSaveBonus(loadout, 'WIS')).toBe(1)
  })

  it('stacks multiple items granting the same save', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ id: 'cloak', slot: 'accessory', saveBonus: { ability: 'DEX', value: 1 } }),
      makeItem({ id: 'amulet', slot: 'accessory', saveBonus: { ability: 'DEX', value: 1 } }),
    ]
    expect(getEquipmentSaveBonus(loadout, 'DEX')).toBe(2)
  })
})

describe('getEquipmentPassiveBonus', () => {
  it('returns 0 when no item grants the passive bonus', () => {
    expect(getEquipmentPassiveBonus([], 'perception')).toBe(0)
  })

  it('returns the bonus for a matching passive skill', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ slot: 'accessory', passiveBonus: { skill: 'perception', value: 2 } }),
    ]
    expect(getEquipmentPassiveBonus(loadout, 'perception')).toBe(2)
  })

  it('ignores unequipped items', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ passiveBonus: { skill: 'perception', value: 5 }, equipped: false }),
    ]
    expect(getEquipmentPassiveBonus(loadout, 'perception')).toBe(0)
  })
})

describe('mixed equipment loadout', () => {
  it('correctly isolates each bonus type from a complex loadout', () => {
    const loadout: EquipmentLoadout = [
      makeItem({ id: 'sword', name: 'Longsword', slot: 'weapon', attackBonus: 1 }),
      makeItem({ id: 'mail', name: 'Chain Mail', slot: 'armor', armorBonus: 4 }),
      makeItem({ id: 'shield', name: 'Shield', slot: 'shield', armorBonus: 2 }),
      makeItem({
        id: 'cloak',
        name: 'Cloak of Elvenkind',
        slot: 'accessory',
        skillBonus: { skill: 'stealth', value: 2 },
      }),
      makeItem({
        id: 'ring',
        name: 'Ring of Protection',
        slot: 'accessory',
        saveBonus: { ability: 'WIS', value: 1 },
      }),
      makeItem({
        id: 'goggles',
        name: 'Goggles of Night',
        slot: 'accessory',
        passiveBonus: { skill: 'perception', value: 0 },
        equipped: false,
      }),
    ]

    expect(getEquipmentAttackBonus(loadout)).toBe(1)
    expect(getEquipmentArmorBonus(loadout)).toBe(6)
    expect(getEquipmentSkillBonus(loadout, 'stealth')).toBe(2)
    expect(getEquipmentSkillBonus(loadout, 'athletics')).toBe(0)
    expect(getEquipmentSaveBonus(loadout, 'WIS')).toBe(1)
    expect(getEquipmentSaveBonus(loadout, 'DEX')).toBe(0)
    expect(getEquipmentPassiveBonus(loadout, 'perception')).toBe(0)
  })
})
