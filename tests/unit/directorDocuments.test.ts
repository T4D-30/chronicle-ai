/**
 * Director Document Types — Extension Point Tests
 * Phase 10.2
 *
 * This module is types/interfaces only (see src/lib/directorDocuments/types.ts
 * header for why) — no service layer, no UI, nothing wired up. The one
 * piece of actual runtime logic is the file-type guard, tested here so
 * the extension point isn't entirely unverified when a future session
 * builds on it.
 */
import { describe, it, expect } from 'vitest'
import {
  isSupportedDirectorDocument,
  SUPPORTED_DIRECTOR_DOCUMENT_TYPES,
  DirectorDocumentError,
} from '@/lib/directorDocuments/types'

function makeFile(name: string, type: string): File {
  return new File(['dummy'], name, { type })
}

describe('isSupportedDirectorDocument', () => {
  it('accepts application/pdf', () => {
    expect(isSupportedDirectorDocument(makeFile('guide.pdf', 'application/pdf'))).toBe(true)
  })

  it('accepts DOCX', () => {
    expect(isSupportedDirectorDocument(
      makeFile('guide.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    )).toBe(true)
  })

  it('accepts text/plain', () => {
    expect(isSupportedDirectorDocument(makeFile('guide.txt', 'text/plain'))).toBe(true)
  })

  it('accepts text/markdown', () => {
    expect(isSupportedDirectorDocument(makeFile('guide.md', 'text/markdown'))).toBe(true)
  })

  it('rejects an unsupported type', () => {
    expect(isSupportedDirectorDocument(makeFile('guide.png', 'image/png'))).toBe(false)
  })

  it('SUPPORTED_DIRECTOR_DOCUMENT_TYPES contains exactly PDF, DOCX, TXT, Markdown (no JSON — reference material, not structured interchange)', () => {
    expect(SUPPORTED_DIRECTOR_DOCUMENT_TYPES).toEqual([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ])
  })
})

describe('DirectorDocumentError', () => {
  it('is a real Error subclass with the expected name', () => {
    const err = new DirectorDocumentError('test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('DirectorDocumentError')
    expect(err.message).toBe('test message')
  })

  it('preserves an optional cause', () => {
    const cause = new Error('underlying failure')
    const err = new DirectorDocumentError('wrapped', cause)
    expect(err.cause).toBe(cause)
  })
})
