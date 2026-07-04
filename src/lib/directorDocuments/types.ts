/**
 * Chronicle AI — Director Reference Documents: Core Types
 * Phase 10.2 (types) → Phase 10.3 (storage/retrieval/UI) → Phase 10.4 (real extraction)
 *
 * STATUS: Fully implemented, including real text extraction. Storage
 * (migration 0006), service layer (src/lib/supabase/directorDocuments.ts),
 * retrieval (src/lib/directorDocuments/fullTextRetriever.ts),
 * upload/management UI (DirectorDocumentsPanel, mounted on
 * CampaignDetailPage), Director prompt integration
 * (supabase/functions/narrate/index.ts's REFERENCE DOCUMENTS section),
 * and text extraction (src/lib/directorDocuments/textExtractionParser.ts
 * — TXT/Markdown/PDF/DOCX, all client-side, no external API) all exist
 * and are tested — see tests/integration/directorDocuments.integration.test.ts
 * (real Postgres, including genuine ts_rank/ts_headline full-text search
 * behavior) and tests/unit/{DirectorDocumentsPanel,textExtractionParser,
 * directorDocumentParserRetriever}.test.ts.
 *
 * TextExtractionParser (textExtractionParser.ts) is the active parser —
 * see getActiveDocumentParser() there for the current swap point.
 * ManualDocumentParser (manualParser.ts), the original extraction-free
 * implementation, remains in the codebase as a documented fallback/
 * reference — not the active parser as of Phase 10.4.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 * ─────────────────────────────────────────────────────────────────────────
 * Reference material a player uploads once and the Director can draw on
 * for the life of a campaign — a DM guide, a homebrew rules document, a
 * world lore bible, character backstory notes. This is a genuinely
 * different use case from Campaign Import (src/lib/campaignImport/):
 *
 *   Campaign Import: parse a document ONCE, at creation time, into a
 *   CampaignDraft (title/premise/tone/etc). The source file is discarded
 *   after that one parse — see src/lib/campaignImport/manualEntryProvider.ts's
 *   "Extension point" comment block for where this was decided.
 *
 *   Director Reference Documents (this file): the source file (or its
 *   extracted text) PERSISTS and is available for the Director to
 *   retrieve from across many future turns, for the campaign's entire
 *   lifetime — a real storage + retrieval system, not a one-time parse.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RETRIEVAL STRATEGY — WHAT WAS BUILT AND WHY
 * ─────────────────────────────────────────────────────────────────────────
 * Full-text search (Postgres tsvector/ts_rank/ts_headline, migration
 * 0006's search_director_documents function) was chosen and implemented
 * over an embeddings-based approach because it requires no new external
 * dependency, no embedding-generation API cost, and was fully verifiable
 * against a real local Postgres instance during development. An
 * embeddings-based DocumentRetriever remains a valid future swap — see
 * getActiveDocumentRetriever() in fullTextRetriever.ts for the exact swap
 * point — but full-text search is real, shipped, and load-bearing today,
 * not a placeholder.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STORAGE (as built)
 * ─────────────────────────────────────────────────────────────────────────
 * Supabase Storage bucket `director-documents` (private, signed-URL
 * access only) for the raw file, PLUS the director_documents table for
 * metadata and extracted text — mirroring the existing portrait_url
 * pattern (character.ts / migration 0005) was NOT appropriate here, since
 * that stores small images as base64 text directly in a column; reference
 * documents can be much larger (a DM guide could be tens of pages) and
 * should not bloat the campaigns/characters row size. A dedicated table +
 * Storage bucket is the correct shape — this is a genuinely new
 * persistence pattern for this project, not a reuse of an existing one,
 * and should get its own migration.
 */

/** The kinds of reference material a player might upload — used for review-screen categorization and shown to the Director in the REFERENCE DOCUMENTS prompt section. */
export type DirectorDocumentCategory =
  | 'dm_guide'
  | 'campaign_bible'
  | 'homebrew_rules'
  | 'world_lore'
  | 'character_notes'
  | 'other'

