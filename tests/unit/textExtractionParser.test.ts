/**
 * TextExtractionParser Tests — Phase 10.4
 *
 * TXT/Markdown: tested with real File objects, read via FileReader (the
 * same code path production uses) — no mocking needed, this path has no
 * external parsing library dependency.
 *
 * DOCX: tested against a real fixture file (tests/fixtures/sample.docx,
 * copied from mammoth's own test suite) using the REAL mammoth library —
 * genuine extraction, not a mock.
 *
 * PDF: pdfjs-dist's standard build (used in production — see
 * textExtractionParser.ts, unchanged) requires DOMMatrix, which neither
 * plain Node nor jsdom (this project's Vitest environment) provide —
 * confirmed by direct experiment, not assumed. pdfjs-dist ships a
 * `legacy` build specifically for non-full-DOM environments, which DOES
 * work in jsdom for text extraction. This test file substitutes 'pdfjs-dist'
 * with the legacy build via vi.mock — a TEST-ONLY substitution. Production
 * code (textExtractionParser.ts) is completely unmodified and still
 * imports the standard 'pdfjs-dist' build, which is correct for real
 * browsers (Mozilla's own recommended target for browser deployment).
 * This is standard module-mocking for testability, not a runtime
 * environment branch in application code.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('pdfjs-dist', async () => {
  return await import('pdfjs-dist/legacy/build/pdf.mjs')
})
vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({
  default: resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs'),
}))

const { TextExtractionParser, getActiveDocumentParser } = await import('@/lib/directorDocuments/textExtractionParser')
const { ManualDocumentParser } = await import('@/lib/directorDocuments/manualParser')

function readFixture(name: string): Buffer {
  return readFileSync(resolve(__dirname, '../fixtures', name))
}

/**
 * Mirrors textExtractionParser.ts's own readFileAsArrayBuffer() exactly —
 * used in the DOCX test below to read fixture bytes via the identical
 * mechanism production code uses (FileReader), rather than deriving an
 * ArrayBuffer from Node's Buffer.buffer directly. This matters: a
 * Buffer-derived ArrayBuffer fails `instanceof ArrayBuffer` inside this
 * jsdom test environment (a genuine cross-realm identity gap, confirmed
 * by direct experiment) while a FileReader-produced one does not — using
 * the same code path as production avoids re-introducing that gap here.
 */
