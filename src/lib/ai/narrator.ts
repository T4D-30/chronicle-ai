/**
 * Chronicle AI — Narrator
 * Phase 2.4
 *
 * Client-side caller for the `narrate` Supabase Edge Function.
 * Handles both streaming (SSE) and non-streaming response modes.
 * All AI provider API calls happen server-side in the Edge Function.
 *
 * Streaming protocol:
 *   Content-Type: text/event-stream
 *   Events: data: <token>\n\n   (each streamed token)
 *           data: [DONE]\n\n   (stream complete signal)
 *           data: [ERROR] <message>\n\n (stream error signal)
 *
 * Non-streaming: Content-Type: application/json — NarrateResponse shape.
 */

import { supabase } from '@/lib/supabase/client'
import type { NarrateRequest, NarrateResponse } from './promptBuilder'

export class NarratorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NETWORK'
      | 'AUTH'
      | 'TIMEOUT'
      | 'STREAM_ABORTED'
      | 'PARSE_ERROR'
      | 'EDGE_FUNCTION_ERROR',
  ) {
    super(message)
    this.name = 'NarratorError'
  }
}

const NARRATE_TIMEOUT_MS = 30_000

// ─── Non-streaming call ───────────────────────────────────────────────────────

/**
 * Call the narrate Edge Function and return the full response.
 * Use this for contexts where streaming is not required.
 */
export async function callNarrate(request: NarrateRequest): Promise<NarrateResponse> {
  const { data: { session: authSession } } = await supabase.auth.getSession()
  if (!authSession?.access_token) {
    throw new NarratorError('Not authenticated.', 'AUTH')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), NARRATE_TIMEOUT_MS)

  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/narrate`,
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
      throw new NarratorError(
        `Edge Function returned ${res.status}: ${body.slice(0, 200)}`,
        'EDGE_FUNCTION_ERROR',
      )
    }

    const json = await res.json() as NarrateResponse
    return json
  } catch (err) {
    if (err instanceof NarratorError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NarratorError('Request timed out after 30s.', 'TIMEOUT')
    }
    throw new NarratorError(
      err instanceof Error ? err.message : 'Network error.',
      'NETWORK',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Streaming call ───────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (response: NarrateResponse) => void
  onError: (err: NarratorError) => void
}

/**
 * Call the narrate Edge Function with streaming enabled.
 * The Edge Function sends SSE tokens; onToken fires for each.
 * When the stream is complete (data: [DONE]), the full NarrateResponse is
 * returned via the final SSE event containing the JSON payload.
 *
 * Returns an AbortController so the caller can cancel the stream.
 */
export function callNarrateStreaming(
  request: NarrateRequest,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController()

  void (async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) {
        callbacks.onError(new NarratorError('Not authenticated.', 'AUTH'))
        return
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/narrate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'X-Stream': 'true',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      )

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        callbacks.onError(
          new NarratorError(`Edge Function ${res.status}: ${body.slice(0, 200)}`, 'EDGE_FUNCTION_ERROR'),
        )
        return
      }

      const contentType = res.headers.get('content-type') ?? ''

      // Non-streaming fallback: Edge Function returned JSON directly
      if (!contentType.includes('text/event-stream')) {
        const json = await res.json() as NarrateResponse
        callbacks.onToken(json.narration)
        callbacks.onDone(json)
        return
      }

      // Streaming: read SSE line by line
      const reader = res.body?.getReader()
      if (!reader) {
        callbacks.onError(new NarratorError('No response body.', 'STREAM_ABORTED'))
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let finalResponse: NarrateResponse | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()

          if (payload === '[DONE]') {
            if (finalResponse) callbacks.onDone(finalResponse)
            return
          }

          if (payload.startsWith('[ERROR]')) {
            callbacks.onError(
              new NarratorError(payload.slice(7).trim(), 'EDGE_FUNCTION_ERROR'),
            )
            return
          }

          // Final event: full JSON response
          if (payload.startsWith('{')) {
            try {
              finalResponse = JSON.parse(payload) as NarrateResponse
            } catch {
              callbacks.onError(new NarratorError('Failed to parse final response.', 'PARSE_ERROR'))
              return
            }
            continue
          }

          // Regular token
          callbacks.onToken(payload)
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        callbacks.onError(new NarratorError('Stream cancelled.', 'STREAM_ABORTED'))
        return
      }
      callbacks.onError(
        new NarratorError(err instanceof Error ? err.message : 'Stream error.', 'NETWORK'),
      )
    }
  })()

  return controller
}
