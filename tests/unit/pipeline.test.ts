/**
 * Chronicle AI — Resolver Pipeline Tests
 * Phase 1.6
 *
 * Per the spec: "Every stage must be individually testable." Each of the
 * 8 stages owned by pipeline.ts gets its own describe block, isolated from
 * the others, before the full pipeline integration tests at the bottom.
 */

import { describe, it, expect } from 'vitest'
import { buildCharacter } from '@/lib/engine/character'
import { createActiveCondition } from '@/lib/engine/conditions'
import {
  stageBaseAbility,
  stageSkillProficiency,
  stageSavingThrowProficiency,
  stageEquipment,
  stageConditions,
  stageTemporaryEffects,
  resolveAdvantageDisadvantage,
  calculateFinalModifier,
  isCharacterIncapacitated,
  checkKindToRollContext,
  runPipeline,
  formatSigned,
} from '@/lib/engine/pipeline'
import type { PipelineStep } from '@/lib/engine/pipeline'
import type { EquipmentLoadout } from '@/lib/engine/equipment'

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makeFighter() {
  return buildCharacter({
    name: 'Aldric',
    archetype: 'fighter',
    level: 5, // proficiency +3
    scores: { strength: 16, dexterity: 14, constitution: 14, wisdom: 12, charisma: 8 },
    skillProficiencies: ['athletics'],
    savingThrowProficiencies: ['STR', 'CON'],
  })
}

// ─── Stage 1: Base Ability ────────────────────────────────────────────────────

describe('stageBaseAbility', () => {
  it('returns the correct modifier for STR', () => {
    const character = makeFighter()
    const step = stageBaseAbility(character, 'STR')
    expect(step.stage).toBe('base_ability')
    expect(step.value).toBe(3) // STR 16 → +3
    expect(step.label).toBe('STR +3')
  })

  it('returns the correct modifier for DEX', () => {
    const character = makeFighter()
    expect(stageBaseAbility(character, 'DEX').value).toBe(2) // DEX 14 → +2
  })

  it('formats negative modifiers correctly', () => {
    const character = makeFighter()
    expect(stageBaseAbility(character, 'CHA').label).toBe('CHA -1') // CHA 8 → -1
  })

  it('formats zero modifiers with a leading plus', () => {
    const character = buildCharacter({ scores: { intelligence: 10 } })
    expect(stageBaseAbility(character, 'INT').label).toBe('INT +0')
  })
})

// ─── Stage 2: Skill Proficiency ───────────────────────────────────────────────

describe('stageSkillProficiency', () => {
  it('returns zero when checkKind is not skill', () => {
    const character = makeFighter()
    const step = stageSkillProficiency(character, 'attack', 'athletics')
    expect(step.value).toBe(0)
  })

  it('returns zero when no skill is specified', () => {
    const character = makeFighter()
    const step = stageSkillProficiency(character, 'skill', undefined)
    expect(step.value).toBe(0)
  })

  it('returns zero when character lacks the proficiency', () => {
    const character = makeFighter()
    const step = stageSkillProficiency(character, 'skill', 'stealth')
    expect(step.value).toBe(0)
    expect(step.label).toBe('Not proficient')
  })

  it('returns proficiency bonus when character has the proficiency', () => {
    const character = makeFighter() // proficient in athletics, level 5 → +3
    const step = stageSkillProficiency(character, 'skill', 'athletics')
    expect(step.value).toBe(3)
    expect(step.label).toBe('Proficiency +3')
  })

  it('scales with character level/proficiency bonus', () => {
    const lowLevel = buildCharacter({ level: 1, skillProficiencies: ['stealth'] })
    const highLevel = buildCharacter({ level: 17, skillProficiencies: ['stealth'] })
    expect(stageSkillProficiency(lowLevel, 'skill', 'stealth').value).toBe(2)
    expect(stageSkillProficiency(highLevel, 'skill', 'stealth').value).toBe(6)
  })
})

// ─── Stage 3: Saving Throw Proficiency ────────────────────────────────────────

