/**
 * importResultToDraft Tests — Phase 10.1
 *
 * The critical invariant: every value that lands in the resulting
 * CharacterDraft came from a real ExtractedField the provider returned.
 * Fields the provider didn't touch fall back to createEmptyDraft()
 * defaults — exactly what a fresh manual wizard starts with, never a
 * fabricated "best guess."
 */
import { describe, it, expect } from 'vitest'
import { importResultToDraft } from '@/lib/import/convertResult'
import { createEmptyDraft } from '@/components/character/useCharacterDraft'
import type { CharacterImportResult } from '@/lib/import/types'

describe('importResultToDraft — empty result (manual entry provider case)', () => {
  it('returns a draft identical to createEmptyDraft() when nothing was extracted', () => {
    const result: CharacterImportResult = {
      providerName: 'Manual Entry',
      overallConfidence: 'needs-review',
    }
    const { draft } = importResultToDraft(result)
    expect(draft).toEqual(createEmptyDraft())
  })

  it('returns an empty confidence map when nothing was extracted', () => {
    const result: CharacterImportResult = {
      providerName: 'Manual Entry',
      overallConfidence: 'needs-review',
    }
    const { confidence } = importResultToDraft(result)
    expect(confidence).toEqual({})
  })

  it('passes through notes verbatim', () => {
    const result: CharacterImportResult = {
      providerName: 'Manual Entry',
      overallConfidence: 'needs-review',
      unstructuredNotes: ['Uploaded "sheet.pdf" — fill in fields manually.'],
    }
    const { notes } = importResultToDraft(result)
    expect(notes).toEqual(['Uploaded "sheet.pdf" — fill in fields manually.'])
  })

  it('defaults notes to an empty array when the provider supplies none', () => {
    const result: CharacterImportResult = { providerName: 'Manual Entry', overallConfidence: 'needs-review' }
    const { notes } = importResultToDraft(result)
    expect(notes).toEqual([])
  })
})

describe('importResultToDraft — partial extraction (future provider shape)', () => {
  it('only overwrites fields that were actually extracted', () => {
    const result: CharacterImportResult = {
      providerName: 'Test Provider',
      overallConfidence: 'medium',
      name: { value: 'Aldric Sorn', confidence: 'high' },
      level: { value: 5, confidence: 'medium' },
    }
    const { draft } = importResultToDraft(result)
    expect(draft.name).toBe('Aldric Sorn')
    expect(draft.level).toBe(5)
    // Everything else stays at the empty-draft default
    expect(draft.archetype).toBe(createEmptyDraft().archetype)
    expect(draft.scores).toEqual(createEmptyDraft().scores)
  })

  it('records confidence only for extracted fields', () => {
    const result: CharacterImportResult = {
      providerName: 'Test Provider',
      overallConfidence: 'medium',
      name: { value: 'Aldric Sorn', confidence: 'high' },
    }
    const { confidence } = importResultToDraft(result)
    expect(confidence.name).toBe('high')
    expect(confidence.archetype).toBeUndefined()
  })

  it('extracts scores exactly as provided, no normalization or invention', () => {
    const scores = { strength: 18, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 10, charisma: 13 }
    const result: CharacterImportResult = {
      providerName: 'Test Provider',
      overallConfidence: 'high',
      scores: { value: scores, confidence: 'high' },
    }
    const { draft } = importResultToDraft(result)
    expect(draft.scores).toEqual(scores)
  })

  it('extracts equipment array exactly as provided', () => {
    const equipment = [{ id: 'e1', name: 'Longsword', slot: 'weapon' as const, equipped: true }]
    const result: CharacterImportResult = {
      providerName: 'Test Provider',
      overallConfidence: 'medium',
      equipment: { value: equipment, confidence: 'medium' },
    }
    const { draft } = importResultToDraft(result)
    expect(draft.equipment).toEqual(equipment)
  })

  it('preserves the providerName in the conversion result', () => {
    const result: CharacterImportResult = { providerName: 'Future Vision Provider', overallConfidence: 'high' }
    const { providerName } = importResultToDraft(result)
    expect(providerName).toBe('Future Vision Provider')
  })

  it('extracts all nine importable fields when all are present', () => {
    const result: CharacterImportResult = {
      providerName: 'Test Provider',
      overallConfidence: 'high',
      name: { value: 'Test', confidence: 'high' },
      archetype: { value: 'wizard', confidence: 'high' },
      ancestry: { value: 'elf', confidence: 'high' },
      background: { value: 'scholar', confidence: 'high' },
      level: { value: 3, confidence: 'high' },
      scores: { value: createEmptyDraft().scores, confidence: 'high' },
      skillProficiencies: { value: ['arcana'], confidence: 'high' },
      savingThrowProficiencies: { value: ['INT'], confidence: 'high' },
      equipment: { value: [], confidence: 'high' },
    }
    const { confidence } = importResultToDraft(result)
    expect(Object.keys(confidence)).toHaveLength(9)
  })
})
