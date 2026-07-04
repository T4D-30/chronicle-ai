/**
 * Chronicle AI — Skills Engine Tests
 * Phase 1.6
 */

import { describe, it, expect } from 'vitest'
import {
  SKILL_IDS,
  SKILL_ABILITY,
  SKILL_DISPLAY_NAME,
  isValidSkillId,
  getSkillAbility,
} from '@/lib/engine/skills'

describe('SKILL_IDS', () => {
  it('contains exactly 18 standard D&D skills', () => {
    expect(SKILL_IDS).toHaveLength(18)
  })

  it('includes all canonical skill names', () => {
    const expected = [
      'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception',
      'history', 'insight', 'intimidation', 'investigation', 'medicine',
      'nature', 'perception', 'performance', 'persuasion', 'religion',
      'sleight_of_hand', 'stealth', 'survival',
    ]
    for (const id of expected) {
      expect(SKILL_IDS).toContain(id)
    }
  })

  it('has no duplicate entries', () => {
    expect(new Set(SKILL_IDS).size).toBe(SKILL_IDS.length)
  })
})

describe('SKILL_ABILITY', () => {
  it('has an entry for every skill', () => {
    for (const id of SKILL_IDS) {
      expect(SKILL_ABILITY[id]).toBeDefined()
    }
  })

  it('maps STR skills correctly', () => {
    expect(SKILL_ABILITY.athletics).toBe('STR')
  })

  it('maps DEX skills correctly', () => {
    expect(SKILL_ABILITY.acrobatics).toBe('DEX')
    expect(SKILL_ABILITY.sleight_of_hand).toBe('DEX')
    expect(SKILL_ABILITY.stealth).toBe('DEX')
  })

  it('maps INT skills correctly', () => {
    expect(SKILL_ABILITY.arcana).toBe('INT')
    expect(SKILL_ABILITY.history).toBe('INT')
    expect(SKILL_ABILITY.investigation).toBe('INT')
    expect(SKILL_ABILITY.nature).toBe('INT')
    expect(SKILL_ABILITY.religion).toBe('INT')
  })

  it('maps WIS skills correctly', () => {
    expect(SKILL_ABILITY.animal_handling).toBe('WIS')
    expect(SKILL_ABILITY.insight).toBe('WIS')
    expect(SKILL_ABILITY.medicine).toBe('WIS')
    expect(SKILL_ABILITY.perception).toBe('WIS')
    expect(SKILL_ABILITY.survival).toBe('WIS')
  })

  it('maps CHA skills correctly', () => {
    expect(SKILL_ABILITY.deception).toBe('CHA')
    expect(SKILL_ABILITY.intimidation).toBe('CHA')
    expect(SKILL_ABILITY.performance).toBe('CHA')
    expect(SKILL_ABILITY.persuasion).toBe('CHA')
  })

  it('every ability used is one of the six valid StatNames', () => {
    const validStats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
    for (const id of SKILL_IDS) {
      expect(validStats).toContain(SKILL_ABILITY[id])
    }
  })

  it('no skill maps to CON (no standard D&D skill uses Constitution)', () => {
    for (const id of SKILL_IDS) {
      expect(SKILL_ABILITY[id]).not.toBe('CON')
    }
  })
})

describe('SKILL_DISPLAY_NAME', () => {
  it('has a display name for every skill', () => {
    for (const id of SKILL_IDS) {
      expect(SKILL_DISPLAY_NAME[id]).toBeTruthy()
    }
  })

  it('formats multi-word skills with proper capitalisation', () => {
    expect(SKILL_DISPLAY_NAME.animal_handling).toBe('Animal Handling')
    expect(SKILL_DISPLAY_NAME.sleight_of_hand).toBe('Sleight of Hand')
  })

  it('formats single-word skills correctly', () => {
    expect(SKILL_DISPLAY_NAME.stealth).toBe('Stealth')
    expect(SKILL_DISPLAY_NAME.athletics).toBe('Athletics')
  })
})

describe('isValidSkillId', () => {
  it('returns true for every defined skill', () => {
    for (const id of SKILL_IDS) {
      expect(isValidSkillId(id)).toBe(true)
    }
  })

  it('returns false for unknown strings', () => {
    expect(isValidSkillId('flying')).toBe(false)
    expect(isValidSkillId('')).toBe(false)
    expect(isValidSkillId('ATHLETICS')).toBe(false)
  })
})

describe('getSkillAbility', () => {
  it('returns the correct ability for a valid skill', () => {
    expect(getSkillAbility('stealth')).toBe('DEX')
    expect(getSkillAbility('arcana')).toBe('INT')
  })

  it('throws for an unknown skill id', () => {
    // @ts-expect-error — intentional bad value
    expect(() => getSkillAbility('flying')).toThrow('[skills] Unknown skill id')
  })
})