describe('stageSavingThrowProficiency', () => {
  it('returns zero when checkKind is not saving_throw', () => {
    const character = makeFighter()
    const step = stageSavingThrowProficiency(character, 'skill', 'STR')
    expect(step.value).toBe(0)
  })

  it('returns zero when character lacks the save proficiency', () => {
    const character = makeFighter() // proficient in STR, CON saves only
    const step = stageSavingThrowProficiency(character, 'saving_throw', 'WIS')
    expect(step.value).toBe(0)
    expect(step.label).toBe('Not proficient')
  })

  it('returns proficiency bonus when character has the save proficiency', () => {
    const character = makeFighter() // level 5 → +3, proficient in CON
    const step = stageSavingThrowProficiency(character, 'saving_throw', 'CON')
    expect(step.value).toBe(3)
    expect(step.label).toBe('Save Proficiency +3')
  })
})

// ─── Stage 4: Equipment ───────────────────────────────────────────────────────

describe('stageEquipment', () => {
  it('returns zero for a character with no equipment', () => {
    const character = makeFighter()
    const step = stageEquipment(character, 'attack', 'STR', undefined)
    expect(step.value).toBe(0)
    expect(step.label).toBe('No equipment bonus')
  })

  it('returns attack bonus for attack checks', () => {
    const equipment: EquipmentLoadout = [
      { id: 'sword', name: 'Longsword +1', slot: 'weapon', equipped: true, attackBonus: 1 },
    ]
    const character = { ...makeFighter(), equipment }
    const step = stageEquipment(character, 'attack', 'STR', undefined)
    expect(step.value).toBe(1)
    expect(step.label).toBe('Weapon +1')
  })

  it('returns skill bonus for skill checks', () => {
    const equipment: EquipmentLoadout = [
      {
        id: 'cloak',
        name: 'Cloak of Elvenkind',
        slot: 'accessory',
        equipped: true,
        skillBonus: { skill: 'stealth', value: 2 },
      },
    ]
    const character = { ...makeFighter(), equipment }
    const step = stageEquipment(character, 'skill', 'DEX', 'stealth')
    expect(step.value).toBe(2)
    expect(step.label).toBe('Equipment +2')
  })

  it('returns save bonus for saving throws', () => {
    const equipment: EquipmentLoadout = [
      {
        id: 'ring',
        name: 'Ring of Protection',
        slot: 'accessory',
        equipped: true,
        saveBonus: { ability: 'WIS', value: 1 },
      },
    ]
    const character = { ...makeFighter(), equipment }
    const step = stageEquipment(character, 'saving_throw', 'WIS', undefined)
    expect(step.value).toBe(1)
  })

  it('does not apply attack bonus to a skill check', () => {
    const equipment: EquipmentLoadout = [
      { id: 'sword', name: 'Longsword +1', slot: 'weapon', equipped: true, attackBonus: 5 },
    ]
    const character = { ...makeFighter(), equipment }
    const step = stageEquipment(character, 'skill', 'STR', 'athletics')
    expect(step.value).toBe(0)
  })
})

// ─── Stage 5: Conditions ──────────────────────────────────────────────────────

describe('stageConditions', () => {
  it('returns zero when no conditions are active', () => {
    const character = makeFighter()
    const step = stageConditions(character, 'attack_roll')
    expect(step.value).toBe(0)
    expect(step.mode).toBeUndefined()
  })

  it('applies disadvantage from poisoned on attack_roll', () => {
    const base = makeFighter()
    const character = {
      ...base,
      conditions: [createActiveCondition('poisoned', 'spider bite', 1)],
    }
    const step = stageConditions(character, 'attack_roll')
    expect(step.mode).toBe('disadvantage')
  })

  it('applies advantage from invisible on attack_roll', () => {
    const base = makeFighter()
    const character = {
      ...base,
      conditions: [createActiveCondition('invisible', 'invisibility spell', 1)],
    }
    const step = stageConditions(character, 'attack_roll')
    expect(step.mode).toBe('advantage')
  })

  it('applies disadvantage from restrained context-sensitively', () => {
    const base = makeFighter()
    const character = {
      ...base,
      conditions: [createActiveCondition('restrained', 'net', 1)],
    }
    // Restrained gives disadvantage on attack_roll and saving_throw (DEX), per conditions.ts
    expect(stageConditions(character, 'attack_roll').mode).toBe('disadvantage')
  })

  it('reflects condition reason text in the label', () => {
    const base = makeFighter()
    const character = {
      ...base,
      conditions: [createActiveCondition('poisoned', 'spider bite', 1)],
    }
    const step = stageConditions(character, 'attack_roll')
    expect(step.label).toContain('Poisoned')
  })

  it('cancels advantage and disadvantage when both present', () => {
    const base = makeFighter()
    const character = {
      ...base,
      conditions: [
        createActiveCondition('poisoned', 'venom', 1),   // disadvantage on attack
        createActiveCondition('invisible', 'spell', 1),  // advantage on attack
      ],
    }
    const step = stageConditions(character, 'attack_roll')
    expect(step.mode).toBeUndefined()
  })
})

