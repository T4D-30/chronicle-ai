/**
 * Chronicle AI — Shared OCR/Vision Infrastructure: Core Types
 * Phase 11.2
 *
 * This is the SHARED layer both Character Import and Campaign Import
 * build their domain-specific providers on top of. It intentionally knows
 * nothing about characters or campaigns — it only knows "here are some
 * page images and a prompt describing what to extract, give me back
 * structured JSON with confidence."
 *
 * WHY THIS IS SEPARATE FROM src/lib/import/types.ts AND
 * src/lib/campaignImport/types.ts: those two files define the
 * CharacterImportProvider/CampaignImportProvider contracts consumed by
 * the existing upload UI and review screens (unchanged by this phase —
 * see those files' own headers, written in Phase 10.1/10.2, which
 * correctly anticipated this exact swap). This file defines what sits
 * BENEATH a real provider implementation: the actual mechanics of
 * getting page images to an Edge Function and structured JSON back.
 * OpenAIVisionCharacterProvider and OpenAIVisionCampaignProvider (built
 * on top of this layer) each implement their respective *ImportProvider
 * interface and internally call the shared extractWithVision() function
 * this layer provides — neither provider duplicates the page-splitting,
 * retry, or Edge Function calling logic.
 *
 * RELATIONSHIP TO DIRECTOR DOCUMENTS' TEXT EXTRACTION
 * (src/lib/directorDocuments/textExtractionParser.ts): that extraction is
 * PURE TEXT, entirely client-side (pdfjs-dist/mammoth), zero API calls —
 * it gets words off a page, nothing more. This layer is fundamentally
 * different: it sends actual page IMAGES to a multimodal model
 * server-side and asks it to understand structured meaning (which value
 * belongs to which field), not just transcribe text. The one piece
 * genuinely reused from that file is the FileReader-based byte-reading
 * pattern (see filePreparation.ts) — the actual extraction mechanism
 * cannot be shared, because one is text-layer parsing and the other is
 * image understanding via a remote model.
 */

/** A single page rendered as a base64-encoded image, ready to send to a Vision-capable model. */
export interface PageImage {
  /** 1-indexed page number, for citing "page 2 says..." in error messages and review UI. */
  pageNumber: number
  /** Base64-encoded image data, no data: URL prefix (the Edge Function adds that when building the OpenAI request). */
  base64: string
  /** MIME type of the encoded image — always image/png or image/jpeg, even for an originally-PDF page (PDF pages are rendered to canvas and re-encoded as PNG; see filePreparation.ts). */
  mimeType: 'image/png' | 'image/jpeg'
}

/** What kind of structured extraction to perform — determines which prompt the Edge Function uses. Domain-specific field shapes stay in the calling provider; this is just a routing key. */
export type VisionExtractionKind = 'character_sheet' | 'campaign_document'

export interface VisionExtractionRequest {
  kind: VisionExtractionKind
  pages: PageImage[]
}

/** Confidence scale shared with every other import/extraction system in this codebase (character import, campaign import, Director documents) — kept consistent deliberately, not reinvented per-feature. */
export type FieldConfidence = 'high' | 'medium' | 'low' | 'needs-review'

/**
 * One extracted field, generic over its value type — mirrors
 * ExtractedField<T> in src/lib/import/types.ts and
 * src/lib/campaignImport/types.ts exactly, so the domain-specific
 * providers can pass these straight through without remapping.
 */
export interface VisionExtractedField<T = unknown> {
  value: T
  confidence: FieldConfidence
  /** The literal text/description the model read that led to this value, for review-screen transparency. */
  sourceText?: string
}

/**
 * The raw shape the Edge Function returns — a flat, JSON-serializable bag
 * of fields (their names/types depend on `kind`), plus metadata every
 * extraction kind needs regardless of domain.
 */
export interface VisionExtractionResponse {
  /** Domain-specific fields, keyed by field name — the calling provider knows what keys to expect for its `kind`. */
  fields: Record<string, VisionExtractedField>
  /** Free-text the model found but couldn't map to a known field. */
  unstructuredNotes: string[]
  /** The model's own overall self-assessment — separate from per-field confidence, since a mostly-clear page with one illegible field should not report "low" overall. */
  overallConfidence: FieldConfidence
  /** How many pages were actually processed — for surfacing "3 of 5 pages could not be read" style messages. */
  pagesProcessed: number
  pagesFailed: number
}

/** Thrown by the client-side Vision caller for any failure category — mirrors NarratorError's discriminated-code pattern (src/lib/ai/narrator.ts) exactly, since the failure modes are the same shape (network, auth, timeout) plus a few OCR-specific categories. */
export class VisionExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NETWORK'
      | 'AUTH'
      | 'TIMEOUT'
      | 'INVALID_FILE'
      | 'NO_PAGES'
      | 'EDGE_FUNCTION_ERROR'
      | 'PARSE_ERROR',
  ) {
    super(message)
    this.name = 'VisionExtractionError'
  }
}
