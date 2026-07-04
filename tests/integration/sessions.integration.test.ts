/**
 * Chronicle AI — Campaign + Session Integration Tests
 * Phase 2.2
 *
 * Tests createCampaign, getCampaign, updateCampaign, deleteCampaign,
 * startSession, pauseSession, resumeSession, endSession,
 * getResumableSession, appendTurn, and getRecentTurns against real Postgres
 * with migrations 0001-0005 applied, RLS enforced.
 *
 * WHY A SEPARATE FILE: The character integration test file mocks
 * @/lib/supabase/client at the module level. Each integration test file
 * has its own vi.mock scope so they can each provide their adapter instance
 * independently without interference.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Pool } from 'pg'
import { TestSupabaseAdapter } from './support/pgAdapter'

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://authenticated_test:authenticated_test@localhost:5432/chronicle_ai'

const ADMIN_DB_URL =
  process.env.ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chronicle_ai'

const adminPool = new Pool({ connectionString: ADMIN_DB_URL })

const TEST_USER_ID  = '00000000-0000-4000-8000-000000000011'
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000012'

const adapter = new TestSupabaseAdapter(TEST_DB_URL)

vi.mock('@/lib/supabase/client', () => ({ supabase: adapter }))

const {
  createCampaign,
  getCampaign,
  updateCampaign,
  deleteCampaign,
} = await import('@/lib/supabase/campaigns')

const { createCharacter } = await import('@/lib/supabase/characters')

const {
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  appendTurn,
  getRecentTurns,
  getActiveSession,
  getResumableSession,
} = await import('@/lib/supabase/sessions')


// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  for (const id of [TEST_USER_ID, OTHER_USER_ID]) {
    await adminPool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [id, `${id}@integration.test`],
    )
  }
  // Clean slate — cascade removes sessions and turns
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [TEST_USER_ID])
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [OTHER_USER_ID])
})

beforeEach(() => {
  adapter.setTestUserId(TEST_USER_ID)
})

afterAll(async () => {
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [TEST_USER_ID])
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [OTHER_USER_ID])
  await adapter.close()
  await adminPool.end()
})

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

describe('Integration: createCampaign', () => {
  it('creates a campaign and returns a Campaign domain object', async () => {
    const campaign = await createCampaign({
      userId: TEST_USER_ID,
      title: 'The Shattered Throne',
    })
    expect(campaign.id).toBeTruthy()
    expect(campaign.title).toBe('The Shattered Throne')
    expect(campaign.userId).toBe(TEST_USER_ID)
    expect(campaign.status).toBe('idle')
  })

  it('applies tone and difficulty when provided', async () => {
    const campaign = await createCampaign({
      userId: TEST_USER_ID,
      title: 'Blood in the Marshes',
      tone: 'grim',
      difficulty: 'brutal',
    })
    expect(campaign.tone).toBe('grim')
    expect(campaign.difficulty).toBe('brutal')
  })

  it('stores the premise as description', async () => {
    const campaign = await createCampaign({
      userId: TEST_USER_ID,
      title: 'Titled Campaign',
      description: 'A premise for the world.',
    })
    expect(campaign.description).toBe('A premise for the world.')
  })

  it('persists rulesStyle inside directorConfig', async () => {
    const campaign = await createCampaign({
      userId: TEST_USER_ID,
      title: 'Cinematic Run',
      directorConfig: { rulesStyle: 'cinematic' },
    })
    expect(campaign.directorConfig.rulesStyle).toBe('cinematic')
  })

  it('throws ServiceError(VALIDATION) for an empty title', async () => {
    await expect(createCampaign({ userId: TEST_USER_ID, title: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for an invalid tone', async () => {
    await expect(
      createCampaign({ userId: TEST_USER_ID, title: 'Bad Tone', tone: 'weird' as never }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('Integration: getCampaign', () => {
  it('round-trips a campaign through real storage', async () => {
    const created = await createCampaign({ userId: TEST_USER_ID, title: 'Fetch Test' })
    const fetched = await getCampaign(created.id)
    expect(fetched.id).toBe(created.id)
    expect(fetched.title).toBe('Fetch Test')
  })

  it('throws ServiceError(NOT_FOUND) for a nonexistent id', async () => {
    await expect(getCampaign('99999999-9999-4999-8999-999999999999'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('Integration: updateCampaign', () => {
  it('updates title and description', async () => {
    const created = await createCampaign({ userId: TEST_USER_ID, title: 'Original Title' })
    const updated = await updateCampaign(created.id, { title: 'New Title', description: 'Updated premise.' })
    expect(updated.title).toBe('New Title')
    expect(updated.description).toBe('Updated premise.')
  })

  it('assigns and reassigns a characterId', async () => {
    // Create a real character to satisfy the FK constraint
    const char = await createCharacter({ userId: TEST_USER_ID, name: 'Campaign Hero' })
    const created = await createCampaign({ userId: TEST_USER_ID, title: 'Character Test' })

    const withChar = await updateCampaign(created.id, { characterId: char.id })
    expect(withChar.characterId).toBe(char.id)

    const cleared = await updateCampaign(created.id, { characterId: null })
    expect(cleared.characterId).toBeNull()
  })

  it('regression: RLS blocks updating another user\'s campaign', async () => {
    const created = await createCampaign({ userId: TEST_USER_ID, title: 'Owned Campaign' })
    adapter.setTestUserId(OTHER_USER_ID)
    await expect(updateCampaign(created.id, { title: 'Hijacked' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('Integration: deleteCampaign', () => {
  it('deletes a campaign and makes it unfetchable', async () => {
    const created = await createCampaign({ userId: TEST_USER_ID, title: 'Delete Me' })
    await deleteCampaign(created.id)
    await expect(getCampaign(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ─── Session lifecycle ────────────────────────────────────────────────────────

describe('Integration: startSession', () => {
  it('creates a session with status active', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Session Test' })
    const session = await startSession(campaign.id)
    expect(session.campaignId).toBe(campaign.id)
    expect(session.status).toBe('active')
    expect(session.turnNumber).toBe(0)
  })

  it('marks the campaign as active after starting a session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Activation Test' })
    await startSession(campaign.id)
    const updated = await getCampaign(campaign.id)
    expect(updated.status).toBe('active')
  })
})

describe('Integration: pauseSession + resumeSession', () => {
  it('pauses an active session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Pause Test' })
    const session = await startSession(campaign.id)
    const paused = await pauseSession(session.id)
    expect(paused.status).toBe('paused')
    expect(paused.endedAt).toBeNull()
  })

  it('resumes a paused session back to active', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Resume Test' })
    const session = await startSession(campaign.id)
    await pauseSession(session.id)
    const resumed = await resumeSession(session.id)
    expect(resumed.status).toBe('active')
  })

  it('throws VALIDATION when pausing a completed session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Completed Pause Test' })
    const session = await startSession(campaign.id)
    await endSession(session.id)
    await expect(pauseSession(session.id)).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws VALIDATION when resuming a completed session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Completed Resume Test' })
    const session = await startSession(campaign.id)
    await endSession(session.id)
    await expect(resumeSession(session.id)).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('Integration: endSession', () => {
  it('marks a session as completed with an ended_at timestamp', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'End Test' })
    const session = await startSession(campaign.id)
    const ended = await endSession(session.id)
    expect(ended.status).toBe('completed')
    expect(ended.endedAt).not.toBeNull()
  })
})

describe('Integration: getResumableSession', () => {
  it('returns null when no session exists', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'No Session Campaign' })
    const result = await getResumableSession(campaign.id)
    expect(result).toBeNull()
  })

  it('returns an active session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Active Session Campaign' })
    await startSession(campaign.id)
    const result = await getResumableSession(campaign.id)
    expect(result?.status).toBe('active')
  })

  it('returns a paused session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Paused Session Campaign' })
    const session = await startSession(campaign.id)
    await pauseSession(session.id)
    const result = await getResumableSession(campaign.id)
    expect(result?.status).toBe('paused')
  })

  it('returns null for a completed session — completed sessions are not resumable', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Completed Campaign' })
    const session = await startSession(campaign.id)
    await endSession(session.id)
    const result = await getResumableSession(campaign.id)
    expect(result).toBeNull()
  })

  it('getActiveSession returns null for a paused session (correct narrow scope)', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Narrow Scope Test' })
    const session = await startSession(campaign.id)
    await pauseSession(session.id)
    // getActiveSession only matches status='active', so paused is invisible to it
    const result = await getActiveSession(campaign.id)
    expect(result).toBeNull()
    // getResumableSession sees both
    const resumable = await getResumableSession(campaign.id)
    expect(resumable?.id).toBe(session.id)
  })
})

describe('Integration: appendTurn + getRecentTurns', () => {
  it('appends a turn and retrieves it in chronological order', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Turn Test' })
    const session = await startSession(campaign.id)

    const turn = await appendTurn(session.id, {
      playerInput: 'I search the room.',
      aiNarration: 'You find a locked chest.',
      diceRolls: [],
    })

    expect(turn.playerInput).toBe('I search the room.')
    expect(turn.aiNarration).toBe('You find a locked chest.')
    expect(turn.turnNumber).toBe(0)

    const turns = await getRecentTurns(session.id, 10)
    expect(turns).toHaveLength(1)
    expect(turns[0].id).toBe(turn.id)
  })

  it('returns turns in ascending (chronological) order', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Order Test' })
    const session = await startSession(campaign.id)

    await appendTurn(session.id, { playerInput: 'First', aiNarration: '', diceRolls: [] })
    await appendTurn(session.id, { playerInput: 'Second', aiNarration: '', diceRolls: [] })
    await appendTurn(session.id, { playerInput: 'Third', aiNarration: '', diceRolls: [] })

    const turns = await getRecentTurns(session.id, 10)
    expect(turns.map((t) => t.playerInput)).toEqual(['First', 'Second', 'Third'])
  })

  it('respects the limit parameter', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Limit Test' })
    const session = await startSession(campaign.id)

    for (let i = 0; i < 5; i++) {
      await appendTurn(session.id, { playerInput: `Turn ${i}`, aiNarration: '', diceRolls: [] })
    }

    const recent = await getRecentTurns(session.id, 3)
    expect(recent).toHaveLength(3)
    // Should be the last 3 turns in ascending order
    expect(recent[0].playerInput).toBe('Turn 2')
    expect(recent[2].playerInput).toBe('Turn 4')
  })

  it('increments session turn_number after each append', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Counter Test' })
    const session = await startSession(campaign.id)
    expect(session.turnNumber).toBe(0)

    await appendTurn(session.id, { playerInput: 'A', aiNarration: '', diceRolls: [] })
    await appendTurn(session.id, { playerInput: 'B', aiNarration: '', diceRolls: [] })

    // Verify the turn_number in the DB (fetch the session row indirectly via getActiveSession)
    const live = await getActiveSession(campaign.id)
    expect(live?.turnNumber).toBe(2)
  })

  it('throws VALIDATION when appending to a completed session', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Completed Turn Test' })
    const session = await startSession(campaign.id)
    await endSession(session.id)

    await expect(
      appendTurn(session.id, { playerInput: 'Late input', aiNarration: '', diceRolls: [] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('full session lifecycle round trip: start → play → pause → resume → end', async () => {
    const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Lifecycle Test' })

    const session = await startSession(campaign.id)
    expect(session.status).toBe('active')

    await appendTurn(session.id, { playerInput: 'Look around.', aiNarration: 'You see a cave.', diceRolls: [] })

    const paused = await pauseSession(session.id)
    expect(paused.status).toBe('paused')

    // State is preserved across pause — getResumableSession finds it
    const found = await getResumableSession(campaign.id)
    expect(found?.id).toBe(session.id)
    expect(found?.status).toBe('paused')

    const resumed = await resumeSession(session.id)
    expect(resumed.status).toBe('active')

    await appendTurn(session.id, { playerInput: 'Enter cave.', aiNarration: 'Cold air rushes out.', diceRolls: [] })

    const ended = await endSession(session.id)
    expect(ended.status).toBe('completed')
    expect(ended.endedAt).not.toBeNull()

    // No resumable session after ending
    const none = await getResumableSession(campaign.id)
    expect(none).toBeNull()

    // History is still readable
    const turns = await getRecentTurns(session.id, 10)
    expect(turns).toHaveLength(2)
    expect(turns[0].playerInput).toBe('Look around.')
    expect(turns[1].playerInput).toBe('Enter cave.')
  })
})
