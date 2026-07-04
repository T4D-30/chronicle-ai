/**
 * visionClient Tests — Phase 11.2
 *
 * Mocks global fetch and supabase.auth.getSession() directly — this is
 * the client-side HTTP-calling layer, not the Edge Function itself
 * (which cannot run in this environment at all; it's Deno-only, same as
 * narrate/index.ts, confirmed unreachable from Vitest by every prior
 * phase's own precedent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase/client'
import { extractWithVision } from '@/lib/ocr/visionClient'
import type { VisionExtractionRequest, VisionExtractionResponse } from '@/lib/ocr/types'

const VALID_REQUEST: VisionExtractionRequest = {
  kind: 'character_sheet',
  pages: [{ pageNumber: 1, base64: 'ZmFrZSBpbWFnZSBieXRlcw==', mimeType: 'image/png' }],
}

const VALID_RESPONSE: VisionExtractionResponse = {
  fields: { name: { value: 'Aldric Sorn', confidence: 'high' } },
  unstructuredNotes: [],
  overallConfidence: 'high',
  pagesProcessed: 1,
  pagesFailed: 0,
}

function mockFetchOnce(response: { ok: boolean; status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (() => Promise.resolve(VALID_RESPONSE)),
    text: response.text ?? (() => Promise.resolve('')),
  } as Response)
}

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'fake-token' } },
    error: null,
  } as never)
})

describe('extractWithVision — request validation', () => {
  it('throws VisionExtractionError with code NO_PAGES for an empty pages array, without calling fetch', async () => {
    global.fetch = vi.fn()
    await expect(extractWithVision({ kind: 'character_sheet', pages: [] }))
      .rejects.toMatchObject({ code: 'NO_PAGES' })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('extractWithVision — authentication', () => {
  it('throws VisionExtractionError with code AUTH when there is no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    global.fetch = vi.fn()
    await expect(extractWithVision(VALID_REQUEST)).rejects.toMatchObject({ code: 'AUTH' })
  })

  it('does not call fetch when there is no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    global.fetch = vi.fn()
    await extractWithVision(VALID_REQUEST).catch(() => {})
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends the real access token as a Bearer header', async () => {
    mockFetchOnce({ ok: true })
    await extractWithVision(VALID_REQUEST)
    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer fake-token')
  })
})

describe('extractWithVision — successful extraction', () => {
  it('returns the parsed VisionExtractionResponse on success', async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) })
    const result = await extractWithVision(VALID_REQUEST)
    expect(result).toEqual(VALID_RESPONSE)
  })

  it('sends the request body exactly as given', async () => {
    mockFetchOnce({ ok: true })
    await extractWithVision(VALID_REQUEST)
    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    expect(JSON.parse(options?.body as string)).toEqual(VALID_REQUEST)
  })

  it('calls the vision-extract Edge Function endpoint', async () => {
    mockFetchOnce({ ok: true })
    await extractWithVision(VALID_REQUEST)
    const [url] = vi.mocked(global.fetch).mock.calls[0]
    expect(url).toContain('/functions/v1/vision-extract')
  })
})

describe('extractWithVision — retry logic', () => {
  it('retries once on a network failure, succeeding on the second attempt', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('Network error'))
      return Promise.resolve({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) } as Response)
    })

    const result = await extractWithVision(VALID_REQUEST)
    expect(result).toEqual(VALID_RESPONSE)
    expect(callCount).toBe(2)
  })

  it('does not retry more than once — fails after the second attempt also fails', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.reject(new Error('Persistent network error'))
    })

    await expect(extractWithVision(VALID_REQUEST)).rejects.toMatchObject({ code: 'NETWORK' })
    expect(callCount).toBe(2)
  })

  it('does NOT retry an AUTH failure — fails fast without ever calling fetch', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => { callCount++; return Promise.resolve() })

    await extractWithVision(VALID_REQUEST).catch(() => {})
    expect(callCount).toBe(0)
  })

  it('retries on an Edge-Function-side error response (5xx)', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('Internal error') } as Response)
      return Promise.resolve({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) } as Response)
    })

    const result = await extractWithVision(VALID_REQUEST)
    expect(result).toEqual(VALID_RESPONSE)
    expect(callCount).toBe(2)
  })
})

describe('extractWithVision — timeout', () => {
  it('throws VisionExtractionError with code TIMEOUT when the request aborts', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      return Promise.reject(abortError)
    })

    await expect(extractWithVision(VALID_REQUEST)).rejects.toMatchObject({ code: 'TIMEOUT' })
  })
})

describe('extractWithVision — Edge Function error response', () => {
  it('throws VisionExtractionError with code EDGE_FUNCTION_ERROR for a non-ok response, after retrying', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: () => Promise.resolve('kind must be "character_sheet" or "campaign_document".'),
    } as Response)

    await expect(extractWithVision(VALID_REQUEST)).rejects.toMatchObject({ code: 'EDGE_FUNCTION_ERROR' })
  })

  it('includes the response status and body text in the error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: () => Promise.resolve('Bad request details here'),
    } as Response)

    try {
      await extractWithVision(VALID_REQUEST)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as Error).message).toContain('400')
      expect((err as Error).message).toContain('Bad request details here')
    }
  })
})
