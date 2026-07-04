/**
 * Chronicle AI — useCharacterDraft Hook Tests
 * Volume II, Phase 2.1
 *
 * These are FORM VALIDATION tests, but every assertion traces back to an
 * engine function — isValidAbilityScore, validateAbilityScores,
 * isValidSkillId, validateEquipmentItem, buildCharacter(). The hook itself
 * contains zero hand-rolled validation rules; these tests confirm that
 * delegation is wired correctly, not that the rules themselves are correct
 * (the engine's own test suites already cover that).
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  useCharacterDraft,
  usePreviewSheet,
  createEmptyDraft,
  draftToCharacterInput,
  WIZARD_STEPS,
} from '@/components/character/useCharacterDraft'

describe('createEmptyDraft', () => {
  it('produces a draft with all ability scores at 10', () => {
    const draft = createEmptyDraft()
    expect(draft.scores.strength).toBe(10)
    expect(draft.scores.dexterity).toBe(10)
    expect(draft.scores.constitution).toBe(10)
    expect(draft.scores.intelligence).toBe(10)
    expect(draft.scores.wisdom).toBe(10)
    expect(draft.scores.charisma).toBe(10)
  })

  it('produces a draft with empty proficiencies and equipment', () => {
    const draft = createEmptyDraft()
    expect(draft.skillProficiencies).toEqual([])
    expect(draft.savingThrowProficiencies).toEqual([])
    expect(draft.equipment).toEqual([])
  })

  it('defaults portraitUrl to null and bio to empty string', () => {
    const draft = createEmptyDraft()
    expect(draft.portraitUrl).toBeNull()
    expect(draft.bio).toBe('')
  })

  it('defaults level to 1', () => {
    expect(createEmptyDraft().level).toBe(1)
  })
})

describe('draftToCharacterInput', () => {
  it('trims the name', () => {
    const draft = { ...createEmptyDraft(), name: '  Aldric  ' }
    expect(draftToCharacterInput(draft).name).toBe('Aldric')
  })

  it('carries over scores, proficiencies, and equipment', () => {
    const draft = {
      ...createEmptyDraft(),
      scores: { ...createEmptyDraft().scores, strength: 16 },
      skillProficiencies: ['stealth' as const],
      savingThrowProficiencies: ['DEX' as const],
    }
    const input = draftToCharacterInput(draft)
    expect(input.scores.strength).toBe(16)
    expect(input.skillProficiencies).toEqual(['stealth'])
    expect(input.savingThrowProficiencies).toEqual(['DEX'])
  })
})

describe('useCharacterDraft — navigation', () => {
  it('starts on the first step (identity)', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    expect(result.current.currentStep).toBe('identity')
    expect(result.current.stepIndex).toBe(0)
    expect(result.current.isFirstStep).toBe(true)
  })

  it('goNext() does not advance when the current step is invalid', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    // Default draft has name: '' — identity step is invalid
    act(() => {
      const advanced = result.current.goNext()
      expect(advanced).toBe(false)
    })
    expect(result.current.currentStep).toBe('identity')
  })

  it('goNext() advances when the current step is valid', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric' }))
    act(() => {
      const advanced = result.current.goNext()
      expect(advanced).toBe(true)
    })
    expect(result.current.currentStep).toBe('species')
  })

  it('goBack() moves to the previous step', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric' }))
    act(() => result.current.goNext())
    expect(result.current.currentStep).toBe('species')
    act(() => result.current.goBack())
    expect(result.current.currentStep).toBe('identity')
  })

  it('goBack() does nothing past the first step', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goBack())
    expect(result.current.currentStep).toBe('identity')
  })

  it('goToStep() jumps directly to a named step', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('abilities'))
    expect(result.current.currentStep).toBe('abilities')
  })

  it('isLastStep is true only on the review step', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    expect(result.current.isLastStep).toBe(false)
    act(() => result.current.goToStep('review'))
    expect(result.current.isLastStep).toBe(true)
  })

  it('reaches every step in WIZARD_STEPS via goToStep', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    for (const step of WIZARD_STEPS) {
      act(() => result.current.goToStep(step))
      expect(result.current.currentStep).toBe(step)
    }
  })
})

describe('useCharacterDraft — identity step validation', () => {
  it('rejects an empty name', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain('Name cannot be empty')
  })

  it('accepts a valid name', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric Sorn' }))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('rejects a name over 60 characters', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'A'.repeat(61) }))
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain('60 characters or fewer')
  })

  it('rejects an invalid level', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric', level: 21 }))
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain('Level must be')
  })

  it('accepts level 20 (upper bound)', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric', level: 20 }))
    expect(result.current.currentValidation.isValid).toBe(true)
  })
})

describe('useCharacterDraft — abilities step validation', () => {
  it('rejects an ability score of 0 (delegates to engine validateAbilityScores)', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('abilities'))
    act(() =>
      result.current.updateDraft({
        scores: { ...result.current.draft.scores, strength: 0 },
      }),
    )
    expect(result.current.currentValidation.isValid).toBe(false)
  })

  it('accepts the default all-10 scores', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('abilities'))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('rejects an ability score above 20', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('abilities'))
    act(() =>
      result.current.updateDraft({
        scores: { ...result.current.draft.scores, dexterity: 21 },
      }),
    )
    expect(result.current.currentValidation.isValid).toBe(false)
  })
})

describe('useCharacterDraft — skills step validation', () => {
  it('accepts a known skill id', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('skills'))
    act(() => result.current.updateDraft({ skillProficiencies: ['stealth'] }))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('rejects an unknown skill id', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('skills'))
    act(() =>
      // @ts-expect-error — intentional bad value to exercise the engine validator
      result.current.updateDraft({ skillProficiencies: ['flying'] }),
    )
    expect(result.current.currentValidation.isValid).toBe(false)
  })

  it('rejects an unknown saving throw ability', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('skills'))
    act(() =>
      // @ts-expect-error — intentional bad value
      result.current.updateDraft({ savingThrowProficiencies: ['LUCK'] }),
    )
    expect(result.current.currentValidation.isValid).toBe(false)
  })
})

describe('useCharacterDraft — equipment step validation', () => {
  it('accepts an empty equipment list', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('equipment'))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('rejects an equipment item with an empty name (delegates to validateEquipmentItem)', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('equipment'))
    act(() =>
      result.current.updateDraft({
        equipment: [{ id: 'x', name: '', slot: 'weapon', equipped: true }],
      }),
    )
    expect(result.current.currentValidation.isValid).toBe(false)
  })

  it('accepts a valid equipment item', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('equipment'))
    act(() =>
      result.current.updateDraft({
        equipment: [{ id: 'x', name: 'Sword', slot: 'weapon', equipped: true, attackBonus: 1 }],
      }),
    )
    expect(result.current.currentValidation.isValid).toBe(true)
  })
})

describe('useCharacterDraft — review step validation', () => {
  it('is invalid when the draft overall is invalid (empty name)', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.goToStep('review'))
    expect(result.current.currentValidation.isValid).toBe(false)
  })

  it('is valid for a complete, correct draft', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric Sorn' }))
    act(() => result.current.goToStep('review'))
    expect(result.current.currentValidation.isValid).toBe(true)
  })
})

describe('useCharacterDraft — validateAll', () => {
  it('returns one validation result per non-review step', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    const results = result.current.validateAll()
    expect(results).toHaveLength(WIZARD_STEPS.length - 1)
  })

  it('flags the identity step as invalid for an empty-name draft', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    const results = result.current.validateAll()
    const identityIndex = WIZARD_STEPS.filter((s) => s !== 'review').indexOf('identity')
    expect(results[identityIndex].isValid).toBe(false)
  })

  it('all steps pass for a fully valid draft', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1'))
    act(() => result.current.updateDraft({ name: 'Aldric Sorn' }))
    const results = result.current.validateAll()
    expect(results.every((r) => r.isValid)).toBe(true)
  })
})

describe('useCharacterDraft — initial overrides', () => {
  it('seeds the draft from the initial partial, useful for future edit-via-wizard flows', () => {
    const { result } = renderHook(() => useCharacterDraft('user-1', { name: 'Pre-filled', level: 5 }))
    expect(result.current.draft.name).toBe('Pre-filled')
    expect(result.current.draft.level).toBe(5)
  })
})

describe('usePreviewSheet', () => {
  it('returns null for an invalid draft (empty name)', () => {
    const { result } = renderHook(() => usePreviewSheet(createEmptyDraft()))
    expect(result.current).toBeNull()
  })

  it('returns a built CharacterSheet for a valid draft', () => {
    const draft = { ...createEmptyDraft(), name: 'Aldric' }
    const { result } = renderHook(() => usePreviewSheet(draft))
    expect(result.current).not.toBeNull()
    expect(result.current?.name).toBe('Aldric')
  })

  it('reflects live score changes in derived stats (maxHp)', () => {
    const draft = {
      ...createEmptyDraft(),
      name: 'Aldric',
      scores: { ...createEmptyDraft().scores, constitution: 16 },
    }
    const { result } = renderHook(() => usePreviewSheet(draft))
    // CON 16 → +3 mod should produce a higher maxHp than the all-10 baseline
    const baseline = createEmptyDraft()
    const { result: baselineResult } = renderHook(() =>
      usePreviewSheet({ ...baseline, name: 'Baseline' }),
    )
    expect(result.current!.maxHp).toBeGreaterThan(baselineResult.current!.maxHp)
  })
})
