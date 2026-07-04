/**
 * Chronicle AI — Character Import: Core Types
 * Phase 10.1
 *
 * Defines the provider-agnostic contract for extracting a character draft
 * from an uploaded file (PDF/PNG/JPG). This phase ships the full pipeline
 * architecture — upload, review, manual correction, save — with exactly
 * ONE real provider: a manual-entry fallback that asks the player to fill
 * in every field themselves after upload. No OCR, no AI vision call.
 *
 * The entire point of this file is that a future phase can implement
 * CharacterImportProvider with OpenAI Vision, Google Vision, or a
 * traditional OCR library, register it in place of ManualEntryProvider,
 * and NOTHING else in the app changes — not the upload UI, not the review
 * screen, not the save path. See ImportReviewPage.tsx for the consumer.
 */

import type { CharacterDraft } from '@/components/character/useCharacterDraft'

/** File types the import pipeline accepts. */
export const SUPPORTED_IMPORT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export type SupportedImportType = (typeof SUPPORTED_IMPORT_TYPES)[number]

/** Per-field confidence, so the review screen can visually flag low-confidence extractions. */
export type FieldConfidence = 'high' | 'medium' | 'low' | 'needs-review'

/**
 * A single extracted field. `value` uses the same type the corresponding
 * CharacterDraft field uses — this is intentionally generic rather than a
 * union of every possible field type, since providers extract a dynamic
 * subset of fields depending on what the source document actually contains.
 */
export interface ExtractedField<T = unknown> {
  value: T
  confidence: FieldConfidence
  /** Raw source text this value was derived from, if available — shown in the review UI for transparency. */
  sourceText?: string
}

/**
 * The full result of an import attempt. Every field is optional — a
 * provider extracts what it can and leaves the rest for manual entry.
 * Fields with no ExtractedField entry are treated as "needs-review" with
 * no pre-filled value; the review screen never invents a value for a
 * field the provider didn't actually detect (same "no fake data"
 * discipline used throughout this project's Director/world-state work).
 */
export interface CharacterImportResult {
  name?: ExtractedField<string>
  archetype?: ExtractedField<string>
  ancestry?: ExtractedField<string>
  background?: ExtractedField<string>
  level?: ExtractedField<number>
  scores?: ExtractedField<CharacterDraft['scores']>
  maxHp?: ExtractedField<number>
  armorClass?: ExtractedField<number>
  skillProficiencies?: ExtractedField<CharacterDraft['skillProficiencies']>
  savingThrowProficiencies?: ExtractedField<CharacterDraft['savingThrowProficiencies']>
  equipment?: ExtractedField<CharacterDraft['equipment']>
  /**
   * Free-text notes the provider couldn't structure but wants to preserve
   * for the player to read during review (e.g. "Spells: Fireball, Shield"
   * on a source sheet with no dedicated spell-parsing yet).
   */
  unstructuredNotes?: string[]
  /** Which provider produced this result — shown in the review UI for transparency. */
  providerName: string
  /** Overall extraction quality, provider's own self-assessment. */
  overallConfidence: FieldConfidence
}

/**
 * The provider contract. Swappable — see file header. `parse()` is async
 * because every real provider (OCR, Vision API) is inherently async; the
 * manual-entry fallback just resolves immediately with an empty result.
 */
export interface CharacterImportProvider {
  /** Human-readable name shown in the review UI ("Manual Entry", "OpenAI Vision", etc.) */
  readonly name: string
  /** Whether this provider can actually attempt extraction, or only offers the manual fallback UI. */
  readonly supportsExtraction: boolean
  parse(file: File): Promise<CharacterImportResult>
}

/** Thrown by a provider when a file can't be processed at all (corrupt, wrong type, etc.). */
export class ImportParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'ImportParseError'
  }
}

/** True if the given File's MIME type is one the pipeline accepts. */
export function isSupportedImportFile(file: File): file is File & { type: SupportedImportType } {
  return (SUPPORTED_IMPORT_TYPES as readonly string[]).includes(file.type)
}
