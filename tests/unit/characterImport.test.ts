/**
 * Character Import — Core Pipeline Tests
 * Phase 10.1
 *
 * Covers the provider-agnostic architecture: file type validation, the
 * manual-entry fallback provider (the only real provider this phase
 * ships), and the swap point (getActiveImportProvider). No OCR/Vision
 * logic exists to test yet — that's explicitly future work; these tests
 * confirm the architecture is real and correctly wired, not that
 * extraction works (it doesn't, on purpose).
 */
import { describe, it, expect } from 'vitest'
import {
  isSupportedImportFile,
  SUPPORTED_IMPORT_TYPES,
  ImportParseError,
} from '@/lib/import/types'
import { ManualEntryProvider, getActiveImportProvider } from '@/lib/import/manualEntryProvider'

function makeFile(name: string, type: string): File {
  return new File(['dummy content'], name, { type })
}

describe('isSupportedImportFile', () => {
  it('accepts application/pdf', () => {
    expect(isSupportedImportFile(makeFile('sheet.pdf', 'application/pdf'))).toBe(true)
  })

  it('accepts image/png', () => {
    expect(isSupportedImportFile(makeFile('sheet.png', 'image/png'))).toBe(true)
  })

  it('accepts image/jpeg', () => {
    expect(isSupportedImportFile(makeFile('sheet.jpg', 'image/jpeg'))).toBe(true)
  })

  it('rejects an unsupported type', () => {
    expect(isSupportedImportFile(makeFile('sheet.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(false)
  })

  it('rejects an empty/unknown mime type', () => {
    expect(isSupportedImportFile(makeFile('sheet', ''))).toBe(false)
  })

  it('SUPPORTED_IMPORT_TYPES contains exactly PDF, PNG, JPEG', () => {
    expect(SUPPORTED_IMPORT_TYPES).toEqual(['application/pdf', 'image/png', 'image/jpeg'])
  })
})

describe('ManualEntryProvider', () => {
  it('has supportsExtraction: false — honest about doing no real parsing', () => {
    expect(ManualEntryProvider.supportsExtraction).toBe(false)
  })

  it('resolves successfully for a supported file type', async () => {
    const result = await ManualEntryProvider.parse(makeFile('sheet.pdf', 'application/pdf'))
    expect(result.providerName).toBe('Manual Entry')
  })

  it('throws ImportParseError for an unsupported file type', async () => {
    await expect(
      ManualEntryProvider.parse(makeFile('sheet.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
    ).rejects.toThrow(ImportParseError)
  })

  it('returns overallConfidence: needs-review — never claims false confidence', async () => {
    const result = await ManualEntryProvider.parse(makeFile('sheet.pdf', 'application/pdf'))
    expect(result.overallConfidence).toBe('needs-review')
  })

  it('does not populate any structured field — no fake data', async () => {
    const result = await ManualEntryProvider.parse(makeFile('sheet.pdf', 'application/pdf'))
    expect(result.name).toBeUndefined()
    expect(result.archetype).toBeUndefined()
    expect(result.scores).toBeUndefined()
    expect(result.equipment).toBeUndefined()
  })

  it('includes an honest note that extraction did not happen', async () => {
    const result = await ManualEntryProvider.parse(makeFile('my-character.pdf', 'application/pdf'))
    expect(result.unstructuredNotes?.[0]).toContain('my-character.pdf')
    expect(result.unstructuredNotes?.[0]).toContain('not available yet')
  })
})

describe('getActiveImportProvider — the future swap point', () => {
  it('currently returns ManualEntryProvider', () => {
    expect(getActiveImportProvider()).toBe(ManualEntryProvider)
  })

  it('returns an object conforming to the CharacterImportProvider contract', () => {
    const provider = getActiveImportProvider()
    expect(typeof provider.name).toBe('string')
    expect(typeof provider.supportsExtraction).toBe('boolean')
    expect(typeof provider.parse).toBe('function')
  })
})
