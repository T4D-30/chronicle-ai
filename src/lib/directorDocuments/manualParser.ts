/**
 * Chronicle AI — Manual Document Parser
 * Phase 10.3 (superseded as the active parser by textExtractionParser.ts, Phase 10.4)
 *
 * The original, extraction-free DirectorDocumentParser. It does not read
 * the file's contents — it declines extraction entirely, matching the
 * "honest, no fake data" pattern of ManualEntryProvider and
 * ManualCampaignEntryProvider (character/campaign import, Phase 10.1/10.2).
 *
 * As of Phase 10.4, TextExtractionParser (textExtractionParser.ts) is the
 * ACTIVE parser — see its own file for the real TXT/Markdown/PDF/DOCX
 * extraction, and its getActiveDocumentParser() for the current swap
 * point. ManualDocumentParser remains here, fully functional, as a
 * reference implementation and an easy fallback (e.g. to disable
 * extraction entirely without deleting code) — swap the return value in
 * textExtractionParser.ts's getActiveDocumentParser() back to this export
 * if ever needed.
 */

import type { DirectorDocumentParser } from './types'

export const ManualDocumentParser: DirectorDocumentParser = {
  name: 'Manual Entry',
  supportsExtraction: false,

  async extractText(_file: File) {
    return { text: null, confidence: 'unavailable' as const }
  },
}
