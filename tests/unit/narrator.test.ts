/**
 * narrator.ts — SSE streaming parse tests
 *
 * Mocks global fetch and supabase.auth.getSession() directly — this is the
 * client-side HTTP-calling layer, not the Edge Function itself (which
 * cannot run in this environment; it's Deno-only, same as narrate/index.ts,
 * confirmed unreachable from Vitest by every prior phase's own precedent).
 *
 * These tests exist to lock in the "[FINAL] " sentinel protocol: the final
 * response must only ever be recognized by that explicit marker, never by
 * sniffing whether a payload starts with '{' — ordinary streamed tokens can
 * also start with '{' (nested JSON fragments), which previously caused
 * "Failed to parse final response." on turns where the Director populated
 * any array field (npcUpdates, newLocations, scheduledEventsToAdd, etc).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase/client'
import { callNarrateStreaming, type StreamCallbacks } from '@/lib/ai/narrator'
import type { NarrateRequest, NarrateResponse } from '@/lib/ai/promptBuilder'

const VALID_REQUEST = {
  sessionId: 'session-1',
  mode: 'exploration',
  playerInput: 'look around',
  character: {},
  directorConfig: { tone: 'heroic', difficulty: 'standard', rulesStyle: 'standard', hiddenArc: '' },
  worldContext: {
    campaignTitle: 'Test Campaign',
    campaignDescription: null,
    worldTime: null,
    activeNpcs: [],
    currentLocation: null,
    recentTurns: [],
    activeQuestDigest: [],
    knownNpcDigest: [],
  },
} as unknown as NarrateRequest

const VALID_FINAL_RESPONSE: NarrateResponse = {
  narration: 'Full narration.',
  worldStateUpdates: {},
  directorConfigUpdates: {},
  suggestedActions: ['Look around', 'Move on'],
  combatTriggered: false,
  mapUpdate: null,
  turnId: 'turn-1',
} as unknown as NarrateResponse

/** Builds a fetch-mock body whose reader yields each string chunk in order. */
function makeSSEBody(chunks: string[]) {
  let index = 0
  const encoder = new TextEncoder()
  return {
    getReader: () => ({
      read: async () => {
        if (index < chunks.length) {
          const value = encoder.encode(chunks[index])
          index++
          return { done: false, value }
        }
        return { done: true, value: undefined }
      },
    }),
  }
}

function mockStreamingFetch(chunks: string[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: makeSSEBody(chunks),
  } as unknown as Response)
}

/** Runs callNarrateStreaming and resolves once a terminal callback fires. */
function runStreaming(request: NarrateRequest) {
  return new Promise<{ tokens: string[]; result?: NarrateResponse; error?: Error }>((resolve) => {
    const tokens: string[] = []
    const callbacks: StreamCallbacks = {
      onToken: (t) => tokens.push(t),
      onDone: (response) => resolve({ tokens, result: response }),
      onError: (err) => resolve({ tokens, error: err }),
    }
    callNarrateStreaming(request, callbacks)
  })
}

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'fake-token' } },
    error: null,
  } as never)
})

describe('callNarrateStreaming — final response detection', () => {
  it('does not treat a mid-stream token starting with "{" as the final response', async () => {
    mockStreamingFetch([
      'data: Hello, adventurer.\n\n',
      'data: {"nested": fragment, not real JSON\n\n',
      `data: [FINAL] ${JSON.stringify(VALID_FINAL_RESPONSE)}\n\n`,
      'data: [DONE]\n\n',
    ])

    const { tokens, result, error } = await runStreaming(VALID_REQUEST)

    expect(error).toBeUndefined()
    expect(result).toEqual(VALID_FINAL_RESPONSE)
    expect(tokens).toContain('Hello, adventurer.')
    expect(tokens).toContain('{"nested": fragment, not real JSON')
  })

  it('does not treat a complete, self-valid JSON token as the final response', async () => {
    // A raw streamed fragment that happens to be complete, valid JSON on
    // its own (e.g. a fully-streamed nested object) must still be treated
    // as an ordinary token, not the final response — only the explicit
    // "[FINAL] " marker may set the final response.
    mockStreamingFetch([
      'data: {"id":"npc-1","name":"Aldric"}\n\n',
      `data: [FINAL] ${JSON.stringify(VALID_FINAL_RESPONSE)}\n\n`,
      'data: [DONE]\n\n',
    ])

    const { tokens, result, error } = await runStreaming(VALID_REQUEST)

    expect(error).toBeUndefined()
    expect(result).toEqual(VALID_FINAL_RESPONSE)
    expect(tokens).toContain('{"id":"npc-1","name":"Aldric"}')
  })

  it('parses the final response correctly when split across multiple stream reads', async () => {
    const finalLine = `data: [FINAL] ${JSON.stringify(VALID_FINAL_RESPONSE)}\n\n`
    const splitPoint = Math.floor(finalLine.length / 2)
    mockStreamingFetch([
      'data: Some narration.\n\n',
      finalLine.slice(0, splitPoint),
      finalLine.slice(splitPoint),
      'data: [DONE]\n\n',
    ])

    const { result, error } = await runStreaming(VALID_REQUEST)

    expect(error).toBeUndefined()
    expect(result).toEqual(VALID_FINAL_RESPONSE)
  })

  it('reports PARSE_ERROR when the "[FINAL] " payload itself is malformed JSON, carrying the raw offending payload', async () => {
    mockStreamingFetch([
      'data: [FINAL] {not valid json\n\n',
      'data: [DONE]\n\n',
    ])

    const { result, error } = await runStreaming(VALID_REQUEST)

    expect(result).toBeUndefined()
    expect(error).toMatchObject({ code: 'PARSE_ERROR', rawPayload: '{not valid json' })
  })

  it('reports EDGE_FUNCTION_ERROR on a "[ERROR]" line and stops processing', async () => {
    mockStreamingFetch([
      'data: Some narration.\n\n',
      'data: [ERROR] OpenAI request failed\n\n',
      `data: [FINAL] ${JSON.stringify(VALID_FINAL_RESPONSE)}\n\n`,
      'data: [DONE]\n\n',
    ])

    const { result, error } = await runStreaming(VALID_REQUEST)

    expect(result).toBeUndefined()
    expect(error).toMatchObject({ code: 'EDGE_FUNCTION_ERROR', message: 'OpenAI request failed' })
  })

  it('calls onDone with undefined-safe result only after [DONE], and only using the [FINAL] payload', async () => {
    mockStreamingFetch([
      `data: [FINAL] ${JSON.stringify(VALID_FINAL_RESPONSE)}\n\n`,
      'data: [DONE]\n\n',
    ])

    const { result } = await runStreaming(VALID_REQUEST)
    expect(result?.narration).toBe('Full narration.')
    expect(result?.turnId).toBe('turn-1')
  })
})
