/**
 * Chronicle AI — useCampaignDraft Hook Tests
 * Phase 2.2
 *
 * Covers draft state management, per-step validation, navigation, the
 * selectCharacter/clearCharacter convenience helpers, resetDraft,
 * validateAll, isReadyToSubmit, and draftToCreateInput's field mapping.
 *
 * Mirrors useCharacterDraft.test.ts in structure: renderHook + act only,
 * no component rendering, no Supabase mocking. The hook is intentionally
 * UI-independent so these tests are pure state-machine assertions.
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  useCampaignDraft,
  createEmptyCampaignDraft,
  draftToCreateInput,
  CAMPAIGN_WIZARD_STEPS,
  CAMPAIGN_TITLE_MAX_LENGTH,
} from '@/components/campaign/useCampaignDraft'

// ─── createEmptyCampaignDraft ─────────────────────────────────────────────────

describe('createEmptyCampaignDraft', () => {
  it('produces a draft with an empty title', () => {
    expect(createEmptyCampaignDraft().title).toBe('')
  })

  it('defaults tone to heroic', () => {
    expect(createEmptyCampaignDraft().tone).toBe('heroic')
  })

  it('defaults difficulty to standard', () => {
    expect(createEmptyCampaignDraft().difficulty).toBe('standard')
  })

  it('defaults rulesStyle to standard', () => {
    expect(createEmptyCampaignDraft().rulesStyle).toBe('standard')
  })

  it('defaults characterId to null', () => {
    expect(createEmptyCampaignDraft().characterId).toBeNull()
  })

  it('defaults all text fields to empty strings', () => {
    const d = createEmptyCampaignDraft()
    expect(d.premise).toBe('')
    expect(d.characterName).toBe('')
    expect(d.directorNotes).toBe('')
  })

  it('has exactly the steps defined in CAMPAIGN_WIZARD_STEPS', () => {
    expect(CAMPAIGN_WIZARD_STEPS).toHaveLength(8)
    expect(CAMPAIGN_WIZARD_STEPS[0]).toBe('title')
    expect(CAMPAIGN_WIZARD_STEPS[CAMPAIGN_WIZARD_STEPS.length - 1]).toBe('review')
  })
})

// ─── draftToCreateInput ───────────────────────────────────────────────────────

describe('draftToCreateInput', () => {
  it('maps title, description from premise, tone, and difficulty', () => {
    const draft = {
      ...createEmptyCampaignDraft(),
      title: '  The Shattered Throne  ',
      premise: 'A kingdom torn asunder.',
      tone: 'grim' as const,
      difficulty: 'brutal' as const,
      characterId: 'char-1',
    }
    const input = draftToCreateInput(draft, 'user-1')
    expect(input.title).toBe('The Shattered Throne')
    expect(input.description).toBe('A kingdom torn asunder.')
    expect(input.tone).toBe('grim')
    expect(input.difficulty).toBe('brutal')
    expect(input.userId).toBe('user-1')
  })

  it('omits description when premise is empty (undefined, not empty string)', () => {
    const draft = { ...createEmptyCampaignDraft(), title: 'Test', characterId: 'char-1' }
    const input = draftToCreateInput(draft, 'user-1')
    expect(input.description).toBeUndefined()
  })

  it('maps rulesStyle into directorConfig', () => {
    const draft = {
      ...createEmptyCampaignDraft(),
      title: 'Test',
      characterId: 'char-1',
      rulesStyle: 'cinematic' as const,
    }
    const input = draftToCreateInput(draft, 'user-1')
    expect(input.directorConfig?.rulesStyle).toBe('cinematic')
  })

  it('maps directorNotes into directorConfig.hiddenArc, trimmed', () => {
    const draft = {
      ...createEmptyCampaignDraft(),
      title: 'Test',
      characterId: 'char-1',
      directorNotes: '  The guild is corrupt.  ',
    }
    const input = draftToCreateInput(draft, 'user-1')
    expect(input.directorConfig?.hiddenArc).toBe('The guild is corrupt.')
  })

  it('maps characterId into the input', () => {
    const draft = { ...createEmptyCampaignDraft(), title: 'Test', characterId: 'char-99' }
    expect(draftToCreateInput(draft, 'user-1').characterId).toBe('char-99')
  })

  it('does NOT include characterName (display-only field)', () => {
    const draft = {
      ...createEmptyCampaignDraft(),
      title: 'Test',
      characterId: 'char-1',
      characterName: 'Aldric Sorn',
    }
    const input = draftToCreateInput(draft, 'user-1') as unknown as Record<string, unknown>
    expect(input.characterName).toBeUndefined()
  })
})

// ─── Navigation ───────────────────────────────────────────────────────────────

describe('useCampaignDraft — navigation', () => {
  it('starts on the title step', () => {
    const { result } = renderHook(() => useCampaignDraft())
    expect(result.current.currentStep).toBe('title')
    expect(result.current.stepIndex).toBe(0)
    expect(result.current.isFirstStep).toBe(true)
    expect(result.current.isLastStep).toBe(false)
  })

  it('goNext returns false and does not advance when the current step is invalid', () => {
    const { result } = renderHook(() => useCampaignDraft())
    // title is empty → invalid
    let advanced = false
    act(() => { advanced = result.current.goNext() })
    expect(advanced).toBe(false)
    expect(result.current.currentStep).toBe('title')
  })

  it('goNext advances when the current step is valid', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'The Shattered Throne' }))
    let advanced = false
    act(() => { advanced = result.current.goNext() })
    expect(advanced).toBe(true)
    expect(result.current.currentStep).toBe('premise')
  })

  it('goBack returns to the previous step', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'The Shattered Throne' }))
    act(() => result.current.goNext())
    expect(result.current.currentStep).toBe('premise')
    act(() => result.current.goBack())
    expect(result.current.currentStep).toBe('title')
  })

  it('goBack does nothing when on the first step', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goBack())
    expect(result.current.stepIndex).toBe(0)
  })

  it('goToStep jumps directly to a named step', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('character'))
    expect(result.current.currentStep).toBe('character')
  })

  it('isLastStep is true only on the review step', () => {
    const { result } = renderHook(() => useCampaignDraft())
    expect(result.current.isLastStep).toBe(false)
    act(() => result.current.goToStep('review'))
    expect(result.current.isLastStep).toBe(true)
  })

  it('visits every step in CAMPAIGN_WIZARD_STEPS via goToStep', () => {
    const { result } = renderHook(() => useCampaignDraft())
    for (const step of CAMPAIGN_WIZARD_STEPS) {
      act(() => result.current.goToStep(step))
      expect(result.current.currentStep).toBe(step)
    }
  })
})

// ─── Validation: title step ───────────────────────────────────────────────────

describe('useCampaignDraft — title validation', () => {
  it('is invalid when title is empty', () => {
    const { result } = renderHook(() => useCampaignDraft())
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain('cannot be empty')
  })

  it('is valid with a non-empty title', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'A' }))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it(`rejects a title over ${CAMPAIGN_TITLE_MAX_LENGTH} characters`, () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'A'.repeat(CAMPAIGN_TITLE_MAX_LENGTH + 1) }))
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain(String(CAMPAIGN_TITLE_MAX_LENGTH))
  })

  it(`accepts a title of exactly ${CAMPAIGN_TITLE_MAX_LENGTH} characters`, () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'A'.repeat(CAMPAIGN_TITLE_MAX_LENGTH) }))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('a title of only whitespace is treated as empty', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: '   ' }))
    expect(result.current.currentValidation.isValid).toBe(false)
  })
})

// ─── Validation: optional steps ───────────────────────────────────────────────

describe('useCampaignDraft — optional step validation', () => {
  it('premise step is always valid (premise is optional)', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('premise'))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('director step is always valid (director notes are optional)', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('director'))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('tone step is valid for all four tone values', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('tone'))
    for (const tone of ['grim', 'heroic', 'mysterious', 'comedic'] as const) {
      act(() => result.current.updateDraft({ tone }))
      expect(result.current.currentValidation.isValid).toBe(true)
    }
  })

  it('difficulty step is valid for all three difficulty values', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('difficulty'))
    for (const difficulty of ['easy', 'standard', 'brutal'] as const) {
      act(() => result.current.updateDraft({ difficulty }))
      expect(result.current.currentValidation.isValid).toBe(true)
    }
  })

  it('rules_style step is valid for all four style values', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('rules_style'))
    for (const style of ['narrative', 'standard', 'crunchy', 'cinematic'] as const) {
      act(() => result.current.updateDraft({ rulesStyle: style }))
      expect(result.current.currentValidation.isValid).toBe(true)
    }
  })
})

// ─── Validation: character step ───────────────────────────────────────────────

describe('useCampaignDraft — character step validation', () => {
  it('is invalid when no character is selected', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('character'))
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain('character must be selected')
  })

  it('is valid after selecting a character', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('character'))
    act(() => result.current.selectCharacter('char-1', 'Aldric Sorn'))
    expect(result.current.currentValidation.isValid).toBe(true)
  })

  it('is invalid again after clearing the character', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('character'))
    act(() => result.current.selectCharacter('char-1', 'Aldric Sorn'))
    act(() => result.current.clearCharacter())
    expect(result.current.currentValidation.isValid).toBe(false)
  })

  it('selectCharacter sets both characterId and characterName', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.selectCharacter('char-99', 'Lira Swiftfoot'))
    expect(result.current.draft.characterId).toBe('char-99')
    expect(result.current.draft.characterName).toBe('Lira Swiftfoot')
  })

  it('clearCharacter resets both fields', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.selectCharacter('char-99', 'Lira Swiftfoot'))
    act(() => result.current.clearCharacter())
    expect(result.current.draft.characterId).toBeNull()
    expect(result.current.draft.characterName).toBe('')
  })
})

// ─── Validation: review step ─────────────────────────────────────────────────

describe('useCampaignDraft — review step validation', () => {
  it('is invalid when title is missing', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.goToStep('review'))
    expect(result.current.currentValidation.isValid).toBe(false)
  })

  it('is invalid when title is present but no character selected', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => {
      result.current.updateDraft({ title: 'The Shattered Throne' })
      result.current.goToStep('review')
    })
    expect(result.current.currentValidation.isValid).toBe(false)
    expect(result.current.currentValidation.error).toContain('character must be selected')
  })

  it('is valid when title is present and a character is selected', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => {
      result.current.updateDraft({ title: 'The Shattered Throne' })
      result.current.selectCharacter('char-1', 'Aldric')
      result.current.goToStep('review')
    })
    expect(result.current.currentValidation.isValid).toBe(true)
  })
})

// ─── validateAll ─────────────────────────────────────────────────────────────

describe('useCampaignDraft — validateAll', () => {
  it('returns one result per non-review step', () => {
    const { result } = renderHook(() => useCampaignDraft())
    expect(result.current.validateAll()).toHaveLength(CAMPAIGN_WIZARD_STEPS.length - 1)
  })

  it('flags title as invalid on an empty draft', () => {
    const { result } = renderHook(() => useCampaignDraft())
    const results = result.current.validateAll()
    const titleIndex = CAMPAIGN_WIZARD_STEPS.filter((s) => s !== 'review').indexOf('title')
    expect(results[titleIndex].isValid).toBe(false)
  })

  it('flags character as invalid when none is selected', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'Test Campaign' }))
    const results = result.current.validateAll()
    const charIndex = CAMPAIGN_WIZARD_STEPS.filter((s) => s !== 'review').indexOf('character')
    expect(results[charIndex].isValid).toBe(false)
  })

  it('all steps pass for a fully valid draft', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => {
      result.current.updateDraft({ title: 'The Shattered Throne' })
      result.current.selectCharacter('char-1', 'Aldric')
    })
    expect(result.current.validateAll().every((v) => v.isValid)).toBe(true)
  })
})

// ─── isReadyToSubmit ─────────────────────────────────────────────────────────

describe('useCampaignDraft — isReadyToSubmit', () => {
  it('is false on an empty draft', () => {
    const { result } = renderHook(() => useCampaignDraft())
    expect(result.current.isReadyToSubmit).toBe(false)
  })

  it('is false when title is set but no character selected', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.updateDraft({ title: 'Test' }))
    expect(result.current.isReadyToSubmit).toBe(false)
  })

  it('is false when character is selected but title is empty', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => result.current.selectCharacter('char-1', 'Aldric'))
    expect(result.current.isReadyToSubmit).toBe(false)
  })

  it('is true when both title and character are valid', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => {
      result.current.updateDraft({ title: 'The Shattered Throne' })
      result.current.selectCharacter('char-1', 'Aldric')
    })
    expect(result.current.isReadyToSubmit).toBe(true)
  })

  it('becomes false again after clearing the character', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => {
      result.current.updateDraft({ title: 'Test' })
      result.current.selectCharacter('char-1', 'Aldric')
    })
    expect(result.current.isReadyToSubmit).toBe(true)
    act(() => result.current.clearCharacter())
    expect(result.current.isReadyToSubmit).toBe(false)
  })
})

// ─── resetDraft ───────────────────────────────────────────────────────────────

describe('useCampaignDraft — resetDraft', () => {
  it('resets all fields to empty defaults', () => {
    const { result } = renderHook(() => useCampaignDraft())
    act(() => {
      result.current.updateDraft({ title: 'Test', premise: 'Once upon a time…' })
      result.current.selectCharacter('char-1', 'Aldric')
      result.current.goToStep('director')
    })
    act(() => result.current.resetDraft())
    expect(result.current.draft.title).toBe('')
    expect(result.current.draft.premise).toBe('')
    expect(result.current.draft.characterId).toBeNull()
    expect(result.current.currentStep).toBe('title')
  })
})

// ─── Initial overrides ────────────────────────────────────────────────────────

describe('useCampaignDraft — initial overrides', () => {
  it('seeds the draft from the initial partial', () => {
    const { result } = renderHook(() =>
      useCampaignDraft({ title: 'Pre-seeded', tone: 'grim', characterId: 'char-99' }),
    )
    expect(result.current.draft.title).toBe('Pre-seeded')
    expect(result.current.draft.tone).toBe('grim')
    expect(result.current.draft.characterId).toBe('char-99')
  })

  it('keeps un-overridden fields at their defaults', () => {
    const { result } = renderHook(() => useCampaignDraft({ title: 'Override only title' }))
    expect(result.current.draft.difficulty).toBe('standard')
    expect(result.current.draft.rulesStyle).toBe('standard')
  })
})
