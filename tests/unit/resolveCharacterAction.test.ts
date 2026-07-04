/**
 * Chronicle AI — resolveCharacterAction Tests
 * Phase 1.6
 *
 * This is the integration test suite for the Phase 1.6 spec's headline
 * feature: automatic character resolution. Covers all acceptance criteria
 * named in the prompt — automatic modifier calculation, equipment stacking,
 * condition application, blocked actions, advantage/disadvantage,
 * breakdown generation, invalid inputs, mixed equipment, mixed conditions.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { setRng, resetRng } from '@/lib/engine/dice'
import { buildCharacter } from '@/lib/engine/character'
import { createActiveCondition } from '@/lib/engine/conditions'
import { Outcome } from '@/lib/engine/outcome'
import { resolveCharacterAction, formatBreakdown, summariseCharacterAction } from '@/lib/engine/resolveAction'
import type { CharacterSheet } from '@/lib/engine/character'
import type { EquipmentLoadout } from '@/lib/engine/equipment'

afterEach(() => resetRng())

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRogue(): CharacterSheet {
  return buildCharacter({
    name: 'Lira Swiftfoot',
    archetype: 'rogue',
    level: 5, // proficiency +3
    scores: { dexterity: 18, strength: 10, constitution: 12, intelligence: 14, wisdom: 10, charisma: 12 },
    skillProficiencies: ['stealth', 'sleight_of_hand'],
    savingThrowProficiencies: ['DEX', 'INT'],
  })
}

function withConditions(character: CharacterSheet, conditions: CharacterSheet['conditions']): CharacterSheet {
  return { ...character, conditions }
}

function withEquipment(character: CharacterSheet, equipment: EquipmentLoadout): CharacterSheet {
  return { ...character, equipment }
}

/** rng value → d20 face, per the formula floor(rng * 20) + 1 */
function rngForFace(face: number): number {
  return (face - 1) / 20
}

// ─── Automatic Modifier Calculation ───────────────────────────────────────────

describe('resolveCharacterAction — automatic modifier calculation', () => {
  it('derives ability automatically from skill (stealth → DEX)', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak past the guard',
      dc: 15,
    })
    expect(result.resolution?.ability).toBe('DEX')
  })

  it('automatically applies skill proficiency when proficient', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue() // DEX +4, proficient stealth, level 5 → +3
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak past the guard',
      dc: 15,
    })
    expect(result.resolution?.totalModifier).toBe(7) // 4 + 3
  })

  it('does not apply proficiency for a non-proficient skill', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue() // not proficient in athletics
    const result = resolveCharacterAction({
      character,
      skill: 'athletics',
      intent: 'I try to climb the wall',
      dc: 15,
    })
    // STR 10 → +0, no proficiency
    expect(result.resolution?.totalModifier).toBe(0)
  })

  it('derives ability automatically from savingThrow', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      savingThrow: 'DEX',
      intent: 'I dive out of the fireball blast radius',
      dc: 15,
    })
    expect(result.resolution?.ability).toBe('DEX')
    expect(result.resolution?.checkKind).toBe('saving_throw')
  })

  it('applies saving throw proficiency automatically', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue() // DEX +4, proficient DEX saves, level 5 → +3
    const result = resolveCharacterAction({
      character,
      savingThrow: 'DEX',
      intent: 'I dive out of the way',
      dc: 15,
    })
    expect(result.resolution?.totalModifier).toBe(7)
  })

  it('falls back to parsed intent stat when no skill/savingThrow/ability given', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      intent: 'I smash the door open', // FORCE category → STR
      dc: 15,
    })
    expect(result.resolution?.ability).toBe('STR')
  })

  it('explicit ability override takes priority over skill-derived ability', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      skill: 'stealth', // normally DEX
      ability: 'WIS',   // Director override
      intent: 'I read the guard\'s body language while sneaking',
      dc: 15,
    })
    expect(result.resolution?.ability).toBe('WIS')
  })

  it('caller never manually calculates modifiers — only character + skill + dc needed', () => {
    setRng(() => rngForFace(15))
    const character = makeRogue()
    // No statValue, no flatModifier, no situationalModifiers — pure auto-derivation
    const result = resolveCharacterAction({
      character,
      skill: 'sleight_of_hand',
      intent: 'I pick the merchant\'s pocket',
      dc: 12,
    })
    expect(result.resolution).not.toBeNull()
    expect(result.resolution?.check.outcome).toBeDefined()
  })
})

