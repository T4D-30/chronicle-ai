/**
 * Chronicle AI — Campaign Service Tests
 * Phase 1.4
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
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  updateWorldState,
  updateDirectorConfig,
  deleteCampaign,
} from '@/lib/supabase/campaigns'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

const fromMock = supabase.from as unknown as MockInstance

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CAMPAIGN_ROW = {
  id: 'campaign-uuid-1',
  user_id: 'user-uuid-1',
  title: 'The Shattered Throne',
  description: 'A kingdom torn asunder.',
  status: 'idle' as const,
  character_id: null,
  director_config: DEFAULT_DIRECTOR_CONFIG,
  world_state: DEFAULT_WORLD_STATE,
  tone: 'heroic' as const,
  difficulty: 'standard' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// ─── createCampaign ───────────────────────────────────────────────────────────

describe('createCampaign', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a Campaign on success', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))

    const result = await createCampaign({
      userId: 'user-uuid-1',
      title: 'The Shattered Throne',
    })

    expect(result.id).toBe('campaign-uuid-1')
    expect(result.title).toBe('The Shattered Throne')
    expect(result.userId).toBe('user-uuid-1')
  })

  it('applies default tone and difficulty', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))

    const result = await createCampaign({ userId: 'u1', title: 'Test' })
    expect(result.tone).toBe('heroic')
    expect(result.difficulty).toBe('standard')
  })

  it('accepts custom tone and difficulty', async () => {
    const row = { ...MOCK_CAMPAIGN_ROW, tone: 'grim' as const, difficulty: 'brutal' as const }
    fromMock.mockReturnValue(makeQueryBuilder({ data: row, error: null }))

    const result = await createCampaign({
      userId: 'u1',
      title: 'Dark Campaign',
      tone: 'grim',
      difficulty: 'brutal',
    })

    expect(result.tone).toBe('grim')
    expect(result.difficulty).toBe('brutal')
  })

  it('populates directorConfig with defaults', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))

    const result = await createCampaign({ userId: 'u1', title: 'Test' })
    expect(result.directorConfig.npcMemory).toEqual([])
    expect(result.directorConfig.activeThreads).toEqual([])
    expect(result.directorConfig.currentMode).toBe('exploration')
  })

  it('throws ServiceError(VALIDATION) for empty title', async () => {
    await expect(createCampaign({ userId: 'u1', title: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for title exceeding 120 chars', async () => {
    await expect(createCampaign({ userId: 'u1', title: 'A'.repeat(121) }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for invalid tone', async () => {
    await expect(
      createCampaign({ userId: 'u1', title: 'Test', tone: 'scary' as never }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for invalid difficulty', async () => {
    await expect(
      createCampaign({ userId: 'u1', title: 'Test', difficulty: 'hard' as never }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(DB_ERROR) on Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'db error', code: '58000' } }),
    )
    await expect(createCampaign({ userId: 'u1', title: 'Test' }))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

// ─── getCampaign ─────────────────────────────────────────────────────────────

describe('getCampaign', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a Campaign for a valid id', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))

    const result = await getCampaign('campaign-uuid-1')
    expect(result.id).toBe('campaign-uuid-1')
    expect(result.title).toBe('The Shattered Throne')
  })

  it('hydrates directorConfig and worldState from JSONB', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))

    const result = await getCampaign('campaign-uuid-1')
    expect(result.directorConfig).toMatchObject(DEFAULT_DIRECTOR_CONFIG)
    expect(result.worldState).toMatchObject(DEFAULT_WORLD_STATE)
  })

  it('throws ServiceError(NOT_FOUND) on PGRST116', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )
    await expect(getCampaign('bad-id'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws ServiceError(DB_ERROR) on other errors', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58P01' } }),
    )
    await expect(getCampaign('id'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

// ─── listCampaigns ────────────────────────────────────────────────────────────

describe('listCampaigns', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns array of campaigns', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: [MOCK_CAMPAIGN_ROW, { ...MOCK_CAMPAIGN_ROW, id: 'c2' }], error: null }),
    )

    const results = await listCampaigns('user-uuid-1')
    expect(results).toHaveLength(2)
  })

  it('returns empty array when none exist', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    expect(await listCampaigns('u1')).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    expect(await listCampaigns('u1')).toEqual([])
  })

  it('filters by user_id', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    fromMock.mockReturnValue(builder)

    await listCampaigns('user-uuid-1')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-uuid-1')
  })
})

// ─── updateCampaign ───────────────────────────────────────────────────────────

describe('updateCampaign', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns updated Campaign on success', async () => {
    const updated = { ...MOCK_CAMPAIGN_ROW, title: 'The Iron Crown', status: 'active' as const }
    fromMock.mockReturnValue(makeQueryBuilder({ data: updated, error: null }))

    const result = await updateCampaign('campaign-uuid-1', { title: 'The Iron Crown', status: 'active' })
    expect(result.title).toBe('The Iron Crown')
    expect(result.status).toBe('active')
  })

  it('throws ServiceError(VALIDATION) for empty title', async () => {
    await expect(updateCampaign('id', { title: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for invalid status', async () => {
    await expect(updateCampaign('id', { status: 'running' as never }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(NOT_FOUND) on PGRST116', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'no rows', code: 'PGRST116' } }),
    )
    await expect(updateCampaign('bad-id', { title: 'New' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ─── updateWorldState ─────────────────────────────────────────────────────────

describe('updateWorldState', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('merges patch into existing world state', async () => {
    // First call = getCampaign, second call = update
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({
        data: {
          ...MOCK_CAMPAIGN_ROW,
          world_state: { ...DEFAULT_WORLD_STATE, version: 1, worldTime: 'Dusk, Day 3' },
        },
        error: null,
      }))

    const result = await updateWorldState('campaign-uuid-1', { worldTime: 'Dusk, Day 3' })
    expect(result.worldState.worldTime).toBe('Dusk, Day 3')
  })

  it('increments world state version on each update', async () => {
    const currentState = { ...DEFAULT_WORLD_STATE, version: 5 }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({
        data: { ...MOCK_CAMPAIGN_ROW, world_state: currentState },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({
        data: { ...MOCK_CAMPAIGN_ROW, world_state: { ...currentState, version: 6 } },
        error: null,
      }))

    const result = await updateWorldState('campaign-uuid-1', {})
    expect(result.worldState.version).toBe(6)
  })

  it('propagates NOT_FOUND from getCampaign', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )
    await expect(updateWorldState('bad-id', {}))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ─── updateDirectorConfig ─────────────────────────────────────────────────────

describe('updateDirectorConfig', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('merges patch into existing config', async () => {
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_CAMPAIGN_ROW, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({
        data: { ...MOCK_CAMPAIGN_ROW, tone: 'grim' as const, director_config: { ...DEFAULT_DIRECTOR_CONFIG, tone: 'grim' } },
        error: null,
      }))

    const result = await updateDirectorConfig('campaign-uuid-1', { tone: 'grim' })
    expect(result.tone).toBe('grim')
  })

  it('keeps existing config fields not in patch', async () => {
    const existingConfig = { ...DEFAULT_DIRECTOR_CONFIG, hiddenArc: 'The guild is corrupt' }
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({
        data: { ...MOCK_CAMPAIGN_ROW, director_config: existingConfig },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({
        data: { ...MOCK_CAMPAIGN_ROW, director_config: { ...existingConfig, tone: 'mysterious' as const } },
        error: null,
      }))

    const result = await updateDirectorConfig('campaign-uuid-1', { tone: 'mysterious' })
    expect(result.directorConfig.hiddenArc).toBe('The guild is corrupt')
  })
})

// ─── deleteCampaign ───────────────────────────────────────────────────────────

describe('deleteCampaign', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('resolves without error on success', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    await expect(deleteCampaign('campaign-uuid-1')).resolves.toBeUndefined()
  })

  it('calls supabase.from("campaigns") with correct eq', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    await deleteCampaign('campaign-uuid-1')
    expect(fromMock).toHaveBeenCalledWith('campaigns')
    expect(builder.eq).toHaveBeenCalledWith('id', 'campaign-uuid-1')
  })

  it('throws ServiceError(DB_ERROR) on Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'error', code: '58000' } }),
    )
    await expect(deleteCampaign('id'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws ServiceError(FORBIDDEN) on RLS violation', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'row-level security', code: '42501' } }),
    )
    await expect(deleteCampaign('other-users-campaign'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── createCampaign FORBIDDEN ────────────────────────────────────────────────

describe('createCampaign — FORBIDDEN path', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws ServiceError(FORBIDDEN) on RLS/permission error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'row-level security policy', code: '42501' } }),
    )
    await expect(createCampaign({ userId: 'u1', title: 'Test' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

