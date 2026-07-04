/**
 * Chronicle AI — Manual Campaign Entry Provider
 * Phase 10.2
 *
 * The only real CampaignImportProvider this phase ships. It does not read
 * the file's contents at all — it validates the file is a supported type,
 * then returns an empty CampaignImportResult so every field on the review
 * screen starts as "needs-review" and the player fills it in by hand.
 *
 * Mirrors src/lib/import/manualEntryProvider.ts (character import). When a
 * real provider (document text extraction + summarization) is built, it
 * implements CampaignImportProvider and is swapped in wherever
 * getActiveCampaignImportProvider() is called — see that function's doc
 * comment for the exact swap point.
 */

import {
  isSupportedCampaignImportFile,
  CampaignImportParseError,
} from './types'
import type { CampaignImportProvider, CampaignImportResult } from './types'

export const ManualCampaignEntryProvider: CampaignImportProvider = {
  name: 'Manual Entry',
  supportsExtraction: false,

  async parse(file: File): Promise<CampaignImportResult> {
    if (!isSupportedCampaignImportFile(file)) {
      throw new CampaignImportParseError(
        `Unsupported file type "${file.type || 'unknown'}". Supported types: PDF, DOCX, TXT, Markdown, JSON.`,
      )
    }
    // No extraction attempted — every field is left for the player to
    // enter on the review screen. This is a deliberate, honest no-op, not
    // a stub masquerading as a working feature.
    return {
      providerName: 'Manual Entry',
      overallConfidence: 'needs-review',
      unstructuredNotes: [
        `Uploaded "${file.name}" — automatic extraction is not available yet. ` +
        'Fill in the campaign details below yourself. The file has been noted; ' +
        'nothing from its contents was read.',
      ],
    }
  },
}

/**
 * Returns the currently active campaign import provider. Single swap
 * point for a future real provider: replace the returned value with a
 * document-parsing-backed CampaignImportProvider implementation, and every
 * consumer (upload UI, review screen, save path) continues to work
 * unmodified — they only ever call this function and use the
 * CampaignImportProvider/CampaignImportResult contract from ./types,
 * never a concrete provider directly.
 */
export function getActiveCampaignImportProvider(): CampaignImportProvider {
  return ManualCampaignEntryProvider
}

// ─── Extension point (Phase 10.2) ──────────────────────────────────────────────
//
// Storing the uploaded document itself — separate from parsing it — is a
// real, near-term extension point worth naming explicitly rather than
// leaving implicit. Today, CampaignImportUpload never persists the raw
// uploaded file anywhere; it's read into memory, handed to a provider, and
// discarded once the draft is built. A future "Director Document Upload"
// feature (DM Guide / campaign bible / homebrew rules reference material
// the Director can cite later) needs the file itself to survive past this
// one parse-and-discard flow. That is intentionally a SEPARATE, later
// concern from campaign creation import — see
// docs/design/CAMPAIGN_MODE.md's "Campaign Import / Constraint System"
// section and docs/specs/PHASE_12_CREATOR_TOOLS.md for where that
// persistent-reference-material use case is specified, and
// docs/specs/PHASE_10_2_DIRECTOR_DOCUMENTS.md (this session) for the
// concrete storage/metadata/parser-interface design. This module's
// CampaignImportProvider stays narrowly scoped to "produce a CampaignDraft
// from one file, once, at creation time."
