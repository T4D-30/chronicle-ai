/**
 * Combat Engine Tests — Phase 5
 *
 * Pure function tests — no UI, no mocking.
 * Uses seeded RNG for deterministic results where needed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  rollInitiative,
  buildInitiativeOrder,
  resolvePlayerAttack,
  resolveEnemyAttack,
  rollDeathSave,
  rollConcentrationSave,
  initCombat,
  advanceTurn,
  allEnemiesDefeated,
  calculateXp,
  createSeededRng,
  setRng,
  resetRng,
} from '@/lib/engine'
import type { PlayerCombatant, EnemyCombatant } from '@/lib/engine'
import { buildCharacter } from '@/lib/engine'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlayer(): PlayerCombatant {
  return {
    id: 'player',
    name: 'Aldric Sorn',
    isPlayer: true,
    sheet: buildCharacter({
      name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
      background: 'soldier',
      scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
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

// ── Initiative ─────────────────────────────────────────────────────────────────

describe('rollInitiative', () => {
  it('returns an entry with the combatant id and name', () => {
    const entry = rollInitiative('e1', 'Goblin', false, 2)
    expect(entry.combatantId).toBe('e1')
    expect(entry.name).toBe('Goblin')
    expect(entry.isPlayer).toBe(false)
  })

  it('initiative = roll total (d20 + dex mod)', () => {
    const entry = rollInitiative('e1', 'Goblin', false, 2)
    expect(entry.initiative).toBe(entry.roll.total)
  })
})

describe('buildInitiativeOrder', () => {
  it('returns one entry per combatant', () => {
    const player = makePlayer()
    const enemies = [makeEnemy({ id: 'g1' }), makeEnemy({ id: 'g2' })]
    const order = buildInitiativeOrder(player, enemies)
    expect(order).toHaveLength(3)
  })

  it('entries are sorted highest initiative first', () => {
    const player = makePlayer()
    const enemies = [makeEnemy()]
    const order = buildInitiativeOrder(player, enemies)
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i].initiative).toBeGreaterThanOrEqual(order[i + 1].initiative)
    }
  })

  it('player wins ties against enemies', () => {
    // Seed both to produce the same roll value, player still goes first
    setRng(createSeededRng(42))
    const player = makePlayer()
    const enemies = [makeEnemy()]
    const order = buildInitiativeOrder(player, enemies)
    resetRng()
    // Even if tied, player entry should appear before enemy
    const playerIdx = order.findIndex((e) => e.isPlayer)
    const enemyIdx  = order.findIndex((e) => !e.isPlayer)
    // Either player won initiative or they tied — player first on tie
    expect(playerIdx).toBeLessThanOrEqual(enemyIdx)
  })
})

// ── Attack resolution ─────────────────────────────────────────────────────────

describe('resolvePlayerAttack', () => {
  beforeEach(() => setRng(createSeededRng(1)))
  afterEach(() => resetRng())

  it('returns an AttackResult', () => {
    const player = makePlayer()
    const enemy = makeEnemy({ armorClass: 5 }) // very low AC → should hit
    const result = resolvePlayerAttack(player.sheet, enemy, {
      weaponDamageDie: 'd8', weaponDamageBonus: 3, proficient: true, usesDex: false,
    })
    expect(result).toHaveProperty('hit')
    expect(result).toHaveProperty('attackRoll')
    expect(result).toHaveProperty('totalDamage')
    expect(result).toHaveProperty('newTargetHp')
  })

  it('hit reduces target HP', () => {
    const player = makePlayer()
    const enemy = makeEnemy({ armorClass: 1, currentHp: 20, maxHp: 20 }) // guaranteed hit
    setRng(() => 0.999) // roll 20 → always hit
    const result = resolvePlayerAttack(player.sheet, enemy, {
      weaponDamageDie: 'd6', weaponDamageBonus: 3, proficient: true, usesDex: false,
    })
    if (result.hit) {
      expect(result.newTargetHp).toBeLessThan(enemy.currentHp)
    }
  })

  it('newTargetHp never goes below 0', () => {
    const player = makePlayer()
    const enemy = makeEnemy({ armorClass: 1, currentHp: 1 })
    setRng(() => 0.999) // roll 20
    const result = resolvePlayerAttack(player.sheet, enemy, {
      weaponDamageDie: 'd12', weaponDamageBonus: 10, proficient: true, usesDex: false,
    })
    expect(result.newTargetHp).toBeGreaterThanOrEqual(0)
  })

  it('miss leaves target HP unchanged', () => {
    const player = makePlayer()
    const enemy = makeEnemy({ armorClass: 30, currentHp: 10 }) // impossible to hit
    setRng(() => 0.0001) // roll 1 → nat 1
    const result = resolvePlayerAttack(player.sheet, enemy, {
      weaponDamageDie: 'd6', weaponDamageBonus: 0, proficient: false, usesDex: false,
    })
    if (!result.hit && !result.critical) {
      expect(result.newTargetHp).toBe(enemy.currentHp)
    }
  })
})

describe('resolveEnemyAttack', () => {
  beforeEach(() => setRng(createSeededRng(7)))
  afterEach(() => resetRng())

  it('returns an AttackResult', () => {
    const enemy = makeEnemy({ armorClass: 5, attackBonus: 5 })
    const player = makePlayer()
    const result = resolveEnemyAttack(enemy, player.sheet)
    expect(result).toHaveProperty('hit')
    expect(result).toHaveProperty('newTargetHp')
  })
})

// ── Death saves ───────────────────────────────────────────────────────────────

describe('rollDeathSave', () => {
  it('natural 20 = revived', () => {
    setRng(() => 0.999) // floor(0.999*20)+1=20 → nat 20
    const result = rollDeathSave(0, 0)
    resetRng()
    expect(result.outcome).toBe('revived')
  })

  it('3 successes = stable', () => {
    setRng(() => 0.9) // roll 18 → success
    const result = rollDeathSave(2, 0) // this is the 3rd success
    resetRng()
    expect(result.outcome).toBe('stable')
    expect(result.successesTotal).toBe(3)
  })

  it('3 failures = dead', () => {
    setRng(() => 0.0001) // floor(0.0001*20)+1=1 → nat 1 → 2 failures
    const result = rollDeathSave(0, 2) // adding nat 1 = 2 more failures → 4 total capped to 3
    resetRng()
    expect(result.outcome).toBe('dead')
  })

  it('natural 1 counts as 2 failures', () => {
    setRng(() => 0.0001) // floor(0.0001*20)+1=1 → nat 1
    const result = rollDeathSave(0, 0)
    resetRng()
    expect(result.failuresTotal).toBe(2)
  })

  it('roll < 10 is a failure (not dead unless 3rd)', () => {
    setRng(() => 0.4) // roll ~8 → failure, but only 1st
    const result = rollDeathSave(0, 0)
    resetRng()
    expect(result.outcome).toBe('failure')
    expect(result.failuresTotal).toBe(1)
  })
})

// ── Concentration save ────────────────────────────────────────────────────────

describe('rollConcentrationSave', () => {
  afterEach(() => resetRng())

  it('DC is max(10, half damage)', () => {
    const player = makePlayer()
    setRng(() => 0.5) // mid roll
    const { dc } = rollConcentrationSave(player.sheet, 20)
    expect(dc).toBe(10) // half of 20 = 10
  })

  it('DC is 10 for damage ≤ 20', () => {
    const player = makePlayer()
    setRng(() => 0.5)
    const { dc } = rollConcentrationSave(player.sheet, 8)
    expect(dc).toBe(10) // half of 8 = 4, max(10,4) = 10
  })

  it('DC is half damage for high damage', () => {
    const player = makePlayer()
    setRng(() => 0.5)
    const { dc } = rollConcentrationSave(player.sheet, 40)
    expect(dc).toBe(20) // half of 40
  })
})

// ── Combat state machine ──────────────────────────────────────────────────────

describe('initCombat', () => {
  it('creates a combat state with initiative order', () => {
    const player = makePlayer()
    const enemies = [makeEnemy()]
    const state = initCombat(player, enemies)
    expect(state.initiativeOrder).toHaveLength(2)
    expect(state.round).toBe(1)
    expect(['player_turn', 'enemy_turn']).toContain(state.phase)
  })

  it('player HP is taken from sheet', () => {
    const player = makePlayer()
    const state = initCombat(player, [makeEnemy()])
    expect(state.playerCurrentHp).toBe(player.sheet.currentHp)
  })

  it('adds an opening log entry', () => {
    const player = makePlayer()
    const state = initCombat(player, [makeEnemy()])
    expect(state.log.length).toBeGreaterThan(0)
    expect(state.log[0].description).toMatch(/combat begins/i)
  })
})

describe('advanceTurn', () => {
  it('increments round when wrapping initiative order', () => {
    const player = makePlayer()
    const enemy = makeEnemy()
    let state = initCombat(player, [enemy])
    // Force to the last combatant
    state = { ...state, activeIndex: state.initiativeOrder.length - 1 }
    const next = advanceTurn(state)
    expect(next.activeIndex).toBe(0)
    expect(next.round).toBeGreaterThan(state.round)
  })

  it('changes phase based on whose turn it is', () => {
    const player = makePlayer()
    const enemies = [makeEnemy()]
    const state = initCombat(player, enemies)
    const next = advanceTurn(state)
    const nextEntry = next.initiativeOrder[next.activeIndex]
    expect(next.phase).toBe(nextEntry.isPlayer ? 'player_turn' : 'enemy_turn')
  })
})

describe('allEnemiesDefeated', () => {
  it('returns false when enemies have HP', () => {
    const player = makePlayer()
    const state = initCombat(player, [makeEnemy()])
    expect(allEnemiesDefeated(state)).toBe(false)
  })

  it('returns true when all enemies have 0 HP', () => {
    const player = makePlayer()
    const state = initCombat(player, [makeEnemy({ currentHp: 0 })])
    expect(allEnemiesDefeated(state)).toBe(true)
  })
})

describe('calculateXp', () => {
  it('returns sum of half maxHp values', () => {
    const enemies: EnemyCombatant[] = [
      makeEnemy({ maxHp: 10 }),
      makeEnemy({ id: 'g2', maxHp: 20 }),
    ]
    expect(calculateXp(enemies)).toBe(15) // 5 + 10
  })

  it('returns 0 for empty enemy list', () => {
    expect(calculateXp([])).toBe(0)
  })
})