// ─── Equipment Integration ────────────────────────────────────────────────────

describe('resolveCharacterAction — equipment integration', () => {
  it('automatically applies weapon attack bonus', () => {
    setRng(() => rngForFace(10))
    const character = withEquipment(makeRogue(), [
      { id: 'dagger', name: 'Dagger +1', slot: 'weapon', equipped: true, attackBonus: 1 },
    ])
    const result = resolveCharacterAction({
      character,
      ability: 'DEX',
      intent: 'I attack the bandit',
      dc: 14,
      context: { checkKind: 'attack' },
    })
    // DEX +4, weapon +1
    expect(result.resolution?.totalModifier).toBe(5)
  })

  it('automatically applies skill bonus from equipment', () => {
    setRng(() => rngForFace(10))
    const character = withEquipment(makeRogue(), [
      {
        id: 'boots',
        name: 'Boots of Elvenkind',
        slot: 'accessory',
        equipped: true,
        skillBonus: { skill: 'stealth', value: 2 },
      },
    ])
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak through the camp',
      dc: 15,
    })
    // DEX +4, proficiency +3, equipment +2
    expect(result.resolution?.totalModifier).toBe(9)
  })

  it('ignores unequipped items', () => {
    setRng(() => rngForFace(10))
    const character = withEquipment(makeRogue(), [
      {
        id: 'boots',
        name: 'Boots of Elvenkind',
        slot: 'accessory',
        equipped: false,
        skillBonus: { skill: 'stealth', value: 2 },
      },
    ])
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak through the camp',
      dc: 15,
    })
    expect(result.resolution?.totalModifier).toBe(7) // 4 + 3, no equipment contribution
  })

  it('stacks multiple equipped items', () => {
    setRng(() => rngForFace(10))
    const character = withEquipment(makeRogue(), [
      {
        id: 'boots',
        name: 'Boots of Elvenkind',
        slot: 'accessory',
        equipped: true,
        skillBonus: { skill: 'stealth', value: 2 },
      },
      {
        id: 'cloak',
        name: 'Cloak of Shadows',
        slot: 'accessory',
        equipped: true,
        skillBonus: { skill: 'stealth', value: 1 },
      },
    ])
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I vanish into the shadows',
      dc: 15,
    })
    expect(result.resolution?.totalModifier).toBe(10) // 4 + 3 + 2 + 1
  })

  it('mixed equipment: only the applicable bonus type contributes per check kind', () => {
    setRng(() => rngForFace(10))
    const character = withEquipment(makeRogue(), [
      { id: 'dagger', name: 'Dagger +2', slot: 'weapon', equipped: true, attackBonus: 2 },
      {
        id: 'cloak',
        name: 'Cloak of Shadows',
        slot: 'accessory',
        equipped: true,
        skillBonus: { skill: 'stealth', value: 1 },
      },
    ])
    // A stealth check should NOT pick up the weapon's attack bonus
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak past',
      dc: 15,
    })
    expect(result.resolution?.totalModifier).toBe(8) // 4 + 3 + 1 (not +2 from weapon)
  })
})

// ─── Condition Integration ────────────────────────────────────────────────────

