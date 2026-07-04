/**
 * Chronicle AI — Session Service Tests
 * Phase 1.4
 *
 * Key behaviors tested:
 *   - startSession marks campaign as active
 *   - appendTurn validates session status before writing
 *   - getRecentTurns returns turns in ascending (chronological) order
 *   - getActiveSession returns null when no active session exists
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockInstance } from 'vitest'

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const resolve = vi.fn().mockResolvedValue(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: resolve,
    maybeSingle: resolve,
    then: (onfulfilled: (v: unknown) => unknown) => resolve().then(onfulfilled),
  }
}

vi.mock('@/lib/supabase/client', () => {
  const fromMock = vi.fn()
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      from: fromMock,
    },
  }
})

import { supabase } from '@/lib/supabase/client'
import {
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  appendTurn,
  getRecentTurns,
  getActiveSession,
  getResumableSession,
} from '@/lib/supabase/sessions'

const fromMock = supabase.from as unknown as MockInstance

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_SESSION_ROW = {
  id: 'session-uuid-1',
  campaign_id: 'campaign-uuid-1',
  turn_number: 0,
  status: 'active' as const,
  current_mode: 'exploration' as const,
  started_at: '2024-01-01T00:00:00Z',
  ended_at: null,
}

const MOCK_TURN_ROW = {
  id: 'turn-uuid-1',
  session_id: 'session-uuid-1',
  turn_number: 0,
  player_input: 'I look around the tavern.',
  ai_narration: 'The candlelight flickers across weathered faces.',
  dice_rolls: [],
  mode: 'exploration' as const,
  created_at: '2024-01-01T00:00:00Z',
}

// ─── startSession ─────────────────────────────────────────────────────────────

describe('startSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a GameSession on success', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_SESSION_ROW, error: null })) // insert session
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })) // update campaign

    const result = await startSession('campaign-uuid-1')
    expect(result.id).toBe('session-uuid-1')
    expect(result.campaignId).toBe('campaign-uuid-1')
    expect(result.status).toBe('active')
    expect(result.turnNumber).toBe(0)
    expect(result.currentMode).toBe('exploration')
  })

  it('calls from("game_sessions") then from("campaigns")', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_SESSION_ROW, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))

    await startSession('campaign-uuid-1')
    expect(fromMock).toHaveBeenCalledWith('game_sessions')
    expect(fromMock).toHaveBeenCalledWith('campaigns')
  })

  it('throws ServiceError(VALIDATION) for empty campaignId', async () => {
    await expect(startSession('')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(startSession('   ')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(DB_ERROR) when session insert fails', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }),
    )
    await expect(startSession('campaign-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('still resolves if campaign status update fails (session is primary)', async () => {
    // Session insert succeeds, campaign update fails
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_SESSION_ROW, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: 'warn', code: '58000' } }))

    // Should succeed — campaign update failure is a warning, not a fatal error
    const result = await startSession('campaign-uuid-1')
    expect(result.id).toBe('session-uuid-1')
  })
})

// ─── endSession ───────────────────────────────────────────────────────────────

describe('endSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns completed session', async () => {
    const completedRow = { ...MOCK_SESSION_ROW, status: 'completed' as const, ended_at: '2024-01-01T01:00:00Z' }
    fromMock.mockReturnValue(makeQueryBuilder({ data: completedRow, error: null }))

    const result = await endSession('session-uuid-1')
    expect(result.status).toBe('completed')
    expect(result.endedAt).toBe('2024-01-01T01:00:00Z')
  })

  it('throws ServiceError(NOT_FOUND) on PGRST116', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )
    await expect(endSession('bad-id'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws ServiceError(DB_ERROR) on other errors', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }),
    )
    await expect(endSession('session-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws ServiceError(FORBIDDEN) on RLS violation', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'row-level security', code: '42501' } }),
    )
    await expect(endSession('other-users-session'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── appendTurn ───────────────────────────────────────────────────────────────

describe('appendTurn', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns NarrativeTurn on success', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({
        data: { turn_number: 0, status: 'active' },
        error: null,
      })) // fetch session
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_TURN_ROW, error: null })) // insert turn
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })) // update turn_number

    const result = await appendTurn('session-uuid-1', {
      playerInput: 'I look around the tavern.',
      aiNarration: 'The candlelight flickers.',
      diceRolls: [],
    })

    expect(result.id).toBe('turn-uuid-1')
    expect(result.sessionId).toBe('session-uuid-1')
    expect(result.playerInput).toBe('I look around the tavern.')
    expect(result.mode).toBe('exploration')
  })

  it('defaults mode to exploration', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { turn_number: 0, status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_TURN_ROW, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))

    const result = await appendTurn('session-uuid-1', {
      playerInput: 'Test',
      aiNarration: 'Response',
      diceRolls: [],
    })
    expect(result.mode).toBe('exploration')
  })

  it('accepts explicit combat mode', async () => {
    const combatTurnRow = { ...MOCK_TURN_ROW, mode: 'combat' as const }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { turn_number: 2, status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: combatTurnRow, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))

    const result = await appendTurn('session-uuid-1', {
      playerInput: 'I attack the goblin!',
      aiNarration: 'Your blade arcs toward the creature.',
      diceRolls: [],
      mode: 'combat',
    })
    expect(result.mode).toBe('combat')
  })

  it('accepts explicit map mode', async () => {
    const mapTurnRow = { ...MOCK_TURN_ROW, mode: 'map' as const }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { turn_number: 3, status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: mapTurnRow, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))

    const result = await appendTurn('session-uuid-1', {
      playerInput: 'I move to the north corridor.',
      aiNarration: 'You advance carefully.',
      diceRolls: [],
      mode: 'map',
    })
    expect(result.mode).toBe('map')
  })

  it('throws ServiceError(VALIDATION) for empty playerInput', async () => {
    await expect(appendTurn('session-uuid-1', {
      playerInput: '',
      aiNarration: 'response',
      diceRolls: [],
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for whitespace-only playerInput', async () => {
    await expect(appendTurn('session-uuid-1', {
      playerInput: '   ',
      aiNarration: 'response',
      diceRolls: [],
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(NOT_FOUND) when session fetch returns PGRST116', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )
    await expect(appendTurn('bad-session', {
      playerInput: 'action',
      aiNarration: 'response',
      diceRolls: [],
    })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws ServiceError(VALIDATION) when appending to a completed session', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: { turn_number: 5, status: 'completed' }, error: null }),
    )
    await expect(appendTurn('session-uuid-1', {
      playerInput: 'action',
      aiNarration: 'response',
      diceRolls: [],
    })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(DB_ERROR) when turn insert fails', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { turn_number: 0, status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }))

    await expect(appendTurn('session-uuid-1', {
      playerInput: 'action',
      aiNarration: 'response',
      diceRolls: [],
    })).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('still resolves if turn_number update fails (turn was inserted)', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { turn_number: 0, status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_TURN_ROW, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: 'counter failed', code: '58000' } }))

    const result = await appendTurn('session-uuid-1', {
      playerInput: 'I look around.',
      aiNarration: 'You see...',
      diceRolls: [],
    })
    // Turn was created, counter warning is non-fatal
    expect(result.id).toBe('turn-uuid-1')
  })
})

// ─── getRecentTurns ───────────────────────────────────────────────────────────

describe('getRecentTurns', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns turns in ascending order (oldest first)', async () => {
    // Mock returns turns in descending order (as queried), service reverses them
    const turns = [
      { ...MOCK_TURN_ROW, id: 'turn-3', turn_number: 2 },
      { ...MOCK_TURN_ROW, id: 'turn-2', turn_number: 1 },
      { ...MOCK_TURN_ROW, id: 'turn-1', turn_number: 0 },
    ]
    fromMock.mockReturnValue(makeQueryBuilder({ data: turns, error: null }))

    const results = await getRecentTurns('session-uuid-1', 3)
    expect(results[0].id).toBe('turn-1')
    expect(results[1].id).toBe('turn-2')
    expect(results[2].id).toBe('turn-3')
  })

  it('returns empty array when no turns', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    expect(await getRecentTurns('session-uuid-1', 10)).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    expect(await getRecentTurns('session-uuid-1', 10)).toEqual([])
  })

  it('defaults limit to 10', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    fromMock.mockReturnValue(builder)

    await getRecentTurns('session-uuid-1')
    expect(builder.limit).toHaveBeenCalledWith(10)
  })

  it('throws ServiceError(VALIDATION) for limit > 50', async () => {
    await expect(getRecentTurns('session-uuid-1', 51))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for limit < 1', async () => {
    await expect(getRecentTurns('session-uuid-1', 0))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for float limit', async () => {
    await expect(getRecentTurns('session-uuid-1', 5.5))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(DB_ERROR) on Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }),
    )
    await expect(getRecentTurns('session-uuid-1', 5))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('maps diceRolls to empty array for null DB values', async () => {
    const turnWithNullRolls = { ...MOCK_TURN_ROW, dice_rolls: null }
    fromMock.mockReturnValue(makeQueryBuilder({ data: [turnWithNullRolls], error: null }))

    const results = await getRecentTurns('session-uuid-1', 1)
    expect(results[0].diceRolls).toEqual([])
  })
})

// ─── getActiveSession ─────────────────────────────────────────────────────────

describe('getActiveSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns GameSession when active session exists', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_SESSION_ROW, error: null }))

    const result = await getActiveSession('campaign-uuid-1')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('session-uuid-1')
    expect(result?.status).toBe('active')
  })

  it('returns null when no active session', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    const result = await getActiveSession('campaign-uuid-1')
    expect(result).toBeNull()
  })

  it('filters by campaign_id and status active', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    await getActiveSession('campaign-uuid-1')
    expect(builder.eq).toHaveBeenCalledWith('campaign_id', 'campaign-uuid-1')
    expect(builder.eq).toHaveBeenCalledWith('status', 'active')
  })

  it('throws ServiceError(DB_ERROR) on Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }),
    )
    await expect(getActiveSession('campaign-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

// ─── pauseSession ─────────────────────────────────────────────────────────────

describe('pauseSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a paused session on success', async () => {
    const pausedRow = { ...MOCK_SESSION_ROW, status: 'paused' as const }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { status: 'active' }, error: null })) // fetch
      .mockReturnValueOnce(makeQueryBuilder({ data: pausedRow, error: null })) // update

    const result = await pauseSession('session-uuid-1')
    expect(result.status).toBe('paused')
  })

  it('does NOT set ended_at when pausing', async () => {
    const pausedRow = { ...MOCK_SESSION_ROW, status: 'paused' as const, ended_at: null }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: pausedRow, error: null }))

    const result = await pauseSession('session-uuid-1')
    expect(result.endedAt).toBeNull()
  })

  it('throws ServiceError(VALIDATION) when the session is already completed', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: { status: 'completed' }, error: null }),
    )
    await expect(pauseSession('session-uuid-1'))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(NOT_FOUND) when the session does not exist', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )
    await expect(pauseSession('bad-id'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws ServiceError(DB_ERROR) when the update step fails', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }))

    await expect(pauseSession('session-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

// ─── resumeSession ────────────────────────────────────────────────────────────

describe('resumeSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns an active session on success', async () => {
    const resumedRow = { ...MOCK_SESSION_ROW, status: 'active' as const }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { status: 'paused' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: resumedRow, error: null }))

    const result = await resumeSession('session-uuid-1')
    expect(result.status).toBe('active')
  })

  it('throws ServiceError(VALIDATION) when the session is completed', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: { status: 'completed' }, error: null }),
    )
    await expect(resumeSession('session-uuid-1'))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(NOT_FOUND) when the session does not exist', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )
    await expect(resumeSession('bad-id'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('can resume an already-active session (idempotent)', async () => {
    const activeRow = { ...MOCK_SESSION_ROW, status: 'active' as const }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: { status: 'active' }, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: activeRow, error: null }))

    const result = await resumeSession('session-uuid-1')
    expect(result.status).toBe('active')
  })
})

// ─── getResumableSession ──────────────────────────────────────────────────────

describe('getResumableSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the active session when one exists and no paused session exists', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_SESSION_ROW, error: null })) // active query
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })) // paused query

    const result = await getResumableSession('campaign-uuid-1')
    expect(result?.status).toBe('active')
  })

  it('returns the paused session when no active session exists', async () => {
    const pausedRow = { ...MOCK_SESSION_ROW, status: 'paused' as const }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })) // active query
      .mockReturnValueOnce(makeQueryBuilder({ data: pausedRow, error: null })) // paused query

    const result = await getResumableSession('campaign-uuid-1')
    expect(result?.status).toBe('paused')
  })

  it('returns null when neither an active nor paused session exists', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))

    const result = await getResumableSession('campaign-uuid-1')
    expect(result).toBeNull()
  })

  it('prefers the more recently started session when both somehow exist', async () => {
    const olderActive = { ...MOCK_SESSION_ROW, status: 'active' as const, started_at: '2024-01-01T00:00:00Z' }
    const newerPaused = { ...MOCK_SESSION_ROW, id: 'session-uuid-2', status: 'paused' as const, started_at: '2024-06-01T00:00:00Z' }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: olderActive, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: newerPaused, error: null }))

    const result = await getResumableSession('campaign-uuid-1')
    expect(result?.id).toBe('session-uuid-2')
  })

  it('throws ServiceError(DB_ERROR) when the active query fails', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }),
    )
    await expect(getResumableSession('campaign-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws ServiceError(DB_ERROR) when the paused query fails', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }))

    await expect(getResumableSession('campaign-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})
