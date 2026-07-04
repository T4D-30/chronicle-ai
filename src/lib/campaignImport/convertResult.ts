/**
 * Chronicle AI — Campaign Import Result → CampaignDraft Conversion
 * Phase 10.2
 *
 * Mirrors src/lib/import/convertResult.ts (character import). Bridges
 * CampaignImportResult (provider output, with confidence per field) to
 * CampaignDraft (the wizard's working state — see useCampaignDraft.ts).
 * This is what lets the campaign import review screen reuse the EXACT
 * same draft shape, validation, and creation path the manual campaign
 * wizard already uses — no separate "imported campaign" code path exists
 * anywhere downstream of this conversion.
 */

import { createEmptyCampaignDraft } from '@/components/campaign/useCampaignDraft'
import type { CampaignDraft } from '@/components/campaign/useCampaignDraft'
import type { CampaignImportResult, FieldConfidence } from './types'

/** Which CampaignDraft fields the review screen can show a confidence badge for. */
export type ImportableCampaignField = 'title' | 'premise' | 'tone' | 'difficulty' | 'directorNotes'

export type CampaignFieldConfidenceMap = Partial<Record<ImportableCampaignField, FieldConfidence>>

export interface CampaignImportConversionResult {
  /** A full CampaignDraft — fields the provider didn't extract fall back to createEmptyCampaignDraft() defaults, exactly like starting the manual wizard fresh. */
  draft: CampaignDraft
  /** Confidence per field that the provider actually attempted — fields absent here were never extracted at all. */
  confidence: CampaignFieldConfidenceMap
  /** Provider-supplied notes the review screen displays as-is. */
  notes: string[]
  providerName: string
}

/**
 * Converts a provider's raw result into a full draft + confidence map.
 * Every value that ends up in the draft came directly from the provider's
 * ExtractedField.value — never invented, guessed, or defaulted beyond
 * what createEmptyCampaignDraft() already provides.
 */
export function campaignImportResultToDraft(result: CampaignImportResult): CampaignImportConversionResult {
  const draft = createEmptyCampaignDraft()
  const confidence: CampaignFieldConfidenceMap = {}

  if (result.title) {
    draft.title = result.title.value
    confidence.title = result.title.confidence
  }
  if (result.premise) {
    draft.premise = result.premise.value
    confidence.premise = result.premise.confidence
  }
  if (result.tone) {
    draft.tone = result.tone.value
    confidence.tone = result.tone.confidence
  }
  if (result.difficulty) {
    draft.difficulty = result.difficulty.value
    confidence.difficulty = result.difficulty.confidence
  }
  if (result.directorNotes) {
    draft.directorNotes = result.directorNotes.value
    confidence.directorNotes = result.directorNotes.confidence
  }

  return {
    draft,
    confidence,
    notes: result.unstructuredNotes ?? [],
    providerName: result.providerName,
  }
}