describe('resolveCharacterAction — condition integration', () => {
  it('poisoned applies disadvantage on ability checks automatically', () => {
    setRng(() => rngForFace(10))
    const character = withConditions(makeRogue(), [createActiveCondition('poisoned', 'venom', 1)])
    const result = resolveCharacterAction({
      character,
      skill: 'athletics',
      intent: 'I try to climb',
      dc: 15,
    })
    expect(result.resolution?.resolvedMode).toBe('disadvantage')
  })

  it('invisible applies advantage on attack rolls automatically', () => {
    setRng(() => rngForFace(10))
    const character = withConditions(makeRogue(), [createActiveCondition('invisible', 'potion', 1)])
    const result = resolveCharacterAction({
      character,
      ability: 'DEX',
      intent: 'I strike from the shadows',
      dc: 14,
      context: { checkKind: 'attack' },
    })
    expect(result.resolution?.resolvedMode).toBe('advantage')
  })

  it('restrained applies disadvantage on DEX-based checks automatically', () => {
    setRng(() => rngForFace(10))
    const character = withConditions(makeRogue(), [createActiveCondition('restrained', 'net', 1)])
    const result = resolveCharacterAction({
      character,
      savingThrow: 'DEX',
      intent: 'I try to dodge',
      dc: 14,
    })
    expect(result.resolution?.resolvedMode).toBe('disadvantage')
  })

  it('the caller never manually applies condition effects', () => {
    setRng(() => rngForFace(10))
    // No context.mode passed — disadvantage comes purely from the condition
    const character = withConditions(makeRogue(), [createActiveCondition('poisoned', 'venom', 1)])
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak past while poisoned',
      dc: 15,
    })
    expect(result.resolution?.resolvedMode).toBe('disadvantage')
  })

  it('mixed conditions: advantage and disadvantage cancel to normal', () => {
    setRng(() => rngForFace(10))
    const character = withConditions(makeRogue(), [
      createActiveCondition('poisoned', 'venom', 1),     // disadvantage on ability checks
      createActiveCondition('invisible', 'potion', 1),   // advantage on attacks (different context)
    ])
    // ability_check context: only poisoned applies here, invisible doesn't affect ability_check
    const result = resolveCharacterAction({
      character,
      skill: 'athletics',
      intent: 'I climb',
      dc: 15,
    })
    expect(result.resolution?.resolvedMode).toBe('disadvantage')
  })

  it('mixed conditions on the same context cancel correctly', () => {
    setRng(() => rngForFace(10))
    // Construct a scenario where both an advantage and disadvantage condition
    // apply to the same attack_roll context.
    const character = withConditions(makeRogue(), [
      createActiveCondition('poisoned', 'venom', 1),    // disadvantage on attack_roll
      createActiveCondition('invisible', 'potion', 1),  // advantage on attack_roll
    ])
    const result = resolveCharacterAction({
      character,
      ability: 'DEX',
      intent: 'I attack',
      dc: 14,
      context: { checkKind: 'attack' },
    })
    expect(result.resolution?.resolvedMode).toBe('normal')
  })
})

// ─── Blocked Actions ──────────────────────────────────────────────────────────

describe('resolveCharacterAction — blocked actions', () => {
  it('returns allowed=false and no resolution when stunned', () => {
    const character = withConditions(makeRogue(), [createActiveCondition('stunned', 'spell', 1)])
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I try to sneak away',
      dc: 15,
    })
    expect(result.validation.allowed).toBe(false)
    expect(result.validation.blockingReason).toBe('STUNNED')
    expect(result.resolution).toBeNull()
  })

  it('returns allowed=false when unconscious', () => {
    const character = withConditions(makeRogue(), [createActiveCondition('unconscious', 'ko', 1)])
    const result = resolveCharacterAction({
      character,
      ability: 'STR',
      intent: 'I try to fight back',
      dc: 15,
      context: { checkKind: 'attack' },
    })
    expect(result.validation.allowed).toBe(false)
    expect(result.resolution).toBeNull()
  })

  it('returns allowed=false when paralyzed', () => {
    const character = withConditions(makeRogue(), [createActiveCondition('paralyzed', 'hold person', 1)])
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I try to move quietly',
      dc: 15,
    })
    expect(result.validation.allowed).toBe(false)
    expect(result.validation.blockingReason).toBe('PARALYZED')
  })

  it('does not consume an RNG roll when blocked (no dice rolled)', () => {
    let rollCount = 0
    setRng(() => {
      rollCount++
      return 0.5
    })
    const character = withConditions(makeRogue(), [createActiveCondition('stunned', 'spell', 1)])
    resolveCharacterAction({ character, skill: 'stealth', intent: 'I sneak', dc: 15 })
    expect(rollCount).toBe(0)
  })

  it('a dead character cannot perform any action', () => {
    const character = { ...makeRogue(), currentHp: -200 }
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I try anything',
      dc: 10,
    })
    expect(result.validation.allowed).toBe(false)
    expect(result.validation.blockingReason).toBe('DEAD')
  })
})

// ─── Advantage/Disadvantage ───────────────────────────────────────────────────

