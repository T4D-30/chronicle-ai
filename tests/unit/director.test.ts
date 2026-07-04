/**
 * Director Tests — Phase 2.4
 *
 * Verifies response parsing, sanitization, signal logging, and fallback narration.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseDirectorResponse, buildFallbackNarration } from '@/lib/ai/director'
import type { NarrateResponse } from '@/lib/ai/promptBuilder'

function makeResponse(overrides: Partial<NarrateResponse> = {}): NarrateResponse {
  return {
    narration: 'The lock clicks open. Inside: darkness and the smell of old stone.',
    worldStateUpdates: {},
    directorConfigUpdates: {},
    suggestedActions: ['Enter the vault', 'Listen before stepping in', 'Check for traps'],
    combatTriggered: false,
    mapUpdate: null,
    turnId: 'turn-uuid-1',
    ...overrides,
  }
}

describe('parseDirectorResponse — basic fields', () => {
  it('returns narration from response', () => {
    const result = parseDirectorResponse(makeResponse())
    expect(result.narration).toBe('The lock clicks open. Inside: darkness and the smell of old stone.')
  })

  it('returns turnId', () => {
    const result = parseDirectorResponse(makeResponse())
    expect(result.turnId).toBe('turn-uuid-1')
  })

  it('returns suggestedActions array', () => {
    const result = parseDirectorResponse(makeResponse())
    expect(result.suggestedActions).toHaveLength(3)
    expect(result.suggestedActions[0]).toBe('Enter the vault')
  })

  it('returns combatTriggered false by default', () => {
    const result = parseDirectorResponse(makeResponse())
    expect(result.combatTriggered).toBe(false)
  })

  it('returns worldStateUpdates', () => {
    const result = parseDirectorResponse(makeResponse({ worldStateUpdates: { vault_door: 'open' } }))
    expect(result.worldStateUpdates).toEqual({ vault_door: 'open' })
  })

  it('returns directorConfigUpdates (Phase 9.2 — Quest Log / Codex)', () => {
    const result = parseDirectorResponse(makeResponse({
      directorConfigUpdates: { newThreads: [{ id: 't1', title: 'Find the merchant' }] },
    }))
    expect(result.directorConfigUpdates).toEqual({ newThreads: [{ id: 't1', title: 'Find the merchant' }] })
  })
})

describe('parseDirectorResponse — sanitization', () => {
  it('trims narration whitespace', () => {
    const result = parseDirectorResponse(makeResponse({ narration: '  text  ' }))
    expect(result.narration).toBe('text')
  })

  it('caps narration at 4000 chars', () => {
    const long = 'x'.repeat(5000)
    const result = parseDirectorResponse(makeResponse({ narration: long }))
    expect(result.narration.length).toBe(4000)
  })

  it('caps suggested actions at 4', () => {
    const result = parseDirectorResponse(makeResponse({
      suggestedActions: ['a', 'b', 'c', 'd', 'e'],
    }))
    expect(result.suggestedActions.length).toBe(4)
  })

  it('caps each action at 120 chars', () => {
    const long = 'y'.repeat(200)
    const result = parseDirectorResponse(makeResponse({ suggestedActions: [long] }))
    expect(result.suggestedActions[0].length).toBe(120)
  })

  it('filters empty action strings', () => {
    const result = parseDirectorResponse(makeResponse({ suggestedActions: ['valid', '', '  '] }))
    expect(result.suggestedActions).toEqual(['valid'])
  })

  it('handles non-array suggestedActions gracefully', () => {
    const result = parseDirectorResponse(makeResponse({ suggestedActions: null as never }))
    expect(result.suggestedActions).toEqual([])
  })

  it('handles missing worldStateUpdates gracefully', () => {
    const result = parseDirectorResponse(makeResponse({ worldStateUpdates: null as never }))
    expect(result.worldStateUpdates).toEqual({})
  })

  it('handles missing directorConfigUpdates gracefully', () => {
    const result = parseDirectorResponse(makeResponse({ directorConfigUpdates: null as never }))
    expect(result.directorConfigUpdates).toEqual({})
  })
})

describe('parseDirectorResponse — combat signal', () => {
  it('returns combatTriggered:true and logs info', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const result = parseDirectorResponse(makeResponse({ combatTriggered: true }))
    expect(result.combatTriggered).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('combatTriggered'))
    consoleSpy.mockRestore()
  })
})

describe('parseDirectorResponse — map signal', () => {
  it('logs mapUpdate signal', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    parseDirectorResponse(makeResponse({ mapUpdate: { newRoom: 'vault' } }))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('mapUpdate'))
    consoleSpy.mockRestore()
  })
})

describe('buildFallbackNarration', () => {
  it('returns a string', () => {
    expect(typeof buildFallbackNarration(new Error('Network error'))).toBe('string')
  })

  it('includes the error message for short benign errors', () => {
    const result = buildFallbackNarration(new Error('Rate limit exceeded.'))
    expect(result).toContain('Rate limit exceeded.')
  })

  it('returns generic message for unknown errors', () => {
    const result = buildFallbackNarration({ weird: true })
    expect(result).toContain('momentarily silent')
  })

  it('returns generic message for errors with stack traces', () => {
    const err = new Error('Something at line 45')
    err.message = 'at line 45 in stack trace detail'
    const result = buildFallbackNarration(err)
    // Stack-like messages get the generic fallback
    expect(result).toMatch(/momentarily silent|Director unavailable/)
  })
})
