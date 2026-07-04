/**
 * Director Documents — Manual Parser & Retriever Unit Tests
 * Phase 10.3 (ManualDocumentParser/FullTextRetriever tests unchanged by Phase 10.4)
 *
 * ManualDocumentParser is no longer the ACTIVE parser (see
 * textExtractionParser.ts / textExtractionParser.test.ts for that, Phase
 * 10.4) but remains a real, correct fallback implementation — these tests
 * confirm it still behaves exactly as designed. getActiveDocumentParser()
 * tests now live in textExtractionParser.test.ts, since that's where the
 * swap point actually lives as of Phase 10.4.
 *
 * FullTextRetriever tests are unchanged — retrieval was explicitly
 * required to stay untouched by the Phase 10.4 extraction work, and
 * these tests confirm that's true.
 */
import { describe, it, expect, vi } from 'vitest'
import { ManualDocumentParser } from '@/lib/directorDocuments/manualParser'

function makeFile(name: string, type: string): File {
  return new File(['dummy'], name, { type })
}

describe('ManualDocumentParser', () => {
  it('has supportsExtraction: false — honest about doing no real parsing', () => {
    expect(ManualDocumentParser.supportsExtraction).toBe(false)
  })

  it('extractText resolves with text: null', async () => {
    const result = await ManualDocumentParser.extractText(makeFile('guide.pdf', 'application/pdf'))
    expect(result.text).toBeNull()
  })

  it('extractText resolves with confidence: unavailable', async () => {
    const result = await ManualDocumentParser.extractText(makeFile('guide.pdf', 'application/pdf'))
    expect(result.confidence).toBe('unavailable')
  })

  it('never throws, regardless of file type', async () => {
    await expect(ManualDocumentParser.extractText(makeFile('anything.xyz', 'application/octet-stream')))
      .resolves.not.toThrow()
  })
})

describe('FullTextRetriever — empty-query short circuit (no DB call)', () => {
  it('returns [] for an empty string without calling supabase.rpc', async () => {
    vi.doMock('@/lib/supabase/client', () => ({
      supabase: { rpc: vi.fn().mockRejectedValue(new Error('rpc should not have been called')) },
    }))
    const { FullTextRetriever } = await import('@/lib/directorDocuments/fullTextRetriever')
    const results = await FullTextRetriever.retrieve('campaign-1', '', 5)
    expect(results).toEqual([])
    vi.doUnmock('@/lib/supabase/client')
  })

  it('returns [] for a whitespace-only string without calling supabase.rpc', async () => {
    vi.doMock('@/lib/supabase/client', () => ({
      supabase: { rpc: vi.fn().mockRejectedValue(new Error('rpc should not have been called')) },
    }))
    const { FullTextRetriever } = await import('@/lib/directorDocuments/fullTextRetriever')
    const results = await FullTextRetriever.retrieve('campaign-1', '   ', 5)
    expect(results).toEqual([])
    vi.doUnmock('@/lib/supabase/client')
  })
})
