/**
 * Combat Persistence & Rewards Tests — Phase 5.1
 *
 * Covers: XP thresholds, level-up detection, loot parsing, enemy parsing from Director,
 * buildCombatResult, summariseCombatResult, parseLootFromDirector.
 * All pure engine functions — no mocking needed.
 */
import { describe, it, expect } from 'vitest'
import {
  XP_THRESHOLDS,
  getXpForNextLevel,
  isReadyToLevel,
  parseLootFromDirector,
  parseEnemiesFromDirector,
  buildCombatResult,
  summariseCombatResult,
  initCombat,
  calculateXp,
} from '@/lib/engine'
import type { EnemyCombatant, CombatState } from '@/lib/engine'
import { buildCharacter } from '@/lib/engine'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlayer() {
  return {
    id: 'player', name: 'Aldric', isPlayer: true as const,
    sheet: buildCharacter({
      name: 'Aldric', level: 3, archetype: 'fighter', ancestry: 'human', background: 'soldier',
      scores: { strength:16, dexterity:14, constitution:14, intelligence:10, wisdom:12, charisma:8 },
    }),
  }
}

function makeEnemy(overrides: Partial<EnemyCombatant> = {}): EnemyCombatant {
  return {
    id: 'goblin-1', name: 'Goblin', isPlayer: false,
    maxHp: 10, currentHp: 10, armorClass: 12,
    attackBonus: 2, damageDie: 'd6', damageBonus: 0, dexMod: 2,
    ...overrides,
  }
}

function makeVictoryState(): CombatState {
  const player = makePlayer()
  const enemy = makeEnemy({ currentHp: 0 })
  const state = initCombat(player, [enemy])
  return {
    ...state,
    enemies: [enemy],
    phase: 'summary',
    xpAwarded: calculateXp([enemy]),
    playerCurrentHp: 20,
  }
}

function makeDefeatState(): CombatState {
  const player = makePlayer()
  const enemy = makeEnemy()
  const state = initCombat(player, [enemy])
  return {
    ...state,
    phase: 'summary',
    playerCurrentHp: 0,
    playerDeathFailures: 3,
    xpAwarded: 0,
  }
}

function makeFleeState(): CombatState {
  const player = makePlayer()
  const enemy = makeEnemy({ currentHp: 5 }) // still alive
  const state = initCombat(player, [enemy])
  return {
    ...state,
    enemies: [{ ...enemy, currentHp: 5 }],
    phase: 'summary',
    playerCurrentHp: 8,
    xpAwarded: 0,
  }
}

// ── XP thresholds ─────────────────────────────────────────────────────────────

describe('XP_THRESHOLDS', () => {
  it('level 1 starts at 0 XP', () => {
    expect(XP_THRESHOLDS[1]).toBe(0)
  })

  it('level 2 requires 300 XP', () => {
    expect(XP_THRESHOLDS[2]).toBe(300)
  })

  it('level 20 is defined', () => {
    expect(XP_THRESHOLDS[20]).toBeGreaterThan(0)
  })

  it('thresholds are strictly increasing', () => {
    for (let lvl = 2; lvl <= 20; lvl++) {
      expect(XP_THRESHOLDS[lvl]).toBeGreaterThan(XP_THRESHOLDS[lvl - 1])
    }
  })
})

describe('getXpForNextLevel', () => {
  it('returns 300 for level 1 (threshold for level 2)', () => {
    expect(getXpForNextLevel(1)).toBe(300)
  })

  it('returns level 20 threshold when at level 19', () => {
    expect(getXpForNextLevel(19)).toBe(XP_THRESHOLDS[20])
  })

  it('returns level 20 threshold when already at 20 (caps)', () => {
    expect(getXpForNextLevel(20)).toBe(XP_THRESHOLDS[20])
  })
})

describe('isReadyToLevel', () => {
  it('returns false when XP is below threshold', () => {
    expect(isReadyToLevel(0, 1)).toBe(false)
    expect(isReadyToLevel(299, 1)).toBe(false)
  })

  it('returns true when XP meets threshold', () => {
    expect(isReadyToLevel(300, 1)).toBe(true)
    expect(isReadyToLevel(500, 1)).toBe(true)
  })

  it('returns false when already at max level', () => {
    expect(isReadyToLevel(999999, 20)).toBe(false)
  })

  it('returns true at exact threshold', () => {
    expect(isReadyToLevel(XP_THRESHOLDS[5], 4)).toBe(true)
  })
})

