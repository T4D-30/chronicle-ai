/**
 * Chronicle AI — Manual Entry Import Provider
 * Phase 10.1
 *
 * The only real CharacterImportProvider this phase ships. It does not read
 * the file's contents at all — it validates the file is a supported type,
 * then returns an empty CharacterImportResult so every field on the review
 * screen starts as "needs-review" and the player fills it in by hand.
 *
 * This exists so the full pipeline (upload → review → correct → save) is
 * real and usable today, without pretending any OCR/AI extraction is
 * happening. When a real provider (OpenAI Vision, Google Vision, OCR) is
 * built, it implements the same CharacterImportProvider interface and is
 * swapped in wherever getActiveImportProvider() is called — see that
 * function's doc comment for the exact swap point.
 */

import {
  isSupportedImportFile,
  ImportParseError,
  SUPPORTED_IMPORT_TYPES,
} from './types'
import type { CharacterImportProvider, CharacterImportResult } from './types'

export const ManualEntryProvider: CharacterImportProvider = {
  name: 'Manual Entry',
  supportsExtraction: false,

  async parse(file: File): Promise<CharacterImportResult> {
    if (!isSupportedImportFile(file)) {
      throw new ImportParseError(
        `Unsupported file type "${file.type || 'unknown'}". Supported types: ${SUPPORTED_IMPORT_TYPES.join(', ')}.`,
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
        'Fill in the fields below from your sheet.',
      ],
    }
  },
}

/**
 * Returns the currently active import provider. This is the single swap
 * point for a future real provider: replace the returned value with an
 * OpenAI Vision / Google Vision / OCR-backed CharacterImportProvider
 * implementation, and every consumer (upload UI, review screen, save
 * path) continues to work unmodified — they only ever call this function
 * and use the CharacterImportProvider/CharacterImportResult contract from
 * ./types, never a concrete provider directly.
 */
export function getActiveImportProvider(): CharacterImportProvider {
  return ManualEntryProvider
}
