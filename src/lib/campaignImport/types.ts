/**
 * Chronicle AI — Campaign Import: Core Types
 * Phase 10.2
 *
 * Mirrors src/lib/import/types.ts (character import, Phase 10.1) exactly —
 * same provider-agnostic pattern, same "one honest fallback provider,
 * zero fake extraction" discipline. Read that file's header first if this
 * one is unfamiliar; the two are intentionally structured identically so
 * a future engineer (or a future Claude session) can extend either one
 * using the same mental model.
 *
 * Defines the contract for extracting a campaign draft from an uploaded
 * document (PDF/DOCX/TXT/MD/JSON). This phase ships the full pipeline
 * architecture — upload, review, manual correction, save — with exactly
 * ONE real provider: a manual-entry fallback that asks the player to
 * confirm/fill in every field themselves after upload. No document
 * parsing, no AI call.
 *
 * The entire point of this file is that a future phase can implement
 * CampaignImportProvider with real PDF/DOCX text extraction plus an LLM
 * summarization pass, register it in place of ManualCampaignEntryProvider,
 * and NOTHING else in the app changes — not the upload UI, not the review
 * screen, not the save path.
 */

import type { CampaignDraft } from '@/components/campaign/useCampaignDraft'

/** File types the campaign import pipeline accepts. */
export const SUPPORTED_CAMPAIGN_IMPORT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain', // .txt
  'text/markdown', // .md
  'application/json', // Campaign JSON (a Chronicle-native export/interchange shape — see below)
] as const
export type SupportedCampaignImportType = (typeof SUPPORTED_CAMPAIGN_IMPORT_TYPES)[number]

/**
 * Some browsers/OSes report .md files as 'text/plain' or even '' (empty)
 * rather than 'text/markdown' — MIME sniffing for Markdown is notoriously
 * inconsistent. isSupportedCampaignImportFile falls back to extension
 * checking for this one case; see that function for the exact rule.
 */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const

/** Per-field confidence, so the review screen can visually flag low-confidence extractions. */
export type FieldConfidence = 'high' | 'medium' | 'low' | 'needs-review'

/**
 * A single extracted field. `value` uses the same type the corresponding
 * CampaignDraft field uses — intentionally generic rather than a union of
 * every possible field type, matching ExtractedField<T> in the character
 * import types.
 */
export interface ExtractedField<T = unknown> {
  value: T
  confidence: FieldConfidence
  /** Raw source text this value was derived from, if available — shown in the review UI for transparency. */
  sourceText?: string
}

/**
 * The full result of a campaign import attempt. Every field is optional —
 * a provider extracts what it can and leaves the rest for manual entry.
 * Fields with no ExtractedField entry are treated as "needs-review" with
 * no pre-filled value — never invented.
 */
export interface CampaignImportResult {
  title?: ExtractedField<string>
  premise?: ExtractedField<string>
  tone?: ExtractedField<CampaignDraft['tone']>
  difficulty?: ExtractedField<CampaignDraft['difficulty']>
  directorNotes?: ExtractedField<string>
  /**
   * Named locations/NPCs/plot beats a richer future provider might pull
   * out of a campaign bible or adventure module. Not part of CampaignDraft
   * today (Campaign Mode's structured "intended scope" concept is still
   * spec-only — see docs/design/CAMPAIGN_MODE.md and
   * docs/specs/PHASE_12_CREATOR_TOOLS.md's CampaignDefinition type). Kept
   * here, in the provider's raw result, as free-text notes so nothing the
   * provider found is silently dropped even though there's no structured
   * field to put it in yet.
   */
  unstructuredNotes?: string[]
  /** Which provider produced this result — shown in the review UI for transparency. */
  providerName: string
  /** Overall extraction quality, provider's own self-assessment. */
  overallConfidence: FieldConfidence
}

/**
 * The provider contract. Swappable — see file header. `parse()` is async
 * because every real provider (text extraction + summarization) is
 * inherently async; the manual-entry fallback resolves immediately.
 */
export interface CampaignImportProvider {
  /** Human-readable name shown in the review UI ("Manual Entry", future "Document Parser", etc.) */
  readonly name: string
  /** Whether this provider can actually attempt extraction, or only offers the manual fallback UI. */
  readonly supportsExtraction: boolean
  parse(file: File): Promise<CampaignImportResult>
}

/** Thrown by a provider when a file can't be processed at all (corrupt, wrong type, etc.). */
export class CampaignImportParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'CampaignImportParseError'
  }
}

/**
 * True if the given File's MIME type (or, for the Markdown MIME-sniffing
 * edge case, its extension) is one the pipeline accepts.
 */
export function isSupportedCampaignImportFile(
  file: File,
): file is File & { type: SupportedCampaignImportType } {
  if ((SUPPORTED_CAMPAIGN_IMPORT_TYPES as readonly string[]).includes(file.type)) return true
  // Markdown fallback: browsers commonly report .md as 'text/plain' or ''
  const lowerName = file.name.toLowerCase()
  if ((file.type === 'text/plain' || file.type === '') &&
      MARKDOWN_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true
  }
  return false
}