describe('checkKindToRollContext', () => {
  it('maps attack to attack_roll', () => {
    expect(checkKindToRollContext('attack')).toBe('attack_roll')
  })
  it('maps saving_throw to saving_throw', () => {
    expect(checkKindToRollContext('saving_throw')).toBe('saving_throw')
  })
  it('maps skill to ability_check', () => {
    expect(checkKindToRollContext('skill')).toBe('ability_check')
  })
  it('maps raw_ability to ability_check', () => {
    expect(checkKindToRollContext('raw_ability')).toBe('ability_check')
  })
})

// ─── Stage 6: Temporary Effects ───────────────────────────────────────────────

describe('stageTemporaryEffects', () => {
  it('returns zero for no effects', () => {
    const step = stageTemporaryEffects()
    expect(step.value).toBe(0)
    expect(step.label).toBe('No temporary effects')
  })

  it('returns zero for an empty array', () => {
    expect(stageTemporaryEffects([]).value).toBe(0)
  })

  it('sums numeric value contributions', () => {
    const step = stageTemporaryEffects([{ label: 'Bless', value: 3 }])
    expect(step.value).toBe(3)
    expect(step.label).toBe('Bless')
  })

  it('stacks multiple temporary effects', () => {
    const step = stageTemporaryEffects([
      { label: 'Bless', value: 3 },
      { label: 'Guidance', value: 2 },
    ])
    expect(step.value).toBe(5)
    expect(step.label).toBe('Bless; Guidance')
  })

  it('surfaces a mode override from a temporary effect', () => {
    const step = stageTemporaryEffects([{ label: 'Faerie Fire', mode: 'advantage' }])
    expect(step.mode).toBe('advantage')
  })

  it('treats an effect with no value as zero contribution', () => {
    const step = stageTemporaryEffects([{ label: 'Minor blessing' }])
    expect(step.value).toBe(0)
  })
})

// ─── Stage 7: Advantage/Disadvantage Resolution ───────────────────────────────

describe('resolveAdvantageDisadvantage', () => {
  const stepWithMode = (mode: 'advantage' | 'disadvantage' | undefined): PipelineStep => ({
    stage: 'conditions',
    label: 'test',
    value: 0,
    mode,
  })

  it('returns normal when no steps carry a mode', () => {
    expect(resolveAdvantageDisadvantage([stepWithMode(undefined)])).toBe('normal')
  })

  it('returns advantage when one step carries advantage', () => {
    expect(resolveAdvantageDisadvantage([stepWithMode('advantage')])).toBe('advantage')
  })

  it('returns disadvantage when one step carries disadvantage', () => {
    expect(resolveAdvantageDisadvantage([stepWithMode('disadvantage')])).toBe('disadvantage')
  })

  it('cancels to normal when both advantage and disadvantage are present', () => {
    const result = resolveAdvantageDisadvantage([
      stepWithMode('advantage'),
      stepWithMode('disadvantage'),
    ])
    expect(result).toBe('normal')
  })

  it('multiple advantage sources do not compound — still just advantage', () => {
    const result = resolveAdvantageDisadvantage([
      stepWithMode('advantage'),
      stepWithMode('advantage'),
    ])
    expect(result).toBe('advantage')
  })

  it('caller-supplied mode is included in resolution', () => {
    expect(resolveAdvantageDisadvantage([], 'advantage')).toBe('advantage')
  })

  it('caller mode cancels with an opposing step mode', () => {
    const result = resolveAdvantageDisadvantage([stepWithMode('advantage')], 'disadvantage')
    expect(result).toBe('normal')
  })
})

// ─── Stage 8: Final Modifier ───────────────────────────────────────────────────