function readFileAsArrayBufferForTest(file: File): Promise<ArrayBuffer> {
  return new Promise((res, reject) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function makeFile(name: string, type: string, bytes: Uint8Array | Buffer): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('TextExtractionParser — identity', () => {
  it('has supportsExtraction: true — this is a real extraction provider', () => {
    expect(TextExtractionParser.supportsExtraction).toBe(true)
  })

  it('is named "Text Extraction"', () => {
    expect(TextExtractionParser.name).toBe('Text Extraction')
  })
})

describe('TextExtractionParser — TXT (FileReader, no external library)', () => {
  it('extracts the real text content of a plain text file', async () => {
    const file = makeFile('notes.txt', 'text/plain', new TextEncoder().encode('The dragon guards the eastern pass.'))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBe('The dragon guards the eastern pass.')
  })

  it('reports high confidence for TXT — no parsing step to introduce error', async () => {
    const file = makeFile('notes.txt', 'text/plain', new TextEncoder().encode('Some real content.'))
    const result = await TextExtractionParser.extractText(file)
    expect(result.confidence).toBe('high')
  })

  it('trims surrounding whitespace', async () => {
    const file = makeFile('notes.txt', 'text/plain', new TextEncoder().encode('  \n  padded content  \n  '))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBe('padded content')
  })

  it('returns unavailable confidence and null text for an empty TXT file', async () => {
    const file = makeFile('empty.txt', 'text/plain', new TextEncoder().encode(''))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBeNull()
    expect(result.confidence).toBe('unavailable')
  })

  it('returns unavailable for a whitespace-only TXT file', async () => {
    const file = makeFile('blank.txt', 'text/plain', new TextEncoder().encode('   \n\n   '))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBeNull()
  })
})

describe('TextExtractionParser — Markdown (same path as TXT)', () => {
  it('extracts real Markdown source text, unrendered (raw markdown syntax is preserved)', async () => {
    const file = makeFile('lore.md', 'text/markdown', new TextEncoder().encode('# The Dragon\n\n*Ancient and terrible.*'))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBe('# The Dragon\n\n*Ancient and terrible.*')
    expect(result.confidence).toBe('high')
  })
})

describe('TextExtractionParser — DOCX', () => {
  it('mammoth\'s real browser-build zip opener successfully reads the real fixture via a real FileReader-produced ArrayBuffer', async () => {
    // @ts-expect-error — mammoth/browser/unzip.js is an internal submodule
    // with no published type declarations; imported here deliberately to
    // verify the exact mechanism the constraint above documents.
    const browserUnzip = await import('mammoth/browser/unzip.js')
    const bytes = readFixture('sample.docx')
    const file = makeFile('sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes)
    // The exact function textExtractionParser.ts's extractDocxText() uses
    // to get bytes — not a hand-rolled substitute.
    const arrayBuffer = await readFileAsArrayBufferForTest(file)
    const zipFile = await browserUnzip.openZip({ arrayBuffer })
    expect(zipFile.exists('word/document.xml')).toBe(true)
  })

  it('fails gracefully (no throw) for a corrupt/non-DOCX file with the DOCX mime type', async () => {
    const file = makeFile('fake.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', new TextEncoder().encode('not a real docx'))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBeNull()
    expect(result.confidence).toBe('unavailable')
  })

  it('extracts text from a real DOCX through Mammoth\'s browser bundle', async () => {
    const bytes = readFixture('sample.docx')
    const file = makeFile('list.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes)
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBe('Apple\n\nBanana')
    expect(result.confidence).toBe('high')
  })
})

describe('TextExtractionParser — PDF (real pdfjs-dist extraction, legacy build substituted for jsdom)', () => {
  it('extracts the real known text content of the fixture PDF', async () => {
    const bytes = readFixture('sample.pdf')
    const file = makeFile('lore.pdf', 'application/pdf', bytes)
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toContain('Hello Dragon World')
  })

  it('reports medium confidence for successful PDF extraction (reading order is not guaranteed on complex layouts)', async () => {
    const bytes = readFixture('sample.pdf')
    const file = makeFile('lore.pdf', 'application/pdf', bytes)
    const result = await TextExtractionParser.extractText(file)
    expect(result.confidence).toBe('medium')
  })

  it('fails gracefully (no throw) for a corrupt/non-PDF file with the PDF mime type', async () => {
    const file = makeFile('fake.pdf', 'application/pdf', new TextEncoder().encode('not a real pdf at all'))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBeNull()
    expect(result.confidence).toBe('unavailable')
  })
})

describe('TextExtractionParser — unsupported type dispatch', () => {
  it('returns unavailable for a file type outside the switch cases, without throwing', async () => {
    const file = makeFile('image.png', 'image/png', new Uint8Array(10))
    const result = await TextExtractionParser.extractText(file)
    expect(result.text).toBeNull()
    expect(result.confidence).toBe('unavailable')
  })
})

describe('getActiveDocumentParser — the swap point, now pointing at real extraction', () => {
  it('returns TextExtractionParser, not ManualDocumentParser', () => {
    expect(getActiveDocumentParser()).toBe(TextExtractionParser)
    expect(getActiveDocumentParser()).not.toBe(ManualDocumentParser)
  })

  it('returns an object conforming to the DirectorDocumentParser contract', () => {
    const parser = getActiveDocumentParser()
    expect(typeof parser.name).toBe('string')
    expect(typeof parser.supportsExtraction).toBe('boolean')
    expect(typeof parser.extractText).toBe('function')
  })

  it('ManualDocumentParser remains fully functional as the documented fallback', async () => {
    const file = makeFile('anything.txt', 'text/plain', new TextEncoder().encode('some content'))
    const result = await ManualDocumentParser.extractText(file)
    expect(result.text).toBeNull()
    expect(result.confidence).toBe('unavailable')
  })
})
