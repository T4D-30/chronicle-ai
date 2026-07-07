/**
 * adventureController Tests
 *
 * Direct unit coverage for the Adventure Controller, isolated from React.
 * Covers: levelUpCharacter, loadAdventure, buildCombatState, and
 * commitCombatResult. runPlayerTurn is covered separately.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { setRng, resetRng, isReadyToLevel, summariseCombatResult, makeCombatLogEntry } from '@/lib/engine'
import type { CombatResult } from '@/lib/engine'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

afterEach(() => resetRng())

// ── Mocks ──────────────────────────────────────────────────────────────────────

const getCampaignMock         = vi.fn()
const getCharacterMock        = vi.fn()
const getResumableSessionMock = vi.fn()
const startSessionMock        = vi.fn()
const getRecentTurnsMock      = vi.fn()
const updateCharacterMock     = vi.fn()
const appendTurnMock          = vi.fn()
const updateWorldStateMock    = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    getCampaign:         (...a: unknown[]) => getCampaignMock(...a),
    getCharacter:        (...a: unknown[]) => getCharacterMock(...a),
    getResumableSession: (...a: unknown[]) => getResumableSessionMock(...a),
    startSession:        (...a: unknown[]) => startSessionMock(...a),
    getRecentTurns:      (...a: unknown[]) => getRecentTurnsMock(...a),
    updateCharacter:     (...a: unknown[]) => updateCharacterMock(...a),
    appendTurn:          (...a: unknown[]) => appendTurnMock(...a),
    updateWorldState:    (...a: unknown[]) => updateWorldStateMock(...a),
  }
})

import {
  loadAdventure,
  levelUpCharacter,
  buildCombatState,
  commitCombatResult,
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