describe('calculateFinalModifier', () => {
  it('returns 0 for empty steps', () => {
    expect(calculateFinalModifier([])).toBe(0)
  })

  it('sums all step values', () => {
    const steps: PipelineStep[] = [
      { stage: 'base_ability', label: 'STR +4', value: 4 },
      { stage: 'skill_proficiency', label: 'Proficiency +3', value: 3 },
      { stage: 'equipment', label: 'Weapon +1', value: 1 },
    ]
    expect(calculateFinalModifier(steps)).toBe(8)
  })

  it('correctly sums negative contributions', () => {
    const steps: PipelineStep[] = [
      { stage: 'base_ability', label: 'CHA -1', value: -1 },
      { stage: 'conditions', label: 'cursed', value: -2 },
    ]
    expect(calculateFinalModifier(steps)).toBe(-3)
  })
})

// ─── isCharacterIncapacitated ─────────────────────────────────────────────────

describe('isCharacterIncapacitated', () => {
  it('returns false for a healthy character', () => {
    expect(isCharacterIncapacitated(makeFighter())).toBe(false)
  })

  it('returns true when stunned', () => {
    const base = makeFighter()
    const character = { ...base, conditions: [createActiveCondition('stunned', 'spell', 1)] }
    expect(isCharacterIncapacitated(character)).toBe(true)
  })
})

// ─── formatSigned ─────────────────────────────────────────────────────────────

describe('formatSigned', () => {
  it('formats positive numbers with a leading plus', () => {
    expect(formatSigned(4)).toBe('+4')
  })
  it('formats zero with a leading plus', () => {
    expect(formatSigned(0)).toBe('+0')
  })
  it('formats negative numbers with a leading minus (no double sign)', () => {
    expect(formatSigned(-3)).toBe('-3')
  })
})

// ─── Full Pipeline Integration ────────────────────────────────────────────────

describe('runPipeline — full integration', () => {
  it('produces 6 steps in the documented order', () => {
    const character = makeFighter()
    const result = runPipeline({ character, ability: 'STR', checkKind: 'skill', skill: 'athletics' })
    expect(result.steps.map((s) => s.stage)).toEqual([
      'base_ability',
      'skill_proficiency',
      'saving_throw_proficiency',
      'equipment',
      'conditions',
      'temporary_effects',
    ])
  })

  it('combines ability + proficiency for a proficient skill check', () => {
    const character = makeFighter() // STR +3, proficient athletics, level 5 → +3
    const result = runPipeline({ character, ability: 'STR', checkKind: 'skill', skill: 'athletics' })
    expect(result.totalModifier).toBe(6) // 3 + 3
  })

  it('combines ability + equipment + conditions for an attack roll', () => {
    const equipment: EquipmentLoadout = [
      { id: 'sword', name: 'Longsword +1', slot: 'weapon', equipped: true, attackBonus: 1 },
    ]
    const base = makeFighter()
    const character = {
      ...base,
      equipment,
      conditions: [createActiveCondition('poisoned', 'venom', 1)],
    }
    const result = runPipeline({ character, ability: 'STR', checkKind: 'attack' })
    // STR +3, equipment +1, poisoned disadvantage (no flat value)
    expect(result.totalModifier).toBe(4)
    expect(result.resolvedMode).toBe('disadvantage')
  })

  it('mixed conditions: advantage from invisible cancels disadvantage from poisoned', () => {
    const base = makeFighter()
    const character = {
      ...base,
      conditions: [
        createActiveCondition('poisoned', 'venom', 1),
        createActiveCondition('invisible', 'spell', 1),
      ],
    }
    const result = runPipeline({ character, ability: 'STR', checkKind: 'attack' })
    expect(result.resolvedMode).toBe('normal')
  })

  it('applies temporary effects on top of all other stages', () => {
    const character = makeFighter()
    const result = runPipeline({
      character,
      ability: 'STR',
      checkKind: 'attack',
      temporaryEffects: [{ label: 'Bless', value: 2 }],
    })
    expect(result.totalModifier).toBe(5) // STR +3 + Bless +2
  })

  it('respects an explicit caller mode override', () => {
    const character = makeFighter()
    const result = runPipeline(
      { character, ability: 'STR', checkKind: 'attack' },
      'advantage',
    )
    expect(result.resolvedMode).toBe('advantage')
  })
})
