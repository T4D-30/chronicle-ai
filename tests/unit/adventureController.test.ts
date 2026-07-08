/**
 * adventureController Tests
 *
 * Direct unit coverage for the Adventure Controller, isolated from React.
 * Covers: levelUpCharacter, loadAdventure, buildCombatState,
 * commitCombatResult, and runPlayerTurn.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { setRng, resetRng, isReadyToLevel, summariseCombatResult, makeCombatLogEntry } from '@/lib/engine'
import type { CombatResult } from '@/lib/engine'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

afterEach(() => resetRng())

// ── Mocks ──────────────────────────────────────────────────────────────────────

const getCampaignMock          = vi.fn()
const getCharacterMock         = vi.fn()
const getResumableSessionMock  = vi.fn()
const startSessionMock         = vi.fn()
const getRecentTurnsMock       = vi.fn()
const updateCharacterMock      = vi.fn()
const appendTurnMock           = vi.fn()
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
    updateCharacter:      (...a: unknown[]) => updateCharacterMock(...a),
    appendTurn:           (...a: unknown[]) => appendTurnMock(...a),
    updateWorldState:     (...a: unknown[]) => updateWorldStateMock(...a),
    updateDirectorConfig: (...a: unknown[]) => updateDirectorConfigMock(...a),
  }
})

// runPlayerTurn's document retrieval — defaults to no results; individual
// tests override via retrieveMock.mockResolvedValue/mockRejectedValueOnce.
const retrieveMock = vi.fn().mockResolvedValue([])
vi.mock('@/lib/directorDocuments/fullTextRetriever', () => ({
  getActiveDocumentRetriever: () => ({ name: 'Mock Retriever', retrieve: retrieveMock }),
}))

// callNarrateStreaming captures its request/callbacks so tests can fire
// onDone/onError manually. buildNarrateRequest and parseDirectorResponse
// stay real (importActual) — only the network-bound streaming call is stubbed.
let capturedRequest: Record<string, unknown> | null = null
let capturedCallbacks: {
  onToken: (t: string) => void
  onDone: (r: unknown) => void
  onError: (e: unknown) => void
} | null = null

vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai')
  return {
    ...actual,
    callNarrateStreaming: (req: Record<string, unknown>, callbacks: typeof capturedCallbacks) => {
      capturedRequest = req
      capturedCallbacks = callbacks
      return { abort: vi.fn() }
    },
  }
})

import {
  loadAdventure,
  levelUpCharacter,
  buildCombatState,
  commitCombatResult,
  runPlayerTurn,
} from '@/lib/adventure/adventureController'

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
    skillProficiencies: [], savingThrowProficiencies: [], equipment: [],
    conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

const SESSION = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 0, status: 'active' as const,
  currentMode: 'exploration' as const, startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

const ENEMY = {
  id: 'goblin-1', name: 'Goblin', isPlayer: false as const,
  maxHp: 7, currentHp: 7, armorClass: 12,
  attackBonus: 4, damageDie: 'd6' as const, damageBonus: 2, dexMod: 2,
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

function baseCombatResult(overrides: Partial<CombatResult> = {}): CombatResult {
  return {
    outcome: 'victory',
    xpAwarded: 50,
    loot: [],
    enemiesDefeated: [],
    rounds: 3,
    finalPlayerHp: 20,
    log: [makeCombatLogEntry(1, 'System', false, 'Combat begins.')],
    endedAt: '2024-01-02T00:00:00Z',
    ...overrides,
  }
}

describe('levelUpCharacter', () => {
  it('persists the patch via updateCharacter and returns the updated record', async () => {
    const patch = { level: 4, currentHp: 34 }
    const updated = { ...CHARACTER, sheet: { ...CHARACTER.sheet, level: 4, currentHp: 34 } }
    updateCharacterMock.mockResolvedValueOnce(updated)

    const result = await levelUpCharacter('char-1', patch)

    expect(updateCharacterMock).toHaveBeenCalledWith('char-1', patch)
    expect(result).toBe(updated)
  })

  it('propagates a persistence failure rather than swallowing it', async () => {
    const err = new Error('write failed')
    updateCharacterMock.mockRejectedValueOnce(err)

    await expect(levelUpCharacter('char-1', { level: 4, currentHp: 34 })).rejects.toThrow('write failed')
  })
})

describe('loadAdventure', () => {
  it('returns nulls without fetching character/session/turns when the campaign has no character', async () => {
    const campaignNoCharacter = { ...CAMPAIGN, characterId: '' }
    getCampaignMock.mockResolvedValueOnce(campaignNoCharacter)

    const result = await loadAdventure('camp-1')

    expect(result).toEqual({ campaign: campaignNoCharacter, character: null, session: null, turns: [] })
    expect(getCharacterMock).not.toHaveBeenCalled()
    expect(getResumableSessionMock).not.toHaveBeenCalled()
    expect(startSessionMock).not.toHaveBeenCalled()
    expect(getRecentTurnsMock).not.toHaveBeenCalled()
  })

  it('resumes an existing session without creating a new one', async () => {
    getCampaignMock.mockResolvedValueOnce(CAMPAIGN)
    getCharacterMock.mockResolvedValueOnce(CHARACTER)
    getResumableSessionMock.mockResolvedValueOnce(SESSION)
    getRecentTurnsMock.mockResolvedValueOnce([])

    const result = await loadAdventure('camp-1')

    expect(startSessionMock).not.toHaveBeenCalled()
    expect(getRecentTurnsMock).toHaveBeenCalledWith(SESSION.id, 20)
    expect(result).toEqual({ campaign: CAMPAIGN, character: CHARACTER, session: SESSION, turns: [] })
  })

  it('starts a new session when no resumable session exists', async () => {
    const newSession = { ...SESSION, id: 'sess-2' }
    getCampaignMock.mockResolvedValueOnce(CAMPAIGN)
    getCharacterMock.mockResolvedValueOnce(CHARACTER)
    getResumableSessionMock.mockResolvedValueOnce(null)
    startSessionMock.mockResolvedValueOnce(newSession)
    getRecentTurnsMock.mockResolvedValueOnce([])

    const result = await loadAdventure('camp-1')

    expect(startSessionMock).toHaveBeenCalledWith('camp-1')
    expect(getRecentTurnsMock).toHaveBeenCalledWith(newSession.id, 20)
    expect(result.session).toBe(newSession)
  })
})

describe('buildCombatState', () => {
  it('places the player in the initiative order alongside the given enemies', () => {
    setRng(() => 0.9) // high roll — deterministic initiative

    const state = buildCombatState(CHARACTER, [ENEMY])

    expect(state.enemies).toEqual([ENEMY])
    expect(state.playerCurrentHp).toBe(CHARACTER.sheet.currentHp)
    expect(state.round).toBe(1)
    expect(state.initiativeOrder.map((e) => e.combatantId).sort()).toEqual(['goblin-1', 'player'].sort())
  })

  it('carries the character\'s current HP into the combat state, not max HP', () => {
    const wounded = { ...CHARACTER, sheet: { ...CHARACTER.sheet, currentHp: 12 } }

    const state = buildCombatState(wounded, [ENEMY])

    expect(state.playerCurrentHp).toBe(12)
  })
})

describe('commitCombatResult', () => {
  it('victory: merges loot into inventory, awards XP/HP, and reports readyToLevel', async () => {
    const loot = [{ id: 'loot-1', name: 'Rusty Dagger', quantity: 1, goldValue: 5, description: 'A worn blade.' }]
    const result = baseCombatResult({
      outcome: 'victory',
      xpAwarded: 9999, // deliberately large — forces isReadyToLevel true regardless of the XP table
      loot,
      enemiesDefeated: [ENEMY],
      finalPlayerHp: 18,
    })
    const updatedCharacter = { ...CHARACTER, experience: CHARACTER.experience + result.xpAwarded }
    updateCharacterMock.mockResolvedValueOnce(updatedCharacter)
    const newTurn = { id: 'turn-1', sessionId: SESSION.id, turnNumber: 1, playerInput: '', aiNarration: '', diceRolls: [], mode: 'combat' as const, createdAt: '2024-01-02T00:00:00Z' }
    appendTurnMock.mockResolvedValueOnce(newTurn)

    const commitResult = await commitCombatResult({ character: CHARACTER, session: SESSION, campaign: CAMPAIGN, result })

    expect(updateCharacterMock).toHaveBeenCalledWith('char-1', {
      experience: CHARACTER.experience + result.xpAwarded,
      currentHp: 18,
      inventory: [{ id: 'loot-1', name: 'Rusty Dagger', quantity: 1, weight: 0, equipped: false, description: 'A worn blade.' }],
    })
    expect(appendTurnMock).toHaveBeenCalledWith(SESSION.id, {
      playerInput: `[VICTORY] ${ENEMY.name}`,
      aiNarration: summariseCombatResult(result),
      diceRolls: [],
      mode: 'combat',
    })
    expect(commitResult.updatedCharacter).toBe(updatedCharacter)
    expect(commitResult.newTurn).toBe(newTurn)
    expect(commitResult.xpAwarded).toBe(result.xpAwarded)
    expect(commitResult.readyToLevel).toBe(isReadyToLevel(CHARACTER.experience + result.xpAwarded, CHARACTER.sheet.level))
  })

  it('defeat/fled: label the turn and fall back to "Combat ended." when nothing was defeated', async () => {
    updateCharacterMock.mockResolvedValue(CHARACTER)
    appendTurnMock.mockResolvedValue({ id: 'turn-1', sessionId: SESSION.id, turnNumber: 1, playerInput: '', aiNarration: '', diceRolls: [], mode: 'combat' as const, createdAt: '2024-01-02T00:00:00Z' })

    const defeat = baseCombatResult({ outcome: 'defeat', enemiesDefeated: [] })
    await commitCombatResult({ character: CHARACTER, session: SESSION, campaign: CAMPAIGN, result: defeat })
    expect(appendTurnMock).toHaveBeenLastCalledWith(SESSION.id, expect.objectContaining({
      playerInput: '[DEFEAT] Combat ended.',
    }))

    const fled = baseCombatResult({ outcome: 'fled', enemiesDefeated: [] })
    await commitCombatResult({ character: CHARACTER, session: SESSION, campaign: CAMPAIGN, result: fled })
    expect(appendTurnMock).toHaveBeenLastCalledWith(SESSION.id, expect.objectContaining({
      playerInput: '[FLED] Combat ended.',
    }))
  })

  it('applies world state updates only when the log is non-empty AND enemies were defeated', async () => {
    updateCharacterMock.mockResolvedValue(CHARACTER)
    appendTurnMock.mockResolvedValue({ id: 'turn-1', sessionId: SESSION.id, turnNumber: 1, playerInput: '', aiNarration: '', diceRolls: [], mode: 'combat' as const, createdAt: '2024-01-02T00:00:00Z' })
    updateWorldStateMock.mockResolvedValue(CAMPAIGN)

    // A pre-existing NPC matching the defeated enemy's id, so the merge in
    // applyWorldStateUpdate() has something observable to flip to isAlive: false.
    const campaignWithNpc = {
      ...CAMPAIGN,
      worldState: {
        ...CAMPAIGN.worldState,
        npcs: [{ id: ENEMY.id, name: ENEMY.name, locationId: null, isAlive: true, combatStats: null }],
      },
    }

    // Case A: non-empty log + defeated enemies → world state IS updated,
    // and the matching NPC's isAlive flips to false.
    const withDefeats = baseCombatResult({
      log: [makeCombatLogEntry(1, 'System', false, 'Combat begins.')],
      enemiesDefeated: [ENEMY],
    })
    await commitCombatResult({ character: CHARACTER, session: SESSION, campaign: campaignWithNpc, result: withDefeats })
    expect(updateWorldStateMock).toHaveBeenCalledWith(campaignWithNpc.id, expect.objectContaining({
      npcs: [expect.objectContaining({ id: ENEMY.id, isAlive: false })],
    }))
    updateWorldStateMock.mockClear()

    // Case B: empty log → world state is NOT updated, even with defeated enemies.
    const emptyLog = baseCombatResult({ log: [], enemiesDefeated: [ENEMY] })
    await commitCombatResult({ character: CHARACTER, session: SESSION, campaign: CAMPAIGN, result: emptyLog })
    expect(updateWorldStateMock).not.toHaveBeenCalled()

    // Case C: non-empty log but no defeated enemies → world state is NOT
    // updated either, since npcUpdates would be an empty array. The gate is
    // effectively "were enemies defeated", not "is there a log" — preserved
    // as-is, not a behavior this test set is meant to fix.
    const noDefeats = baseCombatResult({
      log: [makeCombatLogEntry(1, 'System', false, 'Combat begins.')],
      enemiesDefeated: [],
    })
    await commitCombatResult({ character: CHARACTER, session: SESSION, campaign: CAMPAIGN, result: noDefeats })
    expect(updateWorldStateMock).not.toHaveBeenCalled()
  })
})

describe('runPlayerTurn', () => {
  function makeCallbacks() {
    return {
      onToken: vi.fn(),
      onStreamStart: vi.fn(),
      onResult: vi.fn(),
      onError: vi.fn(),
    }
  }

  beforeEach(() => {
    capturedRequest = null
    capturedCallbacks = null
    retrieveMock.mockReset().mockResolvedValue([])
    updateWorldStateMock.mockReset()
    updateDirectorConfigMock.mockReset()
  })

  it('degrades to an empty documentContext when the document retriever throws, without blocking the turn', async () => {
    retrieveMock.mockRejectedValueOnce(new Error('retriever down'))
    const callbacks = makeCallbacks()

    runPlayerTurn(
      { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I look around.' },
      callbacks,
    )
    await vi.waitFor(() => expect(capturedRequest).not.toBeNull())

    // buildNarrateRequest only includes documentContext when non-empty (same
    // conditional-spread pattern as checkResult) — an empty array from the
    // failed retrieval means the key is omitted entirely, not present as [].
    expect(capturedRequest).not.toHaveProperty('documentContext')
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('omits checkResult from the narrate request for an unclassified (UNKNOWN) action', async () => {
    const callbacks = makeCallbacks()

    runPlayerTurn(
      { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I greet the innkeeper warmly.' },
      callbacks,
    )
    await vi.waitFor(() => expect(capturedRequest).not.toBeNull())

    expect(capturedRequest).not.toHaveProperty('checkResult')
  })

  it('includes a real checkResult for a classified (FINESSE) action', async () => {
    setRng(() => 0.5) // mid-roll, deterministic
    const callbacks = makeCallbacks()

    runPlayerTurn(
      { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I sneak past the guards.' },
      callbacks,
    )
    await vi.waitFor(() => expect(capturedRequest).not.toBeNull())

    expect(capturedRequest).toHaveProperty('checkResult')
    const checkResult = capturedRequest!.checkResult as Record<string, unknown>
    expect(checkResult.category).toBe('FINESSE')
    expect(checkResult.stat).toBe('DEX')
  })

  describe('persistence ordering', () => {
    const campaignWithLoc = {
      ...CAMPAIGN,
      worldState: {
        ...CAMPAIGN.worldState,
        locations: [{ id: 'loc-1', name: 'The Vault', type: 'dungeon' as const, parentId: null, description: '', visited: true, discovered: true, properties: {} }],
      },
    }

    it('persists only world state when only worldStateUpdates are present', async () => {
      updateWorldStateMock.mockResolvedValueOnce({ ...campaignWithLoc, worldState: { ...campaignWithLoc.worldState, currentLocationId: 'loc-1' } })
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: campaignWithLoc, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I enter the vault.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse({ worldStateUpdates: { currentLocationId: 'loc-1' } }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).toHaveBeenCalledOnce()
      expect(updateDirectorConfigMock).not.toHaveBeenCalled()
    })

    it('persists only director config when only directorConfigUpdates are present', async () => {
      updateDirectorConfigMock.mockResolvedValueOnce(CAMPAIGN)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I ask the barkeep for work.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse({
        directorConfigUpdates: { newThreads: [{ id: 't1', title: 'Find the missing shipment' }] },
      }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).not.toHaveBeenCalled()
      expect(updateDirectorConfigMock).toHaveBeenCalledOnce()
    })

    it('persists both updates from a single turn, applying directorConfig on top of the already-updated campaign', async () => {
      const afterWorldUpdate = { ...campaignWithLoc, worldState: { ...campaignWithLoc.worldState, currentLocationId: 'loc-1' } }
      updateWorldStateMock.mockResolvedValueOnce(afterWorldUpdate)
      updateDirectorConfigMock.mockResolvedValueOnce(afterWorldUpdate)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: campaignWithLoc, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I enter the vault and ask about work.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse({
        worldStateUpdates: { currentLocationId: 'loc-1' },
        directorConfigUpdates: { newThreads: [{ id: 't1', title: 'A round of drinks' }] },
      }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).toHaveBeenCalledOnce()
      expect(updateDirectorConfigMock).toHaveBeenCalledOnce()
      // The director config call must operate on the campaign already
      // updated by the world state call, not a stale pre-update snapshot.
      const [campaignIdArg] = updateDirectorConfigMock.mock.calls[0]
      expect(campaignIdArg).toBe(afterWorldUpdate.id)
    })

    it('persists neither update when the Director reports no world or config changes', async () => {
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I look around.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse())
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).not.toHaveBeenCalled()
      expect(updateDirectorConfigMock).not.toHaveBeenCalled()
    })
  })

  describe('world tick (Phase 12.1 Step 2)', () => {
    function makeScheduledEvent(overrides: Record<string, unknown> = {}) {
      return {
        id: 'evt-1',
        description: 'The bridge collapses.',
        triggerAtTurn: 1,
        triggered: false,
        directorHint: 'Describe the bridge giving way.',
        ...overrides,
      }
    }

    it('persists the tick and reports firedEvents when a scheduled event is due', async () => {
      const campaignWithEvent = {
        ...CAMPAIGN,
        worldState: { ...CAMPAIGN.worldState, scheduledEvents: [makeScheduledEvent({ triggerAtTurn: 1 })] },
      }
      const afterTick = {
        ...campaignWithEvent,
        worldState: {
          ...campaignWithEvent.worldState,
          scheduledEvents: [makeScheduledEvent({ triggerAtTurn: 1, triggered: true })],
        },
      }
      updateWorldStateMock.mockResolvedValueOnce(afterTick)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: campaignWithEvent, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I look around.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse())
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).toHaveBeenCalledOnce()
      const [, worldStateArg] = updateWorldStateMock.mock.calls[0]
      expect(worldStateArg.scheduledEvents[0].triggered).toBe(true)

      const result = callbacks.onResult.mock.calls[0][0]
      expect(result.firedEvents).toHaveLength(1)
      expect(result.firedEvents[0].id).toBe('evt-1')
    })

    it('does not persist or report fired events when no scheduled event is due', async () => {
      const campaignWithFutureEvent = {
        ...CAMPAIGN,
        worldState: { ...CAMPAIGN.worldState, scheduledEvents: [makeScheduledEvent({ triggerAtTurn: 100 })] },
      }
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: campaignWithFutureEvent, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I look around.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse())
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).not.toHaveBeenCalled()
      const result = callbacks.onResult.mock.calls[0][0]
      expect(result.firedEvents).toEqual([])
    })

    it('ticks on top of the already-updated campaign when a Director world-state change also lands this turn', async () => {
      const campaignWithLocAndEvent = {
        ...CAMPAIGN,
        worldState: {
          ...CAMPAIGN.worldState,
          locations: [{
            id: 'loc-1', name: 'The Vault', type: 'dungeon' as const, parentId: null,
            description: '', visited: true, discovered: true, properties: {},
          }],
          scheduledEvents: [makeScheduledEvent({ triggerAtTurn: 1 })],
        },
      }
      const afterWorldUpdate = {
        ...campaignWithLocAndEvent,
        worldState: { ...campaignWithLocAndEvent.worldState, currentLocationId: 'loc-1' },
      }
      const afterTick = {
        ...afterWorldUpdate,
        worldState: {
          ...afterWorldUpdate.worldState,
          scheduledEvents: [makeScheduledEvent({ triggerAtTurn: 1, triggered: true })],
        },
      }
      updateWorldStateMock
        .mockResolvedValueOnce(afterWorldUpdate)
        .mockResolvedValueOnce(afterTick)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: campaignWithLocAndEvent, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I enter the vault.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse({ worldStateUpdates: { currentLocationId: 'loc-1' } }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).toHaveBeenCalledTimes(2)

      // The tick's persisted worldState must carry forward the Director's
      // currentLocationId change from the first call — proving it ticked
      // on top of the already-updated worldState, not a stale pre-turn one.
      const [, tickWorldStateArg] = updateWorldStateMock.mock.calls[1]
      expect(tickWorldStateArg.currentLocationId).toBe('loc-1')
      expect(tickWorldStateArg.scheduledEvents[0].triggered).toBe(true)

      const result = callbacks.onResult.mock.calls[0][0]
      expect(result.firedEvents).toHaveLength(1)
    })
  })

  describe('Director-scheduled events (Phase 12.1 Step 3)', () => {
    it('persists a Director-scheduled future event without firing it this turn', async () => {
      const afterSchedule = {
        ...CAMPAIGN,
        worldState: {
          ...CAMPAIGN.worldState,
          scheduledEvents: [
            { id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10, triggered: false, directorHint: '', source: 'director' as const },
          ],
        },
      }
      updateWorldStateMock.mockResolvedValueOnce(afterSchedule)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I speak with the merchant.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse({
        worldStateUpdates: {
          scheduledEventsToAdd: [{ id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10 }],
        },
      }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      // Only one write: the schedule-add. SESSION.turnNumber is 0, so the
      // completed turn is 1 — triggerAtTurn 10 is not due, so the tick
      // step finds nothing to fire and never writes a second time.
      expect(updateWorldStateMock).toHaveBeenCalledOnce()

      const result = callbacks.onResult.mock.calls[0][0]
      expect(result.firedEvents).toEqual([])
      expect(result.updatedCampaign.worldState.scheduledEvents[0]).toMatchObject({
        id: 'evt-1', triggerAtTurn: 10, triggered: false,
      })
    })

    it('fires a Director-scheduled event within the same turn when its triggerAtTurn is due', async () => {
      const afterSchedule = {
        ...CAMPAIGN,
        worldState: {
          ...CAMPAIGN.worldState,
          scheduledEvents: [
            { id: 'evt-1', description: 'The bridge repairs complete.', triggerAtTurn: 1, triggered: false, directorHint: '', source: 'director' as const },
          ],
        },
      }
      const afterTick = {
        ...afterSchedule,
        worldState: {
          ...afterSchedule.worldState,
          scheduledEvents: [
            { ...afterSchedule.worldState.scheduledEvents[0], triggered: true },
          ],
        },
      }
      updateWorldStateMock
        .mockResolvedValueOnce(afterSchedule)
        .mockResolvedValueOnce(afterTick)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I wait by the bridge.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      // SESSION.turnNumber is 0, so this completed turn is 1 — scheduling
      // an event due exactly at turn 1 makes it fire on this same turn.
      capturedCallbacks!.onDone(baseNarrateResponse({
        worldStateUpdates: {
          scheduledEventsToAdd: [{ id: 'evt-1', description: 'The bridge repairs complete.', triggerAtTurn: 1 }],
        },
      }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      expect(updateWorldStateMock).toHaveBeenCalledTimes(2)
      const result = callbacks.onResult.mock.calls[0][0]
      expect(result.firedEvents).toHaveLength(1)
      expect(result.firedEvents[0].id).toBe('evt-1')
      expect(result.updatedCampaign.worldState.scheduledEvents[0].triggered).toBe(true)
    })

    it('supports multiple scheduled events, firing only the ones that are due', async () => {
      const afterSchedule = {
        ...CAMPAIGN,
        worldState: {
          ...CAMPAIGN.worldState,
          scheduledEvents: [
            { id: 'evt-due', description: 'A patrol reaches the village.', triggerAtTurn: 1, triggered: false, directorHint: '', source: 'director' as const },
            { id: 'evt-future', description: 'A festival begins.', triggerAtTurn: 50, triggered: false, directorHint: '', source: 'director' as const },
          ],
        },
      }
      const afterTick = {
        ...afterSchedule,
        worldState: {
          ...afterSchedule.worldState,
          scheduledEvents: [
            { ...afterSchedule.worldState.scheduledEvents[0], triggered: true },
            afterSchedule.worldState.scheduledEvents[1],
          ],
        },
      }
      updateWorldStateMock
        .mockResolvedValueOnce(afterSchedule)
        .mockResolvedValueOnce(afterTick)
      const callbacks = makeCallbacks()

      runPlayerTurn(
        { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I look toward the road.' },
        callbacks,
      )
      await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())
      capturedCallbacks!.onDone(baseNarrateResponse({
        worldStateUpdates: {
          scheduledEventsToAdd: [
            { id: 'evt-due', description: 'A patrol reaches the village.', triggerAtTurn: 1 },
            { id: 'evt-future', description: 'A festival begins.', triggerAtTurn: 50 },
          ],
        },
      }))
      await vi.waitFor(() => expect(callbacks.onResult).toHaveBeenCalled())

      const result = callbacks.onResult.mock.calls[0][0]
      expect(result.firedEvents).toHaveLength(1)
      expect(result.firedEvents[0].id).toBe('evt-due')

      const [resolvedDue, resolvedFuture] = result.updatedCampaign.worldState.scheduledEvents
      expect(resolvedDue.triggered).toBe(true)
      expect(resolvedFuture.triggered).toBe(false)
    })
  })

  it('calls onError when the narrate stream itself errors', async () => {
    const callbacks = makeCallbacks()

    runPlayerTurn(
      { campaign: CAMPAIGN, character: CHARACTER, session: SESSION, recentTurns: [], playerInput: 'I look around.' },
      callbacks,
    )
    await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull())

    const err = new Error('stream failed')
    capturedCallbacks!.onError(err)

    expect(callbacks.onError).toHaveBeenCalledWith(err)
  })
})
