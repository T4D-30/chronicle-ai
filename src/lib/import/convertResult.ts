/**
 * Chronicle AI — Import Result → CharacterDraft Conversion
 * Phase 10.1
 *
 * Bridges CharacterImportResult (provider output, with confidence per
 * field) to CharacterDraft (the wizard's working state — see
 * useCharacterDraft.ts). This is what lets the import review screen reuse
 * the EXACT same draft shape, validation, and creation path the manual
 * wizard already uses — no separate "imported character" code path exists
 * anywhere downstream of this conversion.
 */

import { createEmptyDraft } from '@/components/character/useCharacterDraft'
import type { CharacterDraft } from '@/components/character/useCharacterDraft'
import type { CharacterImportResult, FieldConfidence } from './types'

/** Which CharacterDraft fields the review screen can show a confidence badge for. */
export type ImportableDraftField =
  | 'name' | 'archetype' | 'ancestry' | 'background' | 'level'
  | 'scores' | 'skillProficiencies' | 'savingThrowProficiencies' | 'equipment'

export type FieldConfidenceMap = Partial<Record<ImportableDraftField, FieldConfidence>>

export interface ImportConversionResult {
  /** A full CharacterDraft — fields the provider didn't extract fall back to createEmptyDraft() defaults, exactly like starting the manual wizard fresh. */
  draft: CharacterDraft
  /** Confidence per field that the provider actually attempted — fields absent here were never extracted at all (manual entry, no confidence to show). */
  confidence: FieldConfidenceMap
  /** Provider-supplied notes the review screen displays as-is (never parsed further). */
  notes: string[]
  providerName: string
}

/**
 * Converts a provider's raw result into a full draft + confidence map.
 * Every value that ends up in the draft came directly from the provider's
 * ExtractedField.value — this function never invents, guesses, or
 * defaults a value beyond what createEmptyDraft() already provides for
 * fields the provider didn't touch at all.
 */
export function importResultToDraft(result: CharacterImportResult): ImportConversionResult {
  const draft = createEmptyDraft()
  const confidence: FieldConfidenceMap = {}

  if (result.name) {
    draft.name = result.name.value
    confidence.name = result.name.confidence
  }
  if (result.archetype) {
    draft.archetype = result.archetype.value
    confidence.archetype = result.archetype.confidence
  }
  if (result.ancestry) {
    draft.ancestry = result.ancestry.value
    confidence.ancestry = result.ancestry.confidence
  }
  if (result.background) {
    draft.background = result.background.value
    confidence.background = result.background.confidence
  }
  if (result.level) {
    draft.level = result.level.value
    confidence.level = result.level.confidence
  }
  if (result.scores) {
    draft.scores = result.scores.value
    confidence.scores = result.scores.confidence
  }
  if (result.skillProficiencies) {
    draft.skillProficiencies = result.skillProficiencies.value
    confidence.skillProficiencies = result.skillProficiencies.confidence
  }
  if (result.savingThrowProficiencies) {
    draft.savingThrowProficiencies = result.savingThrowProficiencies.value
    confidence.savingThrowProficiencies = result.savingThrowProficiencies.confidence
  }
  if (result.equipment) {
    draft.equipment = result.equipment.value
    confidence.equipment = result.equipment.confidence
  }

  return {
    draft,
    confidence,
    notes: result.unstructuredNotes ?? [],
    providerName: result.providerName,
  }
}
