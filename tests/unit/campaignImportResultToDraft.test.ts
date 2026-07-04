/**
 * campaignImportResultToDraft Tests — Phase 10.2
 * Mirrors tests/unit/importResultToDraft.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { campaignImportResultToDraft } from '@/lib/campaignImport/convertResult'
import { createEmptyCampaignDraft } from '@/components/campaign/useCampaignDraft'
import type { CampaignImportResult } from '@/lib/campaignImport/types'

describe('campaignImportResultToDraft — empty result (manual entry provider case)', () => {
  it('returns a draft identical to createEmptyCampaignDraft() when nothing was extracted', () => {
    const result: CampaignImportResult = { providerName: 'Manual Entry', overallConfidence: 'needs-review' }
    const { draft } = campaignImportResultToDraft(result)
    expect(draft).toEqual(createEmptyCampaignDraft())
  })

  it('returns an empty confidence map when nothing was extracted', () => {
    const result: CampaignImportResult = { providerName: 'Manual Entry', overallConfidence: 'needs-review' }
    const { confidence } = campaignImportResultToDraft(result)
    expect(confidence).toEqual({})
  })

  it('passes through notes verbatim', () => {
    const result: CampaignImportResult = {
      providerName: 'Manual Entry', overallConfidence: 'needs-review',
      unstructuredNotes: ['Uploaded "campaign.pdf" — fill in fields manually.'],
    }
    const { notes } = campaignImportResultToDraft(result)
    expect(notes).toEqual(['Uploaded "campaign.pdf" — fill in fields manually.'])
  })

  it('defaults notes to an empty array when the provider supplies none', () => {
    const result: CampaignImportResult = { providerName: 'Manual Entry', overallConfidence: 'needs-review' }
    const { notes } = campaignImportResultToDraft(result)
    expect(notes).toEqual([])
  })
})

describe('campaignImportResultToDraft — partial extraction (future provider shape)', () => {
  it('only overwrites fields that were actually extracted', () => {
    const result: CampaignImportResult = {
      providerName: 'Test Provider', overallConfidence: 'medium',
      title: { value: 'The Shattered Throne', confidence: 'high' },
      tone: { value: 'grim', confidence: 'medium' },
    }
    const { draft } = campaignImportResultToDraft(result)
    expect(draft.title).toBe('The Shattered Throne')
    expect(draft.tone).toBe('grim')
    expect(draft.premise).toBe(createEmptyCampaignDraft().premise)
    expect(draft.difficulty).toBe(createEmptyCampaignDraft().difficulty)
  })

  it('records confidence only for extracted fields', () => {
    const result: CampaignImportResult = {
      providerName: 'Test Provider', overallConfidence: 'medium',
      title: { value: 'The Shattered Throne', confidence: 'high' },
    }
    const { confidence } = campaignImportResultToDraft(result)
    expect(confidence.title).toBe('high')
    expect(confidence.premise).toBeUndefined()
  })

  it('extracts premise exactly as provided, no normalization', () => {
    const premise = 'A kingdom in turmoil after the death of its king.'
    const result: CampaignImportResult = {
      providerName: 'Test Provider', overallConfidence: 'high',
      premise: { value: premise, confidence: 'high' },
    }
    const { draft } = campaignImportResultToDraft(result)
    expect(draft.premise).toBe(premise)
  })

  it('preserves the providerName in the conversion result', () => {
    const result: CampaignImportResult = { providerName: 'Future Document Parser', overallConfidence: 'high' }
    const { providerName } = campaignImportResultToDraft(result)
    expect(providerName).toBe('Future Document Parser')
  })

  it('extracts all five importable fields when all are present', () => {
    const result: CampaignImportResult = {
      providerName: 'Test Provider', overallConfidence: 'high',
      title: { value: 'Test', confidence: 'high' },
      premise: { value: 'Test premise', confidence: 'high' },
      tone: { value: 'heroic', confidence: 'high' },
      difficulty: { value: 'standard', confidence: 'high' },
      directorNotes: { value: 'A secret twist', confidence: 'high' },
    }
    const { confidence } = campaignImportResultToDraft(result)
    expect(Object.keys(confidence)).toHaveLength(5)
  })

  it('does not touch characterId/characterName — import never assigns a character', () => {
    const result: CampaignImportResult = {
      providerName: 'Test Provider', overallConfidence: 'high',
      title: { value: 'Test', confidence: 'high' },
    }
    const { draft } = campaignImportResultToDraft(result)
    expect(draft.characterId).toBeNull()
    expect(draft.characterName).toBe('')
  })
})