// ── Loot parsing ──────────────────────────────────────────────────────────────

describe('parseLootFromDirector', () => {
  it('returns empty array when no loot key', () => {
    expect(parseLootFromDirector({})).toHaveLength(0)
  })

  it('returns empty array when loot is not an array', () => {
    expect(parseLootFromDirector({ loot: 'gold' })).toHaveLength(0)
    expect(parseLootFromDirector({ loot: null })).toHaveLength(0)
  })

  it('parses a valid loot item', () => {
    const result = parseLootFromDirector({
      loot: [{ name: 'Iron Sword', quantity: 1, goldValue: 15, description: 'A standard blade.' }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Iron Sword')
    expect(result[0].quantity).toBe(1)
    expect(result[0].goldValue).toBe(15)
  })

  it('defaults quantity to 1 when missing or invalid', () => {
    const result = parseLootFromDirector({ loot: [{ name: 'Potion' }] })
    expect(result[0].quantity).toBe(1)
  })

  it('defaults goldValue to 0 when missing', () => {
    const result = parseLootFromDirector({ loot: [{ name: 'Potion' }] })
    expect(result[0].goldValue).toBe(0)
  })

  it('filters items without a string name', () => {
    const result = parseLootFromDirector({ loot: [{ quantity: 3 }, { name: 'Gold Coin', quantity: 10 }] })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Gold Coin')
  })

  it('caps name at 100 chars', () => {
    const longName = 'x'.repeat(200)
    const result = parseLootFromDirector({ loot: [{ name: longName }] })
    expect(result[0].name.length).toBe(100)
  })

  it('caps at 10 items', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ name: `Item ${i}` }))
    expect(parseLootFromDirector({ loot: items })).toHaveLength(10)
  })

  it('each item gets a unique id', () => {
    const result = parseLootFromDirector({ loot: [{ name: 'A' }, { name: 'B' }] })
    expect(result[0].id).not.toBe(result[1].id)
  })
})

// ── Enemy parsing from Director ───────────────────────────────────────────────

describe('parseEnemiesFromDirector', () => {
  it('returns empty array when no enemies key', () => {
    expect(parseEnemiesFromDirector({})).toHaveLength(0)
  })

  it('returns empty array when enemies is not an array', () => {
    expect(parseEnemiesFromDirector({ enemies: 'goblin' })).toHaveLength(0)
  })

  it('parses a well-formed enemy', () => {
    const result = parseEnemiesFromDirector({
      enemies: [{
        name: 'Goblin', maxHp: 8, armorClass: 13, attackBonus: 4,
        damageDie: 'd6', damageBonus: 2, dexMod: 2, xpValue: 50,
      }],
    })
    expect(result).toHaveLength(1)
    const e = result[0]
    expect(e.name).toBe('Goblin')
    expect(e.maxHp).toBe(8)
    expect(e.currentHp).toBe(8)       // currentHp = maxHp on spawn
    expect(e.armorClass).toBe(13)
    expect(e.attackBonus).toBe(4)
    expect(e.damageDie).toBe('d6')
    expect(e.damageBonus).toBe(2)
    expect(e.dexMod).toBe(2)
    expect(e.isPlayer).toBe(false)
  })

  it('fallbacks to defaults for missing fields', () => {
    const result = parseEnemiesFromDirector({ enemies: [{}] })
    expect(result).toHaveLength(1)
    const e = result[0]
    expect(e.name).toMatch(/Enemy \d+/)
    expect(e.maxHp).toBe(10)
    expect(e.armorClass).toBe(12)
    expect(e.damageDie).toBe('d6')
  })

  it('rejects invalid damageDie and falls back to d6', () => {
    const result = parseEnemiesFromDirector({ enemies: [{ name: 'Slime', damageDie: 'd100' }] })
    expect(result[0].damageDie).toBe('d6')
  })

  it('clamps attackBonus to [-5, 20]', () => {
    const tooHigh = parseEnemiesFromDirector({ enemies: [{ name: 'God', attackBonus: 999 }] })
    expect(tooHigh[0].attackBonus).toBe(20)
    const tooLow = parseEnemiesFromDirector({ enemies: [{ name: 'Wimp', attackBonus: -999 }] })
    expect(tooLow[0].attackBonus).toBe(-5)
  })

  it('clamps maxHp to [1, 999]', () => {
    const huge = parseEnemiesFromDirector({ enemies: [{ name: 'Dragon', maxHp: 10000 }] })
    expect(huge[0].maxHp).toBe(999)
  })

  it('caps at 8 enemies', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `E${i}` }))
    expect(parseEnemiesFromDirector({ enemies: many })).toHaveLength(8)
  })

  it('each enemy gets a unique id', () => {
    const result = parseEnemiesFromDirector({ enemies: [{ name: 'A' }, { name: 'B' }] })
    expect(result[0].id).not.toBe(result[1].id)
  })
})