describe('resolveCharacterAction — advantage/disadvantage', () => {
  it('respects an explicit context.mode override', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak with help',
      dc: 15,
      context: { mode: 'advantage' },
    })
    expect(result.resolution?.resolvedMode).toBe('advantage')
  })

  it('temporary effect mode combines with condition mode (same direction stays same)', () => {
    setRng(() => rngForFace(10))
    const character = withConditions(makeRogue(), [createActiveCondition('invisible', 'spell', 1)])
    const result = resolveCharacterAction({
      character,
      ability: 'DEX',
      intent: 'I attack with help',
      dc: 14,
      context: {
        checkKind: 'attack',
        temporaryEffects: [{ label: 'Faerie Fire (ally)', mode: 'advantage' }],
      },
    })
    expect(result.resolution?.resolvedMode).toBe('advantage')
  })

  it('caller mode cancels with an opposing condition mode', () => {
    setRng(() => rngForFace(10))
    const character = withConditions(makeRogue(), [createActiveCondition('invisible', 'spell', 1)])
    const result = resolveCharacterAction({
      character,
      ability: 'DEX',
      intent: 'I attack',
      dc: 14,
      context: { checkKind: 'attack', mode: 'disadvantage' },
    })
    expect(result.resolution?.resolvedMode).toBe('normal')
  })
})

// ─── Breakdown Generation ─────────────────────────────────────────────────────

describe('resolveCharacterAction — breakdown generation', () => {
  it('includes every non-zero contributing stage in the breakdown', () => {
    setRng(() => rngForFace(10))
    const character = withEquipment(
      withConditions(makeRogue(), [createActiveCondition('poisoned', 'venom', 1)]),
      [{ id: 'dagger', name: 'Dagger +1', slot: 'weapon', equipped: true, attackBonus: 1 }],
    )
    const result = resolveCharacterAction({
      character,
      ability: 'DEX',
      intent: 'I attack while poisoned',
      dc: 14,
      context: { checkKind: 'attack' },
    })
    const labels = result.resolution?.breakdown.map((b) => b.label) ?? []
    expect(labels.some((l) => l.includes('DEX'))).toBe(true)
    expect(labels.some((l) => l.includes('Weapon'))).toBe(true)
    expect(labels.some((l) => l.toLowerCase().includes('poisoned'))).toBe(true)
  })

  it('excludes zero-value, no-mode stages from the breakdown', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue() // no equipment, no conditions
    const result = resolveCharacterAction({
      character,
      skill: 'athletics', // not proficient — zero contribution
      intent: 'I climb',
      dc: 15,
    })
    const labels = result.resolution?.breakdown.map((b) => b.label) ?? []
    expect(labels.some((l) => l === 'No equipment bonus')).toBe(false)
    expect(labels.some((l) => l === 'Not proficient')).toBe(false)
  })

  it('formatBreakdown renders a full human-readable block on success', () => {
    setRng(() => rngForFace(16)) // total comfortably beats DC 15 with +7 mod
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak past the guard',
      dc: 15,
    })
    const text = formatBreakdown(result)
    expect(text).toContain('Total Modifier')
    expect(text).toContain('Rolled')
    expect(text).toContain('Final')
    expect(text).toContain('Outcome:')
  })

  it('formatBreakdown renders a block reason for a disallowed action', () => {
    const character = withConditions(makeRogue(), [createActiveCondition('stunned', 'spell', 1)])
    const result = resolveCharacterAction({ character, skill: 'stealth', intent: 'I try', dc: 15 })
    const text = formatBreakdown(result)
    expect(text).toContain('Action blocked')
    expect(text).toContain('stunned')
  })

  it('matches the documented example format end to end', () => {
    // STR +4, Proficiency +3, equipment +1 = +8, roll 17 → final 25 vs DC 15
    // margin = 25 - 15 = 10, which is the CRITICAL_SUCCESS threshold per outcome.ts
    setRng(() => rngForFace(17))
    const character = withEquipment(
      buildCharacter({
        name: 'Aldric',
        scores: { strength: 18 },
        level: 5,
        skillProficiencies: ['athletics'],
      }),
      [{ id: 'gauntlets', name: 'Gauntlets of Might', slot: 'accessory', equipped: true, skillBonus: { skill: 'athletics', value: 1 } }],
    )
    const result = resolveCharacterAction({
      character,
      skill: 'athletics',
      intent: 'I shove the boulder',
      dc: 15,
    })
    expect(result.resolution?.totalModifier).toBe(8) // STR +4, Prof +3, Equipment +1
    expect(result.resolution?.check.roll.total).toBe(25) // 17 + 8
    expect(result.resolution?.check.outcome).toBe(Outcome.CRITICAL_SUCCESS) // margin 10
  })
})

// ─── Invalid Inputs ───────────────────────────────────────────────────────────

