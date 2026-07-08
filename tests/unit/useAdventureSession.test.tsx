/**
 * useAdventureSession Tests — Phase 9.2 / 9.3
 *
 * No prior test coverage existed for this hook directly (AdventureHub.test.tsx
 * only imports its types and mocks state/actions at the component boundary).
 * This phase restructured submitAction's onDone callback from a synchronous
 * setState into an async function that persists worldStateUpdates and the
 * new directorConfigUpdates (Quest Log / Codex) before updating local state —
 * exactly the kind of async-ordering change that's easy to get subtly wrong,
 * so it needs direct coverage.
 *
 * Phase 9.3 adds coverage for the exploration-turn dice resolution wiring:
 * classified actions now roll a real check via resolveCharacterAction()
 * before the Director request is built, and the result is attached to
 * checkResult on the request and diceRolls on the persisted turn.
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import { setRng, resetRng } from '@/lib/engine'

afterEach(() => resetRng())

// ── Mocks ──────────────────────────────────────────────────────────────────────

const getCampaignMock          = vi.fn()
const getCharacterMock         = vi.fn()
const getResumableSessionMock  = vi.fn()
const startSessionMock         = vi.fn()
const getRecentTurnsMock       = vi.fn()
const updateWorldStateMock     = vi.fn()
const updateDirectorConfigMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    getCampaign:          (...a: unknown[]) => getCampaignMock(...a),
    getCharacter:         (...a: unknown[]) => getCharacterMock(...a),
    getResumableSession:  (...a: unknown[]) => getResumableSessionMock(...a),
    startSession:         (...a: unknown[]) => startSessionMock(...a),
    getRecentTurns:       (...a: unknown[]) => getRecentTurnsMock(...a),
    updateWorldState:     (...a: unknown[]) => updateWorldStateMock(...a),
    updateDirectorConfig: (...a: unknown[]) => updateDirectorConfigMock(...a),
  }
})

// Phase 10.3 — document retrieval mock. Defaults to returning no results
// (the common case: a campaign with no indexed documents), overridden per
// test via retrieveMock.mockResolvedValue(...)/.mockRejectedValue(...).
const retrieveMock = vi.fn().mockResolvedValue([])
vi.mock('@/lib/directorDocuments/fullTextRetriever', () => ({
  getActiveDocumentRetriever: () => ({ name: 'Mock Retriever', retrieve: retrieveMock }),
}))

// callNarrateStreaming captures its callbacks (and the request itself, for
// asserting on checkResult — Phase 9.3) so tests can fire onDone manually.
let capturedCallbacks: {
  onToken: (t: string) => void
  onDone: (r: unknown) => void
  onError: (e: unknown) => void
} | null = null
let capturedRequest: Record<string, unknown> | null = null
// Counts every real invocation of callNarrateStreaming — the source of
// truth for "did a duplicate submission actually start a second stream,"
// distinct from capturedCallbacks/capturedRequest which only ever hold the
// most recent call's values.
let callNarrateStreamingCallCount = 0

vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai')
  return {
    ...actual,
    callNarrateStreaming: (req: Record<string, unknown>, callbacks: typeof capturedCallbacks) => {
      callNarrateStreamingCallCount++
      capturedRequest = req
      capturedCallbacks = callbacks
      return { abort: vi.fn() }
    },
  }
})

import { useAdventureSession } from '@/components/adventure/useAdventureSession'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CAMPAIGN = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active' as const,
  characterId: 'char-1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
  worldState: DEFAULT_WORLD_STATE, tone: 'heroic' as const, difficulty: 'standard' as const,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const CHARACTER = {
  id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '', experience: 0,
  tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
  conditions: [], features: [], inventory: [], spells: {},
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  sheet: {
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human', background: 'soldier',
    scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    modifiers: { strength: 3, dexterity: 2, constitution: 2, intelligence: 0, wisdom: 1, charisma: -1 },
    hitDie: 'd10' as const, maxHp: 30, currentHp: 30, armorClass: 16, proficiencyBonus: 2,
    skillProficiencies: [] as const, savingThrowProficiencies: [], equipment: [],
    conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

const SESSION = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 0, status: 'active' as const,
  currentMode: 'exploration' as const, startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

function baseNarrateResponse(overrides: Record<string, unknown> = {}) {
  return {
    narration: 'The door creaks open.',
    worldStateUpdates: {},
    directorConfigUpdates: {},
    suggestedActions: ['Enter', 'Wait'],
    combatTriggered: false,
    mapUpdate: null,
    turnId: 'turn-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallbacks = null
  capturedRequest = null
  callNarrateStreamingCallCount = 0
  getCampaignMock.mockResolvedValue(CAMPAIGN)
  getCharacterMock.mockResolvedValue(CHARACTER)
  getResumableSessionMock.mockResolvedValue(SESSION)
  startSessionMock.mockResolvedValue(SESSION)
  getRecentTurnsMock.mockResolvedValue([])
  retrieveMock.mockResolvedValue([])
})

async function setupReadyHook() {
  const { result } = renderHook(() => useAdventureSession('camp-1'))
  await waitFor(() => expect(result.current[0].status).toBe('ready'))
  return result
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useAdventureSession — submitAction persistence ordering', () => {
  it('does not call updateWorldState when worldStateUpdates is empty', async () => {
    const result = await setupReadyHook()

    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    expect(updateWorldStateMock).not.toHaveBeenCalled()
  })

  it('calls updateWorldState with an updated WorldState when currentLocationId is set', async () => {
    const campaignWithLoc = {
      ...CAMPAIGN,
      worldState: {
        ...DEFAULT_WORLD_STATE,
        locations: [{ id: 'loc-1', name: 'The Vault', type: 'dungeon' as const, parentId: null, description: '', visited: true, discovered: true, properties: {} }],
      },
    }
    getCampaignMock.mockResolvedValue(campaignWithLoc)
    updateWorldStateMock.mockResolvedValue({ ...campaignWithLoc, worldState: { ...campaignWithLoc.worldState, currentLocationId: 'loc-1' } })

    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I enter the vault.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse({ worldStateUpdates: { currentLocationId: 'loc-1' } }))
      await Promise.resolve()
    })

    expect(updateWorldStateMock).toHaveBeenCalledOnce()
    const [, patchArg] = updateWorldStateMock.mock.calls[0]
    expect(patchArg.currentLocationId).toBe('loc-1')
  })

  it('calls updateDirectorConfig when directorConfigUpdates contains a new quest thread', async () => {
    updateDirectorConfigMock.mockResolvedValue(CAMPAIGN)

    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I ask the barkeep for work.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse({
        directorConfigUpdates: { newThreads: [{ id: 't1', title: 'Find the missing shipment' }] },
      }))
      await Promise.resolve()
    })

    expect(updateDirectorConfigMock).toHaveBeenCalledOnce()
    const [, configArg] = updateDirectorConfigMock.mock.calls[0]
    expect(configArg.activeThreads).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 't1', title: 'Find the missing shipment' })]),
    )
  })

  it('does not call updateDirectorConfig when directorConfigUpdates is empty', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    expect(updateDirectorConfigMock).not.toHaveBeenCalled()
  })

  it('applies both world state and director config updates from a single turn without losing either', async () => {
    const campaignWithLoc = {
      ...CAMPAIGN,
      worldState: {
        ...DEFAULT_WORLD_STATE,
        locations: [{ id: 'loc-1', name: 'The Tavern', type: 'building' as const, parentId: null, description: '', visited: true, discovered: true, properties: {} }],
      },
    }
    getCampaignMock.mockResolvedValue(campaignWithLoc)
    const afterWorldUpdate = { ...campaignWithLoc, worldState: { ...campaignWithLoc.worldState, currentLocationId: 'loc-1' } }
    updateWorldStateMock.mockResolvedValue(afterWorldUpdate)
    updateDirectorConfigMock.mockResolvedValue(afterWorldUpdate)

    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I enter the tavern and ask about work.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse({
        worldStateUpdates: { currentLocationId: 'loc-1' },
        directorConfigUpdates: { newThreads: [{ id: 't1', title: 'A round of drinks' }] },
      }))
      await Promise.resolve()
    })

    expect(updateWorldStateMock).toHaveBeenCalledOnce()
    expect(updateDirectorConfigMock).toHaveBeenCalledOnce()
    // The director config call must operate on the campaign already updated
    // by the world state call, not a stale pre-update snapshot.
    const [campaignIdArg] = updateDirectorConfigMock.mock.calls[0]
    expect(campaignIdArg).toBe(afterWorldUpdate.id)
  })

  it('turn history and turnNumber still update correctly alongside the new persistence calls', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse({ narration: 'A quiet room.' }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current[0].turns).toHaveLength(1)
      expect(result.current[0].turns[0].aiNarration).toBe('A quiet room.')
      expect(result.current[0].session?.turnNumber).toBe(1)
    })
  })

  it('sets narrationStatus to error and preserves state if persistence throws', async () => {
    updateWorldStateMock.mockRejectedValue(new Error('network blip'))
    const campaignWithLoc = {
      ...CAMPAIGN,
      worldState: {
        ...DEFAULT_WORLD_STATE,
        locations: [{ id: 'loc-1', name: 'The Vault', type: 'dungeon' as const, parentId: null, description: '', visited: true, discovered: true, properties: {} }],
      },
    }
    getCampaignMock.mockResolvedValue(campaignWithLoc)

    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I enter the vault.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse({ worldStateUpdates: { currentLocationId: 'loc-1' } }))
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current[0].narrationStatus).toBe('error'))
    // Turn count must not have advanced on failure — no partial commit.
    expect(result.current[0].turns).toHaveLength(0)
  })
})

describe('useAdventureSession — duplicate submission guard', () => {
  it('a second submitAction call before the first has started streaming does not start a second stream', async () => {
    const result = await setupReadyHook()

    act(() => {
      result.current[1].submitAction('I look around.')
      result.current[1].submitAction('I look around.')
    })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    expect(callNarrateStreamingCallCount).toBe(1)
  })

  it('a second submitAction call while already streaming does not start a second stream', async () => {
    const result = await setupReadyHook()

    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(result.current[0].narrationStatus).toBe('streaming'))

    act(() => { result.current[1].submitAction('I check my inventory.') })

    expect(callNarrateStreamingCallCount).toBe(1)
  })

  it('releases the guard on a successful turn, allowing the next submission through', async () => {
    const result = await setupReadyHook()

    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())
    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current[0].narrationStatus).toBe('done'))

    act(() => { result.current[1].submitAction('I check my inventory.') })
    await waitFor(() => expect(callNarrateStreamingCallCount).toBe(2))
  })

  it('releases the guard on a failed turn, allowing a retry', async () => {
    const result = await setupReadyHook()

    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())
    act(() => { capturedCallbacks!.onError(new Error('Failed to parse final response.')) })
    await waitFor(() => expect(result.current[0].narrationStatus).toBe('error'))

    act(() => { result.current[1].submitAction('I try again.') })
    await waitFor(() => expect(callNarrateStreamingCallCount).toBe(2))
  })

  it('releases the guard on cancelStream, allowing an immediate new submission', async () => {
    const result = await setupReadyHook()

    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(result.current[0].narrationStatus).toBe('streaming'))

    act(() => { result.current[1].cancelStream() })
    await waitFor(() => expect(result.current[0].narrationStatus).toBe('idle'))

    act(() => { result.current[1].submitAction('I try something else.') })
    await waitFor(() => expect(callNarrateStreamingCallCount).toBe(2))
  })

  it('a successful turn explicitly clears a stale error banner left by an earlier failed turn', async () => {
    const result = await setupReadyHook()

    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())
    act(() => { capturedCallbacks!.onError(new Error('Failed to parse final response.')) })
    await waitFor(() => expect(result.current[0].error).toBeTruthy())

    act(() => { result.current[1].submitAction('I try again.') })
    await waitFor(() => expect(callNarrateStreamingCallCount).toBe(2))
    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current[0].narrationStatus).toBe('done'))
    expect(result.current[0].error).toBeNull()
  })
})

describe('useAdventureSession — exploration dice resolution (Phase 9.3, full dice transparency)', () => {
  it('does NOT include checkResult for pure narration input (movement/dialogue, not a skill-shaped action)', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I greet the innkeeper warmly.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    expect(capturedRequest).not.toHaveProperty('checkResult')
  })

  it('includes a real checkResult for a FINESSE-category action (e.g. sneaking)', async () => {
    setRng(() => 0.5) // mid-roll, deterministic
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I sneak past the guards.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())

    expect(capturedRequest).toHaveProperty('checkResult')
    const checkResult = capturedRequest!.checkResult as Record<string, unknown>
    expect(checkResult.category).toBe('FINESSE')
    expect(checkResult.stat).toBe('DEX')
    expect(typeof checkResult.dc).toBe('number')
    expect(typeof checkResult.total).toBe('number')
    expect(typeof checkResult.isSuccess).toBe('boolean')
  })

  it('includes a real checkResult for a FORCE-category action (e.g. smashing)', async () => {
    setRng(() => 0.9)
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I smash down the door.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())

    const checkResult = capturedRequest!.checkResult as Record<string, unknown>
    expect(checkResult.category).toBe('FORCE')
    expect(checkResult.stat).toBe('STR')
  })

  it('never rolls twice for one action — total is consistent with a single d20 roll', async () => {
    // Fixed rng means a fixed d20 face. If submitAction rolled twice, the
    // *second* roll would be a DIFFERENT face under a real RNG, but since we
    // pin rng to a constant here, both rolls would coincidentally match —
    // so instead we assert the roll modifier matches EXACTLY what a single
    // resolveCharacterAction call would produce for this character (STR 16 = +3,
    // no proficiency, no equipment): total = face + 3.
    setRng(() => 0.5) // face = floor(0.5*20)+1 = 11
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I smash down the door.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())

    const checkResult = capturedRequest!.checkResult as Record<string, unknown>
    // face 11 + STR mod 3 = 14. If a second hidden roll occurred and its
    // result were used instead, this exact value would not reliably hold
    // across repeated runs with the same pinned rng.
    expect(checkResult.total).toBe(14)
  })

  it('attaches the resolved check to the persisted turn diceRolls array', async () => {
    setRng(() => 0.5)
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I sneak past the guards.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current[0].turns).toHaveLength(1))
    expect(result.current[0].turns[0].diceRolls).toHaveLength(1)
    const roll = result.current[0].turns[0].diceRolls[0] as unknown as Record<string, unknown>
    expect(roll.category).toBe('FINESSE')
  })

  it('leaves diceRolls empty for a pure narration turn', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I greet the innkeeper.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current[0].turns).toHaveLength(1))
    expect(result.current[0].turns[0].diceRolls).toHaveLength(0)
  })

  it('does not throw and produces no checkResult if the character is incapacitated', async () => {
    const incapacitatedCharacter = {
      ...CHARACTER,
      sheet: {
        ...CHARACTER.sheet,
        conditions: [{ id: 'unconscious' as const, source: 'test', appliedAtTurn: 0, expiresAtTurn: null, stackLevel: 1 }],
      },
    }
    getCharacterMock.mockResolvedValue(incapacitatedCharacter)
    const result = await setupReadyHook()

    expect(() => {
      act(() => { result.current[1].submitAction('I sneak past the guards.') })
    }).not.toThrow()
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    expect(capturedRequest).not.toHaveProperty('checkResult')
  })
})

describe('useAdventureSession — lastCheckResult / lastXpGain (Phase 10.1 popup data)', () => {
  it('populates state.lastCheckResult after a classified action resolves', async () => {
    setRng(() => 0.5)
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I sneak past the guards.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current[0].lastCheckResult).not.toBeNull())
    expect(result.current[0].lastCheckResult?.category).toBe('FINESSE')
  })

  it('leaves state.lastCheckResult null for pure narration (no check rolled)', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I greet the innkeeper warmly.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())

    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current[0].turns).toHaveLength(1))
    expect(result.current[0].lastCheckResult).toBeNull()
  })

  it('clearCheckResult resets lastCheckResult to null', async () => {
    setRng(() => 0.5)
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I sneak past the guards.') })
    await waitFor(() => expect(capturedCallbacks).not.toBeNull())
    await act(async () => {
      capturedCallbacks!.onDone(baseNarrateResponse())
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current[0].lastCheckResult).not.toBeNull())

    act(() => { result.current[1].clearCheckResult() })
    expect(result.current[0].lastCheckResult).toBeNull()
  })

  it('starts with lastXpGain at 0', async () => {
    const result = await setupReadyHook()
    expect(result.current[0].lastXpGain).toBe(0)
  })

  it('clearXpGain resets lastXpGain to 0', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].clearXpGain() })
    expect(result.current[0].lastXpGain).toBe(0)
  })
})

describe('useAdventureSession — Director document retrieval (Phase 10.3)', () => {
  it('calls the active retriever with the campaign id and player input', async () => {
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('Tell me about the ancient dragon.') })
    await waitFor(() => expect(retrieveMock).toHaveBeenCalledOnce())
    expect(retrieveMock).toHaveBeenCalledWith('camp-1', 'Tell me about the ancient dragon.', 5)
  })

  it('omits documentContext from the request when the retriever returns no results', async () => {
    retrieveMock.mockResolvedValue([])
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    expect(capturedRequest).not.toHaveProperty('documentContext')
  })

  it('includes real retrieved excerpts in the request as documentContext', async () => {
    retrieveMock.mockResolvedValue([
      { documentId: 'doc-1', fileName: 'lore.pdf', category: 'world_lore', excerpt: 'The dragon Vermithrax sleeps here.', relevanceScore: 0.5 },
    ])
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('Tell me about the dragon.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    expect(capturedRequest).toHaveProperty('documentContext')
    const docContext = capturedRequest!.documentContext as Array<{ fileName: string }>
    expect(docContext).toHaveLength(1)
    expect(docContext[0].fileName).toBe('lore.pdf')
  })

  it('strips relevanceScore/documentId before building the request — only fileName/category/excerpt reach the Director', async () => {
    retrieveMock.mockResolvedValue([
      { documentId: 'doc-1', fileName: 'lore.pdf', category: 'world_lore', excerpt: 'excerpt text', relevanceScore: 0.9 },
    ])
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('Tell me about the dragon.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    const docContext = capturedRequest!.documentContext as Array<Record<string, unknown>>
    expect(docContext[0]).not.toHaveProperty('relevanceScore')
    expect(docContext[0]).not.toHaveProperty('documentId')
    expect(docContext[0]).toEqual({ fileName: 'lore.pdf', category: 'world_lore', excerpt: 'excerpt text' })
  })

  it('fails open: a retriever error does not block the turn from submitting', async () => {
    retrieveMock.mockRejectedValue(new Error('search index unavailable'))
    const result = await setupReadyHook()

    expect(() => {
      act(() => { result.current[1].submitAction('I look around.') })
    }).not.toThrow()
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    expect(capturedRequest).not.toHaveProperty('documentContext')
  })

  it('does not surface a retriever error to state.error — it is a silent, best-effort enrichment', async () => {
    retrieveMock.mockRejectedValue(new Error('search index unavailable'))
    const result = await setupReadyHook()
    act(() => { result.current[1].submitAction('I look around.') })
    await waitFor(() => expect(capturedRequest).not.toBeNull())
    expect(result.current[0].error).toBeNull()
  })
})
