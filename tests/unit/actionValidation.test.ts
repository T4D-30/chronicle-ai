/**
 * Chronicle AI — Action Validation Tests
 * Phase 1.6
 */

import { describe, it, expect } from 'vitest'
import { buildCharacter } from '@/lib/engine/character'
import { createActiveCondition } from '@/lib/engine/conditions'
import { canPerformAction } from '@/lib/engine/actionValidation'
import type { CharacterSheet } from '@/lib/engine/character'

function withConditions(character: CharacterSheet, conditions: CharacterSheet['conditions']): CharacterSheet {
  return { ...character, conditions }
}

function withHp(character: CharacterSheet, currentHp: number): CharacterSheet {
  return { ...character, currentHp }
}

describe('canPerformAction — healthy character', () => {
  it('allows an ability check', () => {
    const character = buildCharacter({ name: 'Hero' })
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('allows a melee attack', () => {
    const character = buildCharacter({ name: 'Hero' })
    expect(canPerformAction(character, { kind: 'melee_attack' }).allowed).toBe(true)
  })

  it('allows movement', () => {
    const character = buildCharacter({ name: 'Hero' })
    expect(canPerformAction(character, { kind: 'move' }).allowed).toBe(true)
  })
})

describe('canPerformAction — dead', () => {
  it('blocks any action when currentHp <= -maxHp', () => {
    const character = withHp(buildCharacter({ name: 'Hero' }), -100)
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('DEAD')
    expect(result.reason).toContain('died')
  })

  it('does not block when above the death threshold', () => {
    const reference = buildCharacter({ name: 'Hero' })
    const character = withHp(reference, -(reference.maxHp - 1))
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).not.toBe('DEAD')
  })

  it('death takes priority over conditions', () => {
    const base = withHp(buildCharacter({ name: 'Hero' }), -100)
    const character = withConditions(base, [createActiveCondition('poisoned', 'venom', 1)])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).toBe('DEAD')
  })
})

describe('canPerformAction — dead via death saving throws', () => {
  it('blocks any action when deathSaveFailures reaches 3', () => {
    const character = buildCharacter({ name: 'Hero', deathSaveFailures: 3 })
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('DEAD')
    expect(result.reason).toContain('died')
  })

  it('does not block at 2 death save failures (not yet dead)', () => {
    const character = buildCharacter({ name: 'Hero', deathSaveFailures: 2 })
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).not.toBe('DEAD')
  })

  it('death save successes alone never trigger death', () => {
    const character = buildCharacter({ name: 'Hero', deathSaveSuccesses: 3, deathSaveFailures: 0 })
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).not.toBe('DEAD')
    expect(result.allowed).toBe(true)
  })

  it('death is triggered by death saves even when currentHp is above the instant-death threshold', () => {
    // currentHp is 0 (not below -maxHp), but 3 failed death saves still kills
    const character = withHp(
      buildCharacter({ name: 'Hero', deathSaveFailures: 3 }),
      0,
    )
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).toBe('DEAD')
  })
})

describe('canPerformAction — unconscious', () => {
  it('blocks actions when unconscious', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('unconscious', 'knocked out', 1)])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('UNCONSCIOUS')
    expect(result.blockingCondition).toBe('unconscious')
  })
})

describe('canPerformAction — paralyzed', () => {
  it('blocks actions when paralyzed', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('paralyzed', 'hold person', 1)])
    const result = canPerformAction(character, { kind: 'melee_attack' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('PARALYZED')
  })
})

describe('canPerformAction — petrified', () => {
  it('blocks actions when petrified', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('petrified', 'medusa gaze', 1)])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('PETRIFIED')
  })
})

describe('canPerformAction — stunned', () => {
  it('blocks actions when stunned', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('stunned', 'concussive blast', 1)])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('STUNNED')
  })
})

describe('canPerformAction — generic incapacitated', () => {
  it('blocks actions for a directly-applied incapacitated condition', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('incapacitated', 'unknown cause', 1)])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('INCAPACITATED')
  })
})

