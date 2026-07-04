/**
 * Chronicle AI — Shared OCR/Vision Infrastructure: Edge Function Client
 * Phase 11.2 / 11.3
 *
 * Client-side caller for the `vision-extract` Supabase Edge Function —
 * mirrors src/lib/ai/narrator.ts's callNarrate() pattern exactly (raw
 * fetch, access token from the current session, AbortController-based
 * timeout, a discriminated error class), extended with retry logic for
 * transient failures, which narrate's own caller doesn't need (a failed
 * narration turn is simply resubmitted by the player; a failed OCR
 * extraction on a multi-page document is worth one automatic retry
 * before asking the player to intervene).
 *
 * SECURITY: exactly like narrate, the OpenAI API key is NEVER sent to or
 * held by the client. This function sends page images and gets back
 * structured JSON; the actual OpenAI call happens entirely inside the
 * Edge Function (supabase/functions/vision-extract/index.ts).
 */

import { supabase } from '@/lib/supabase/client'
import { VisionExtractionError } from './types'
import type { VisionExtractionRequest, VisionExtractionResponse } from './types'

const VISION_TIMEOUT_MS = 45_000
const MAX_RETRIES = 1

function isRetryableError(err: VisionExtractionError): boolean {
  return err.code === 'NETWORK' || err.code === 'TIMEOUT' || err.code === 'EDGE_FUNCTION_ERROR'
}

async function callVisionExtractOnce(request: VisionExtractionRequest): Promise<VisionExtractionResponse> {
  const { data: { session: authSession } } = await supabase.auth.getSession()
  if (!authSession?.access_token) {
    throw new VisionExtractionError('Not authenticated.', 'AUTH')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)

  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vision-extract`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      },
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new VisionExtractionError(
        `Vision extraction service returned ${res.status}: ${body.slice(0, 200)}`,
        'EDGE_FUNCTION_ERROR',
      )
    }

    const json = await res.json() as VisionExtractionResponse
    return json
  } catch (err) {
    if (err instanceof VisionExtractionError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new VisionExtractionError(`Extraction timed out after ${VISION_TIMEOUT_MS / 1000}s.`, 'TIMEOUT')
    }
    throw new VisionExtractionError(
      err instanceof Error ? err.message : 'Network error.',
      'NETWORK',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Calls the vision-extract Edge Function, retrying once on a transient
 * failure (network/timeout/edge-function-side error) before surfacing the
 * error to the caller. Auth and invalid-file errors are never retried —
 * they'll fail the same way every time.
 */
export async function extractWithVision(request: VisionExtractionRequest): Promise<VisionExtractionResponse> {
  if (request.pages.length === 0) {
    throw new VisionExtractionError('No pages to process.', 'NO_PAGES')
  }

  let lastError: VisionExtractionError | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callVisionExtractOnce(request)
    } catch (err) {
      const visionError = err instanceof VisionExtractionError
        ? err
        : new VisionExtractionError(err instanceof Error ? err.message : 'Unknown error.', 'NETWORK')
      lastError = visionError
      if (attempt === MAX_RETRIES || !isRetryableError(visionError)) {
        throw visionError
      }
    }
  }

  throw lastError ?? new VisionExtractionError('Extraction failed for an unknown reason.', 'NETWORK')
}