/** File types accepted — same breadth as campaign import, since the source material overlaps heavily (a campaign bible IS often the same document type as a campaign import file). */
export const SUPPORTED_DIRECTOR_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
] as const
export type SupportedDirectorDocumentType = (typeof SUPPORTED_DIRECTOR_DOCUMENT_TYPES)[number]

/**
 * Metadata record for an uploaded reference document. Materializes the
 * director_documents table (migration 0006) — see rowToMetadata() in
 * src/lib/supabase/directorDocuments.ts for the exact DB-row mapping.
 * Deliberately does NOT include the file's raw bytes or extracted text
 * inline; those live in Storage / the extracted_text column respectively,
 * kept out of this lightweight metadata shape so listing a campaign's
 * documents stays cheap.
 */
export interface DirectorDocumentMetadata {
  id: string
  campaignId: string
  userId: string
  category: DirectorDocumentCategory
  /** Original uploaded filename, shown in any future review/management UI. */
  fileName: string
  fileType: SupportedDirectorDocumentType
  fileSizeBytes: number
  /** Storage bucket path — NOT a public URL. Resolved via a signed URL at read time, same access-control posture as portrait_url's the-user-owns-this-row pattern, but for a bucket object instead of an inline column. */
  storagePath: string
  /**
   * Whether this document's content has been indexed for Director
   * reference. False for every document this session ships, since no
   * parser/indexing exists yet — this field exists so the eventual
   * indexing pipeline has something concrete to flip once it's real,
   * rather than needing a schema change to add the concept later.
   */
  isIndexed: boolean
  uploadedAt: string
}

/**
 * The parser contract — intentionally shaped like CharacterImportProvider
 * / CampaignImportProvider (see src/lib/import/types.ts,
 * src/lib/campaignImport/types.ts) for consistency, even though this
 * pipeline's job is different (persist + later retrieve, not
 * parse-to-draft-once). extractText() here means "extract plain text for
 * storage/future retrieval," not "extract structured fields."
 */
export interface DirectorDocumentParser {
  readonly name: string
  readonly supportsExtraction: boolean
  /**
   * Extracts plain text content from the file for storage. The shipped
   * ManualDocumentParser (manualParser.ts) simply declines extraction and
   * leaves the document unindexed (isIndexed: false), matching the
   * "honest, no fake data" pattern of every other import provider in
   * this codebase.
   */
  extractText(file: File): Promise<{ text: string | null; confidence: 'high' | 'medium' | 'low' | 'unavailable' }>
}

/** Thrown when a reference document can't be processed at all. */
export class DirectorDocumentError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'DirectorDocumentError'
  }
}

/** True if the given File's MIME type is one the reference-document pipeline would accept. */
export function isSupportedDirectorDocument(
  file: File,
): file is File & { type: SupportedDirectorDocumentType } {
  return (SUPPORTED_DIRECTOR_DOCUMENT_TYPES as readonly string[]).includes(file.type)
}

// ─────────────────────────────────────────────────────────────────────────
// Retrieval — Phase 10.3
// ─────────────────────────────────────────────────────────────────────────
//
// The modular retrieval contract. A DocumentRetriever takes a query
// (the player's current input, or any text the Director wants context
// for) and returns the most relevant excerpts across a campaign's
// indexed documents. Swappable — see src/lib/directorDocuments/
// fullTextRetriever.ts (the one shipped implementation, full-text search
// via the search_vector column added in migration 0006) and
// docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md for the embeddings-based
// alternative this contract also supports, unimplemented.

export interface DocumentSearchResult {
  documentId: string
  fileName: string
  category: DirectorDocumentCategory
  /** A relevant excerpt — NOT the full document text, to keep prompt token cost bounded. */
  excerpt: string
  /** Relevance score, retriever-defined scale (full-text: Postgres ts_rank; embeddings: cosine similarity). Only meaningful for ranking within one retriever's results, never compared across retrievers. */
  relevanceScore: number
}

export interface DocumentRetriever {
  readonly name: string
  /**
   * Returns up to `limit` relevant excerpts for `query`, scoped to one
   * campaign's indexed documents (is_indexed = true only — an
   * unindexed document is invisible to retrieval, which is correct: it
   * has no searchable content).
   */
  retrieve(campaignId: string, query: string, limit?: number): Promise<DocumentSearchResult[]>
}