describe('canPerformAction — severity ordering', () => {
  it('reports unconscious before paralyzed when both are present', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [
      createActiveCondition('paralyzed', 'spell', 1),
      createActiveCondition('unconscious', 'falling damage', 1),
    ])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).toBe('UNCONSCIOUS')
  })

  it('reports paralyzed before stunned when both are present', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [
      createActiveCondition('stunned', 'spell', 1),
      createActiveCondition('paralyzed', 'hold person', 1),
    ])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.blockingReason).toBe('PARALYZED')
  })
})

describe('canPerformAction — non-blocking conditions still allow actions', () => {
  it('poisoned does not block actions (only imposes disadvantage)', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('poisoned', 'venom', 1)])
    expect(canPerformAction(character, { kind: 'ability_check' }).allowed).toBe(true)
  })

  it('prone does not block actions', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('prone', 'knocked down', 1)])
    expect(canPerformAction(character, { kind: 'melee_attack' }).allowed).toBe(true)
  })

  it('frightened does not block actions', () => {
    const base = buildCharacter({ name: 'Hero' })
    const character = withConditions(base, [createActiveCondition('frightened', 'dragon fear', 1)])
    expect(canPerformAction(character, { kind: 'ability_check' }).allowed).toBe(true)
  })
})

describe('canPerformAction — spell slot gate', () => {
  it('blocks leveled spellcasting (no slot tracking implemented yet)', () => {
    const character = buildCharacter({ name: 'Wizard' })
    const result = canPerformAction(character, { kind: 'cast_spell', spellSlotLevel: 1 })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('NO_SPELL_SLOTS')
  })

  it('allows cantrips (spellSlotLevel 0)', () => {
    const character = buildCharacter({ name: 'Wizard' })
    const result = canPerformAction(character, { kind: 'cast_spell', spellSlotLevel: 0 })
    expect(result.allowed).toBe(true)
  })

  it('allows cast_spell with no spellSlotLevel specified', () => {
    const character = buildCharacter({ name: 'Wizard' })
    const result = canPerformAction(character, { kind: 'cast_spell' })
    expect(result.allowed).toBe(true)
  })
})

describe('canPerformAction — ammunition gate', () => {
  it('blocks a ranged attack with zero ammunition remaining', () => {
    const character = buildCharacter({ name: 'Archer' })
    const result = canPerformAction(character, {
      kind: 'ranged_attack',
      requiresAmmunition: true,
      ammunitionRemaining: 0,
    })
    expect(result.allowed).toBe(false)
    expect(result.blockingReason).toBe('NO_AMMUNITION')
  })

  it('allows a ranged attack with ammunition remaining', () => {
    const character = buildCharacter({ name: 'Archer' })
    const result = canPerformAction(character, {
      kind: 'ranged_attack',
      requiresAmmunition: true,
      ammunitionRemaining: 5,
    })
    expect(result.allowed).toBe(true)
  })

  it('allows a ranged attack that does not require ammunition', () => {
    const character = buildCharacter({ name: 'Archer' })
    const result = canPerformAction(character, {
      kind: 'ranged_attack',
      requiresAmmunition: false,
    })
    expect(result.allowed).toBe(true)
  })

  it('allows when ammunitionRemaining is not tracked (undefined)', () => {
    const character = buildCharacter({ name: 'Archer' })
    const result = canPerformAction(character, {
      kind: 'ranged_attack',
      requiresAmmunition: true,
    })
    expect(result.allowed).toBe(true)
  })
})

describe('canPerformAction — invalid/edge inputs', () => {
  it('handles a character with an empty conditions array', () => {
    const character = buildCharacter({ name: 'Hero', conditions: [] })
    expect(canPerformAction(character, { kind: 'ability_check' }).allowed).toBe(true)
  })

  it('includes the character name in the blocking reason message', () => {
    const base = buildCharacter({ name: 'Sir Reginald' })
    const character = withConditions(base, [createActiveCondition('stunned', 'spell', 1)])
    const result = canPerformAction(character, { kind: 'ability_check' })
    expect(result.reason).toContain('Sir Reginald')
  })
})