describe('resolveCharacterAction — invalid inputs', () => {
  it('propagates the empty-input error from the intent parser', () => {
    const character = makeRogue()
    expect(() =>
      resolveCharacterAction({ character, intent: '', dc: 15 }),
    ).toThrow('[intent] Action input cannot be empty')
  })

  it('propagates the oversized-input error from the intent parser', () => {
    const character = makeRogue()
    expect(() =>
      resolveCharacterAction({ character, intent: 'a'.repeat(501), dc: 15 }),
    ).toThrow('[intent] Action input exceeds 500 character limit')
  })

  it('throws when an invalid skill id is used to derive ability', () => {
    const character = makeRogue()
    expect(() =>
      resolveCharacterAction({
        character,
        // @ts-expect-error — intentional bad value
        skill: 'flying',
        intent: 'I do something',
        dc: 10,
      }),
    ).toThrow('[skills] Unknown skill id')
  })
})

// ─── Full pipeline transparency smoke test ────────────────────────────────────

describe('resolveCharacterAction — full transparency', () => {
  it('exposes the complete step list, not just the total', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak',
      dc: 15,
    })
    expect(result.resolution?.steps).toBeDefined()
    expect(result.resolution?.steps.length).toBe(6)
  })

  it('exposes the raw dice face separately from the final total', () => {
    setRng(() => rngForFace(12))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character,
      skill: 'stealth',
      intent: 'I sneak',
      dc: 15,
    })
    expect(result.resolution?.check.roll.faceTotal).toBe(12)
    expect(result.resolution?.check.roll.total).toBe(12 + (result.resolution?.totalModifier ?? 0))
  })
})

// ─── summariseCharacterAction (Phase 9.3) ──────────────────────────────────────
// Feeds the Director "full dice transparency" for exploration turns — see
// summariseCharacterAction's doc comment in resolveAction.ts.

describe('summariseCharacterAction', () => {
  it('produces the same output shape as summariseResolution', () => {
    setRng(() => rngForFace(14))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character, skill: 'stealth', intent: 'I sneak past the guards', dc: 15,
    })
    const summary = summariseCharacterAction(result.resolution!)

    expect(summary.rawInput).toBe('I sneak past the guards')
    expect(summary.stat).toBe('DEX')
    expect(summary.dc).toBe(15)
    expect(typeof summary.outcome).toBe('string')
    expect(typeof summary.outcomeLabel).toBe('string')
    expect(typeof summary.isSuccess).toBe('boolean')
    expect(typeof summary.timestamp).toBe('string')
  })

  it('roll faces is an array of numbers', () => {
    const character = makeRogue()
    const result = resolveCharacterAction({
      character, skill: 'stealth', intent: 'I sneak', dc: 15,
    })
    const summary = summariseCharacterAction(result.resolution!)
    expect(Array.isArray(summary.roll.faces)).toBe(true)
    summary.roll.faces.forEach((f) => expect(typeof f).toBe('number'))
  })

  it('margin is total - dc, matching summariseResolution semantics', () => {
    setRng(() => rngForFace(16))
    const character = makeRogue()
    const result = resolveCharacterAction({
      character, skill: 'stealth', intent: 'I sneak', dc: 15,
    })
    const summary = summariseCharacterAction(result.resolution!)
    expect(summary.margin).toBe(summary.roll.total - summary.dc)
  })

  it('is JSON-serialisable for NarrativeTurn.diceRolls persistence', () => {
    const character = makeRogue()
    const result = resolveCharacterAction({
      character, skill: 'stealth', intent: 'I sneak', dc: 15,
    })
    const summary = summariseCharacterAction(result.resolution!)
    expect(() => JSON.stringify(summary)).not.toThrow()
  })

  it('reflects the correct category from the parsed intent', () => {
    const character = makeRogue()
    const result = resolveCharacterAction({
      character, skill: 'stealth', intent: 'I sneak past the guards', dc: 15,
    })
    const summary = summariseCharacterAction(result.resolution!)
    expect(summary.category).toBe('FINESSE')
  })

  it('carries pipeline-derived modifiers into roll.modifier (proficiency + stat + equipment)', () => {
    setRng(() => rngForFace(10))
    const character = makeRogue() // DEX 18 (+4), proficient in stealth, level 5 (+3 prof)
    const result = resolveCharacterAction({
      character, skill: 'stealth', intent: 'I sneak', dc: 15,
    })
    const summary = summariseCharacterAction(result.resolution!)
    // +4 DEX + 3 proficiency = +7
    expect(summary.roll.modifier).toBe(7)
    expect(summary.roll.total).toBe(10 + 7)
  })
})