// ── buildCombatResult ─────────────────────────────────────────────────────────

describe('buildCombatResult', () => {
  it('outcome is "victory" when all enemies defeated', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    expect(result.outcome).toBe('victory')
  })

  it('outcome is "defeat" when player has 3 death failures', () => {
    const result = buildCombatResult(makeDefeatState(), [])
    expect(result.outcome).toBe('defeat')
  })

  it('outcome is "fled" when enemies survive and player is alive', () => {
    const result = buildCombatResult(makeFleeState(), [])
    expect(result.outcome).toBe('fled')
  })

  it('includes xpAwarded from combat state', () => {
    const state = makeVictoryState()
    const result = buildCombatResult(state, [])
    expect(result.xpAwarded).toBe(state.xpAwarded)
  })

  it('includes only defeated enemies (hp === 0)', () => {
    const state = makeVictoryState()
    const result = buildCombatResult(state, [])
    expect(result.enemiesDefeated.every((e) => e.currentHp === 0)).toBe(true)
  })

  it('includes passed loot', () => {
    const loot = [{ id: 'l1', name: 'Sword', quantity: 1, goldValue: 20, description: '' }]
    const result = buildCombatResult(makeVictoryState(), loot)
    expect(result.loot).toEqual(loot)
  })

  it('includes finalPlayerHp clamped to 0 minimum', () => {
    const result = buildCombatResult(makeDefeatState(), [])
    expect(result.finalPlayerHp).toBe(0)
  })

  it('includes rounds count', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    expect(result.rounds).toBeGreaterThan(0)
  })

  it('includes endedAt ISO timestamp', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    expect(new Date(result.endedAt).toString()).not.toBe('Invalid Date')
  })
})

// ── summariseCombatResult ─────────────────────────────────────────────────────

describe('summariseCombatResult', () => {
  it('starts with "Victory!" for victory outcome', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    expect(summariseCombatResult(result)).toMatch(/Victory!/i)
  })

  it('starts with "Defeat." for defeat outcome', () => {
    const result = buildCombatResult(makeDefeatState(), [])
    expect(summariseCombatResult(result)).toMatch(/Defeat\./i)
  })

  it('contains "escaped" for flee outcome', () => {
    const result = buildCombatResult(makeFleeState(), [])
    expect(summariseCombatResult(result)).toMatch(/escaped/i)
  })

  it('includes round count', () => {
    const state = { ...makeVictoryState(), round: 4 }
    const result = buildCombatResult(state, [])
    const text = summariseCombatResult(result)
    expect(text).toContain('4 rounds')
  })

  it('includes enemy names when defeated', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    expect(summariseCombatResult(result)).toContain('Goblin')
  })

  it('includes XP when > 0', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    if (result.xpAwarded > 0) {
      expect(summariseCombatResult(result)).toContain('XP')
    }
  })

  it('includes loot names', () => {
    const loot = [{ id: 'l1', name: 'Magic Dagger', quantity: 1, goldValue: 0, description: '' }]
    const result = buildCombatResult(makeVictoryState(), loot)
    expect(summariseCombatResult(result)).toContain('Magic Dagger')
  })

  it('returns a non-empty string', () => {
    const result = buildCombatResult(makeVictoryState(), [])
    expect(summariseCombatResult(result).length).toBeGreaterThan(0)
  })
})
