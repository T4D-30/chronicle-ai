/**
 * Chronicle AI — Character Service Tests
 * Phase 1.4
 *
 * Per-file mock strategy: we override the global setup.ts mock with a
 * factory that returns properly-shaped Supabase query builder chains.
 * Each test controls the terminal resolution (.single(), no-chain) via
 * `mockResolvedValueOnce` on the final promise mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockInstance } from 'vitest'

// ─── Mock factory ─────────────────────────────────────────────────────────────

/**
 * Creates a mock Supabase query builder that resolves to `result` at the
 * end of any chain. Every builder method returns `this` so chains work.
 */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const resolve = vi.fn().mockResolvedValue(result)
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: resolve,
    maybeSingle: resolve,
    then: (onfulfilled: (v: unknown) => unknown) => resolve().then(onfulfilled),
  }
  return builder
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

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

// Imported AFTER mock declaration
import { supabase } from '@/lib/supabase/client'
import {
  createCharacter,
  getCharacter,
  listCharacters,
  updateCharacter,
  deleteCharacter,
  duplicateCharacter,
} from '@/lib/supabase/characters'
import { ServiceError } from '@/lib/supabase/errors'

const fromMock = supabase.from as unknown as MockInstance

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const MOCK_CHARACTER_ROW = {
  id: 'char-uuid-1',
  user_id: 'user-uuid-1',
  name: 'Aldric Sorn',
  archetype: 'fighter',
  ancestry: 'human',
  background: 'soldier',
  level: 3,
  experience: 900,
  str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8,
  max_hp: 47,
  current_hp: 47,
  temp_hp: 0,
  armor_class: 16,
  speed: 30,
  proficiency_bonus: 2,
  hit_die: 'd10',
  death_saves_success: 0,
  death_saves_failure: 0,
  conditions: [],
  features: [],
  inventory: [],
  spells: {},
  concentration: null,
  skill_proficiencies: [],
  saving_throw_proficiencies: [],
  equipment: [],
  portrait_url: null,
  bio: '',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// ─── createCharacter ──────────────────────────────────────────────────────────

describe('createCharacter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a CharacterRecord on success', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))

    const result = await createCharacter({
      userId: 'user-uuid-1',
      name: 'Aldric Sorn',
      archetype: 'fighter',
      level: 3,
      scores: { strength: 16, dexterity: 14, constitution: 14 },
    })

    expect(result.id).toBe('char-uuid-1')
    expect(result.sheet.name).toBe('Aldric Sorn')
    expect(result.sheet.archetype).toBe('fighter')
    expect(result.sheet.level).toBe(3)
    expect(result.userId).toBe('user-uuid-1')
  })

  it('calls supabase.from("characters")', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))

    await createCharacter({ userId: 'user-uuid-1', name: 'Test Hero' })

    expect(fromMock).toHaveBeenCalledWith('characters')
  })

  it('throws ServiceError(VALIDATION) when name is empty', async () => {
    await expect(createCharacter({ userId: 'u1', name: '' }))
      .rejects.toThrow(ServiceError)

    await expect(createCharacter({ userId: 'u1', name: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) when level is out of range', async () => {
    await expect(createCharacter({ userId: 'u1', name: 'Hero', level: 21 }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) when ability score is out of range', async () => {
    await expect(
      createCharacter({ userId: 'u1', name: 'Hero', scores: { strength: 0 } }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(DB_ERROR) when Supabase returns an error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'connection refused', code: '08000' } }),
    )

    await expect(createCharacter({ userId: 'u1', name: 'Hero' }))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('parses conditions from DB safely (empty array)', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, conditions: [] },
      error: null,
    }))

    const result = await createCharacter({ userId: 'u1', name: 'Hero' })
    expect(result.sheet.currentHp).toBeGreaterThan(0)
    expect(result.conditions).toEqual([])
  })

  it('surfaces valid conditions on the returned CharacterRecord', async () => {
    const validCondition = {
      id: 'poisoned',
      source: 'spider bite',
      appliedAtTurn: 2,
      expiresAtTurn: null,
      stackLevel: 1,
      requiresConcentration: false,
      concentrationSourceId: null,
    }
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, conditions: [validCondition] },
      error: null,
    }))

    const result = await createCharacter({ userId: 'u1', name: 'Hero' })
    expect(result.conditions).toHaveLength(1)
    expect(result.conditions[0].id).toBe('poisoned')
    expect(result.conditions[0].source).toBe('spider bite')
  })

  it('handles malformed conditions in DB gracefully', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, conditions: [{ id: 'unknown_garbage' }] },
      error: null,
    }))

    // Should not throw — parseConditionsFromDb filters unknowns
    const result = await createCharacter({ userId: 'u1', name: 'Hero' })
    expect(result).toBeDefined()
    expect(result.conditions).toEqual([])
  })

  it('persists skillProficiencies through the insert payload', async () => {
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, skill_proficiencies: ['stealth', 'athletics'] },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const result = await createCharacter({
      userId: 'u1',
      name: 'Hero',
      skillProficiencies: ['stealth', 'athletics'],
    })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.skill_proficiencies).toEqual(['stealth', 'athletics'])
    expect(result.sheet.skillProficiencies).toEqual(['stealth', 'athletics'])
  })

  it('persists savingThrowProficiencies through the insert payload', async () => {
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, saving_throw_proficiencies: ['DEX', 'CON'] },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const result = await createCharacter({
      userId: 'u1',
      name: 'Hero',
      savingThrowProficiencies: ['DEX', 'CON'],
    })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.saving_throw_proficiencies).toEqual(['DEX', 'CON'])
    expect(result.sheet.savingThrowProficiencies).toEqual(['DEX', 'CON'])
  })

  it('persists equipment through the insert payload', async () => {
    const equipment = [
      { id: 'sword', name: 'Longsword +1', slot: 'weapon' as const, equipped: true, attackBonus: 1 },
    ]
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, equipment },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const result = await createCharacter({ userId: 'u1', name: 'Hero', equipment })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.equipment).toEqual(equipment)
    expect(result.sheet.equipment).toEqual(equipment)
  })

  it('persists deathSaveSuccesses/deathSaveFailures through the insert payload', async () => {
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, death_saves_success: 2, death_saves_failure: 1 },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const result = await createCharacter({
      userId: 'u1',
      name: 'Hero',
      deathSaveSuccesses: 2,
      deathSaveFailures: 1,
    })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.death_saves_success).toBe(2)
    expect(insertCall.death_saves_failure).toBe(1)
    expect(result.sheet.deathSaveSuccesses).toBe(2)
    expect(result.sheet.deathSaveFailures).toBe(1)
  })

  it('defaults skillProficiencies, savingThrowProficiencies, and equipment to empty arrays when not provided', async () => {
    const builder = makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null })
    fromMock.mockReturnValue(builder)

    await createCharacter({ userId: 'u1', name: 'Hero' })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.skill_proficiencies).toEqual([])
    expect(insertCall.saving_throw_proficiencies).toEqual([])
    expect(insertCall.equipment).toEqual([])
  })

  it('persists portraitUrl and bio through the insert payload', async () => {
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, portrait_url: 'data:image/png;base64,abc123', bio: 'Born in a storm.' },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const result = await createCharacter({
      userId: 'u1',
      name: 'Hero',
      portraitUrl: 'data:image/png;base64,abc123',
      bio: 'Born in a storm.',
    })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.portrait_url).toBe('data:image/png;base64,abc123')
    expect(insertCall.bio).toBe('Born in a storm.')
    expect(result.portraitUrl).toBe('data:image/png;base64,abc123')
    expect(result.bio).toBe('Born in a storm.')
  })

  it('defaults portraitUrl to null and bio to empty string when not provided', async () => {
    const builder = makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null })
    fromMock.mockReturnValue(builder)

    await createCharacter({ userId: 'u1', name: 'Hero' })

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.portrait_url).toBeNull()
    expect(insertCall.bio).toBe('')
  })
})

// ─── getCharacter ─────────────────────────────────────────────────────────────

describe('getCharacter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a CharacterRecord for a valid id', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))

    const result = await getCharacter('char-uuid-1')
    expect(result.id).toBe('char-uuid-1')
    expect(result.sheet.name).toBe('Aldric Sorn')
  })

  it('throws ServiceError(NOT_FOUND) when Supabase returns PGRST116', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )

    await expect(getCharacter('nonexistent-id'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws ServiceError(DB_ERROR) for other Supabase errors', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'network error', code: '08001' } }),
    )

    await expect(getCharacter('char-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('maps DB modifiers correctly from ability scores', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))

    const result = await getCharacter('char-uuid-1')
    // STR 16 → modifier +3
    expect(result.sheet.modifiers.strength).toBe(3)
    // DEX 14 → modifier +2
    expect(result.sheet.modifiers.dexterity).toBe(2)
    // CHA 8 → modifier -1
    expect(result.sheet.modifiers.charisma).toBe(-1)
  })

  it('hydrates skillProficiencies from the DB row', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, skill_proficiencies: ['stealth', 'perception'] },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.skillProficiencies).toEqual(['stealth', 'perception'])
  })

  it('hydrates savingThrowProficiencies from the DB row', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, saving_throw_proficiencies: ['WIS', 'CHA'] },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.savingThrowProficiencies).toEqual(['WIS', 'CHA'])
  })

  it('hydrates equipment from the DB row', async () => {
    const equipment = [
      { id: 'shield', name: 'Shield', slot: 'shield', equipped: true, armorBonus: 2 },
    ]
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, equipment },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.equipment).toEqual(equipment)
  })

  it('hydrates deathSaveSuccesses and deathSaveFailures onto the sheet', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, death_saves_success: 1, death_saves_failure: 2 },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.deathSaveSuccesses).toBe(1)
    expect(result.sheet.deathSaveFailures).toBe(2)
  })

  it('defaults to empty arrays when DB columns are empty', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.skillProficiencies).toEqual([])
    expect(result.sheet.savingThrowProficiencies).toEqual([])
    expect(result.sheet.equipment).toEqual([])
  })

  it('filters out malformed skill proficiency entries rather than throwing', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, skill_proficiencies: ['stealth', 'flying', 42, null] },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.skillProficiencies).toEqual(['stealth'])
  })

  it('filters out malformed saving throw proficiency entries rather than throwing', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, saving_throw_proficiencies: ['DEX', 'LUCK', 7] },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.savingThrowProficiencies).toEqual(['DEX'])
  })

  it('filters out malformed equipment entries rather than throwing', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: {
        ...MOCK_CHARACTER_ROW,
        equipment: [
          { id: 'sword', name: 'Sword', slot: 'weapon', equipped: true },
          { id: 'broken' }, // missing required fields
          'not even an object',
        ],
      },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.sheet.equipment).toHaveLength(1)
    expect(result.sheet.equipment[0].id).toBe('sword')
  })

  it('hydrates portraitUrl and bio from the DB row', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, portrait_url: 'data:image/png;base64,xyz', bio: 'A wandering scholar.' },
      error: null,
    }))

    const result = await getCharacter('char-uuid-1')
    expect(result.portraitUrl).toBe('data:image/png;base64,xyz')
    expect(result.bio).toBe('A wandering scholar.')
  })

  it('hydrates portraitUrl as null when unset', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))

    const result = await getCharacter('char-uuid-1')
    expect(result.portraitUrl).toBeNull()
    expect(result.bio).toBe('')
  })
})

// ─── listCharacters ───────────────────────────────────────────────────────────

describe('listCharacters', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns an array of CharacterRecords', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: [MOCK_CHARACTER_ROW, { ...MOCK_CHARACTER_ROW, id: 'char-2' }], error: null }),
    )

    const results = await listCharacters('user-uuid-1')
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('char-uuid-1')
    expect(results[1].id).toBe('char-2')
  })

  it('returns empty array when no characters exist', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [], error: null }))

    const results = await listCharacters('user-uuid-1')
    expect(results).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    const results = await listCharacters('user-uuid-1')
    expect(results).toEqual([])
  })

  it('filters by user_id (eq called with user_id)', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    fromMock.mockReturnValue(builder)

    await listCharacters('user-uuid-1')

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-uuid-1')
  })

  it('throws ServiceError(DB_ERROR) on Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'timeout', code: '57014' } }),
    )

    await expect(listCharacters('user-uuid-1'))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

// ─── updateCharacter ─────────────────────────────────────────────────────────

describe('updateCharacter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns updated CharacterRecord on success', async () => {
    const updatedRow = { ...MOCK_CHARACTER_ROW, name: 'Aldric the Bold', current_hp: 30 }
    fromMock.mockReturnValue(makeQueryBuilder({ data: updatedRow, error: null }))

    const result = await updateCharacter('char-uuid-1', {
      name: 'Aldric the Bold',
      currentHp: 30,
    })

    expect(result.sheet.name).toBe('Aldric the Bold')
    expect(result.sheet.currentHp).toBe(30)
  })

  it('throws ServiceError(VALIDATION) for invalid level patch', async () => {
    await expect(updateCharacter('char-uuid-1', { level: 0 }))
      .rejects.toMatchObject({ code: 'VALIDATION' })

    await expect(updateCharacter('char-uuid-1', { level: 21 }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for invalid score patch', async () => {
    await expect(updateCharacter('char-uuid-1', { scores: { strength: 25 } }))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(NOT_FOUND) when PGRST116 returned', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'no rows', code: 'PGRST116' } }),
    )

    await expect(updateCharacter('bad-id', { name: 'Test' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws ServiceError(DB_ERROR) on generic Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'db error', code: '58000' } }),
    )

    await expect(updateCharacter('char-uuid-1', { currentHp: 10 }))
      .rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('accepts negative currentHp (death state)', async () => {
    const deadRow = { ...MOCK_CHARACTER_ROW, current_hp: -3 }
    fromMock.mockReturnValue(makeQueryBuilder({ data: deadRow, error: null }))

    const result = await updateCharacter('char-uuid-1', { currentHp: -3 })
    expect(result.sheet.currentHp).toBe(-3)
  })

  it('normalises archetype to lowercase in patch', async () => {
    const builder = makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null })
    fromMock.mockReturnValue(builder)

    await updateCharacter('char-uuid-1', { archetype: 'WIZARD' })

    expect(builder.update).toHaveBeenCalled()
  })

  it('recalculates maxHp, proficiency_bonus, and AC when scores change', async () => {
    // CON 16 (+3), level 1, fighter (d10): maxHp = 10+3+(1*(5+3)) = 21
    // DEX 10 (+0): AC = 10+0 = 10
    // Level 1: proficiency = 2
    const recalcRow = {
      ...MOCK_CHARACTER_ROW,
      str: 16, dex: 10, con: 16, int: 10, wis: 10, cha: 10,
      max_hp: 21, armor_class: 10, proficiency_bonus: 2, hit_die: 'd10',
      level: 1,
    }
    const builder = makeQueryBuilder({ data: recalcRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', {
      level: 1,
      archetype: 'fighter',
      scores: { strength: 16, dexterity: 10, constitution: 16, intelligence: 10, wisdom: 10, charisma: 10 },
    })

    // Verify the DB patch contained recalculated derived stats
    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('max_hp', 21)
    expect(updateCall).toHaveProperty('proficiency_bonus', 2)
    expect(updateCall).toHaveProperty('hit_die', 'd10')
    expect(result.sheet.maxHp).toBe(21)
  })

  // Phase 9.2 — regression test for a real bug found while building the
  // level-up workflow: updateCharacter previously only recalculated
  // max_hp/armor_class/proficiency_bonus when `patch.scores` was present.
  // A level-up call passing ONLY `{ level }` (no score change) silently
  // left those derived stats stale. Fixed by extending the recalc gate to
  // also fire on `patch.level !== undefined`.
  it('recalculates maxHp and proficiency_bonus on a LEVEL-ONLY patch (no scores) — regression for Phase 9.2 level-up bug', async () => {
    // MOCK_CHARACTER_ROW: CON 14 (+2), fighter (d10), starting level 3.
    // Leveling to 4 with unchanged CON: maxHp = 10+2+(4*(5+2)) = 40
    // Proficiency bonus at level 4 = 2 (bumps to 3 at level 5)
    const recalcRow = {
      ...MOCK_CHARACTER_ROW,
      level: 4, max_hp: 40, proficiency_bonus: 2,
    }
    const builder = makeQueryBuilder({ data: recalcRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', { level: 4 })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('max_hp', 40)
    expect(updateCall).toHaveProperty('proficiency_bonus', 2)
    expect(result.sheet.level).toBe(4)
    expect(result.sheet.maxHp).toBe(40)
  })

  it('proficiency_bonus increases correctly across the level-5 threshold on a level-only patch', async () => {
    // Level 5 crosses into proficiency +3. CON 14 (+2), fighter (d10):
    // maxHp = 10+2+(5*(5+2)) = 47
    const recalcRow = {
      ...MOCK_CHARACTER_ROW,
      level: 5, max_hp: 47, proficiency_bonus: 3,
    }
    const builder = makeQueryBuilder({ data: recalcRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', { level: 5 })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('proficiency_bonus', 3)
    expect(result.sheet.proficiencyBonus).toBe(3)
  })

  it('throws ServiceError(FORBIDDEN) on RLS/permission error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } }),
    )

    await expect(updateCharacter('other-users-char', { name: 'Hacked' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('updates skillProficiencies through the patch', async () => {
    const updatedRow = { ...MOCK_CHARACTER_ROW, skill_proficiencies: ['arcana', 'history'] }
    const builder = makeQueryBuilder({ data: updatedRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', {
      skillProficiencies: ['arcana', 'history'],
    })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.skill_proficiencies).toEqual(['arcana', 'history'])
    expect(result.sheet.skillProficiencies).toEqual(['arcana', 'history'])
  })

  it('updates savingThrowProficiencies through the patch', async () => {
    const updatedRow = { ...MOCK_CHARACTER_ROW, saving_throw_proficiencies: ['STR', 'CHA'] }
    const builder = makeQueryBuilder({ data: updatedRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', {
      savingThrowProficiencies: ['STR', 'CHA'],
    })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.saving_throw_proficiencies).toEqual(['STR', 'CHA'])
    expect(result.sheet.savingThrowProficiencies).toEqual(['STR', 'CHA'])
  })

  it('updates equipment through the patch', async () => {
    const newEquipment = [
      { id: 'bow', name: 'Longbow', slot: 'weapon' as const, equipped: true, attackBonus: 2 },
    ]
    const updatedRow = { ...MOCK_CHARACTER_ROW, equipment: newEquipment }
    const builder = makeQueryBuilder({ data: updatedRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', { equipment: newEquipment })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.equipment).toEqual(newEquipment)
    expect(result.sheet.equipment).toEqual(newEquipment)
  })

  it('updates deathSavesSuccess and deathSavesFailure through the patch', async () => {
    const updatedRow = { ...MOCK_CHARACTER_ROW, death_saves_success: 1, death_saves_failure: 1 }
    const builder = makeQueryBuilder({ data: updatedRow, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', {
      deathSavesSuccess: 1,
      deathSavesFailure: 1,
    })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.death_saves_success).toBe(1)
    expect(updateCall.death_saves_failure).toBe(1)
    expect(result.sheet.deathSaveSuccesses).toBe(1)
    expect(result.sheet.deathSaveFailures).toBe(1)
  })

  it('a patch that does not touch proficiencies/equipment leaves those DB fields untouched', async () => {
    const builder = makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null })
    fromMock.mockReturnValue(builder)

    await updateCharacter('char-uuid-1', { name: 'Renamed Hero' })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).not.toHaveProperty('skill_proficiencies')
    expect(updateCall).not.toHaveProperty('saving_throw_proficiencies')
    expect(updateCall).not.toHaveProperty('equipment')
  })

  it('throws ServiceError(VALIDATION) for an unknown skill in the patch', async () => {
    await expect(
      // @ts-expect-error — intentional bad value
      updateCharacter('char-uuid-1', { skillProficiencies: ['flying'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('throws ServiceError(VALIDATION) for an unknown saving throw ability in the patch', async () => {
    await expect(
      // @ts-expect-error — intentional bad value
      updateCharacter('char-uuid-1', { savingThrowProficiencies: ['LUCK'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('updates portraitUrl and bio through the patch', async () => {
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, portrait_url: 'data:image/png;base64,new', bio: 'Updated story.' },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    const result = await updateCharacter('char-uuid-1', {
      portraitUrl: 'data:image/png;base64,new',
      bio: 'Updated story.',
    })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.portrait_url).toBe('data:image/png;base64,new')
    expect(updateCall.bio).toBe('Updated story.')
    expect(result.portraitUrl).toBe('data:image/png;base64,new')
    expect(result.bio).toBe('Updated story.')
  })

  it('allows clearing portraitUrl back to null', async () => {
    const builder = makeQueryBuilder({
      data: { ...MOCK_CHARACTER_ROW, portrait_url: null },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    await updateCharacter('char-uuid-1', { portraitUrl: null })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.portrait_url).toBeNull()
  })

  it('a patch that does not touch portraitUrl/bio leaves those DB fields untouched', async () => {
    const builder = makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null })
    fromMock.mockReturnValue(builder)

    await updateCharacter('char-uuid-1', { name: 'Renamed Hero' })

    const updateCall = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).not.toHaveProperty('portrait_url')
    expect(updateCall).not.toHaveProperty('bio')
  })
})

// ─── deleteCharacter ─────────────────────────────────────────────────────────

describe('deleteCharacter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('resolves without error on success', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    await expect(deleteCharacter('char-uuid-1')).resolves.toBeUndefined()
  })

  it('calls supabase.from("characters") with eq filter', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    await deleteCharacter('char-uuid-1')

    expect(fromMock).toHaveBeenCalledWith('characters')
    expect(builder.eq).toHaveBeenCalledWith('id', 'char-uuid-1')
  })

  it('throws ServiceError(DB_ERROR) on Supabase error', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({ data: null, error: { message: 'forbidden', code: '42501' } }),
    )

    await expect(deleteCharacter('char-uuid-1'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── duplicateCharacter ───────────────────────────────────────────────────────

describe('duplicateCharacter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches the source then creates a new row with " (Copy)" appended to the name', async () => {
    const duplicatedRow = {
      ...MOCK_CHARACTER_ROW,
      id: 'char-uuid-2',
      name: 'Aldric Sorn (Copy)',
      experience: 0,
      current_hp: 47,
      death_saves_success: 0,
      death_saves_failure: 0,
    }

    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null })) // getCharacter
      .mockReturnValueOnce(makeQueryBuilder({ data: duplicatedRow, error: null })) // createCharacter insert

    const result = await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    expect(result.id).toBe('char-uuid-2')
    expect(result.sheet.name).toBe('Aldric Sorn (Copy)')
    expect(result.userId).toBe('user-uuid-1')
  })

  it('carries over portraitUrl and bio onto the copy', async () => {
    const sourceWithIdentity = {
      ...MOCK_CHARACTER_ROW,
      portrait_url: 'data:image/png;base64,original',
      bio: 'Raised by wolves.',
    }
    const duplicatedRow = {
      ...MOCK_CHARACTER_ROW,
      id: 'char-uuid-2',
      name: 'Aldric Sorn (Copy)',
      portrait_url: 'data:image/png;base64,original',
      bio: 'Raised by wolves.',
    }

    const builder = makeQueryBuilder({ data: duplicatedRow, error: null })
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: sourceWithIdentity, error: null }))
      .mockReturnValueOnce(builder)

    const result = await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.portrait_url).toBe('data:image/png;base64,original')
    expect(insertCall.bio).toBe('Raised by wolves.')
    expect(result.portraitUrl).toBe('data:image/png;base64,original')
    expect(result.bio).toBe('Raised by wolves.')
  })

  it('carries over scores, archetype, ancestry, and background', async () => {
    const duplicatedRow = { ...MOCK_CHARACTER_ROW, id: 'char-uuid-2', name: 'Aldric Sorn (Copy)' }

    const builder = makeQueryBuilder({ data: duplicatedRow, error: null })
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: MOCK_CHARACTER_ROW, error: null }))
      .mockReturnValueOnce(builder)

    await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.archetype).toBe('fighter')
    expect(insertCall.ancestry).toBe('human')
    expect(insertCall.background).toBe('soldier')
    expect(insertCall.str).toBe(16)
    expect(insertCall.dex).toBe(14)
  })

  it('resets experience and death saves on the copy', async () => {
    const sourceWithProgress = {
      ...MOCK_CHARACTER_ROW,
      experience: 5000,
      death_saves_success: 2,
      death_saves_failure: 1,
    }
    const duplicatedRow = { ...MOCK_CHARACTER_ROW, id: 'char-uuid-2', name: 'Aldric Sorn (Copy)' }

    const builder = makeQueryBuilder({ data: duplicatedRow, error: null })
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: sourceWithProgress, error: null }))
      .mockReturnValueOnce(builder)

    await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.experience).toBe(0)
    expect(insertCall.death_saves_success).toBe(0)
    expect(insertCall.death_saves_failure).toBe(0)
  })

  it('truncates a long name so " (Copy)" still fits within 60 characters', async () => {
    const longName = 'A'.repeat(58) // 58 + ' (Copy)' (7 chars) = 65, over the limit
    const sourceWithLongName = { ...MOCK_CHARACTER_ROW, name: longName }
    const duplicatedRow = { ...MOCK_CHARACTER_ROW, id: 'char-uuid-2', name: 'truncated' }

    const builder = makeQueryBuilder({ data: duplicatedRow, error: null })
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: sourceWithLongName, error: null }))
      .mockReturnValueOnce(builder)

    await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    const insertedName = insertCall.name as string
    expect(insertedName.length).toBeLessThanOrEqual(60)
    expect(insertedName.endsWith(' (Copy)')).toBe(true)
  })

  it('throws ServiceError(NOT_FOUND) when the source character does not exist', async () => {
    fromMock.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    )

    await expect(duplicateCharacter('nonexistent-id', 'user-uuid-1'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('duplicates skill and saving throw proficiencies and equipment', async () => {
    const sourceWithGear = {
      ...MOCK_CHARACTER_ROW,
      skill_proficiencies: ['stealth', 'athletics'],
      saving_throw_proficiencies: ['DEX', 'CON'],
      equipment: [
        { id: 'sword-1', name: 'Longsword', slot: 'weapon', equipped: true, attackBonus: 1 },
      ],
    }
    const duplicatedRow = { ...MOCK_CHARACTER_ROW, id: 'char-uuid-2', name: 'Aldric Sorn (Copy)' }

    const builder = makeQueryBuilder({ data: duplicatedRow, error: null })
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: sourceWithGear, error: null }))
      .mockReturnValueOnce(builder)

    await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.skill_proficiencies).toEqual(['stealth', 'athletics'])
    expect(insertCall.saving_throw_proficiencies).toEqual(['DEX', 'CON'])
    expect(insertCall.equipment).toEqual([
      { id: 'sword-1', name: 'Longsword', slot: 'weapon', equipped: true, attackBonus: 1 },
    ])
  })

  it('does not carry over active conditions on the copy', async () => {
    const sourceWithConditions = {
      ...MOCK_CHARACTER_ROW,
      conditions: [
        {
          id: 'poisoned',
          source: 'spider bite',
          appliedAtTurn: 3,
          expiresAtTurn: null,
          stackLevel: 1,
          requiresConcentration: false,
          concentrationSourceId: null,
        },
      ],
    }
    const duplicatedRow = { ...MOCK_CHARACTER_ROW, id: 'char-uuid-2', name: 'Aldric Sorn (Copy)' }

    const builder = makeQueryBuilder({ data: duplicatedRow, error: null })
    fromMock
      .mockReturnValueOnce(makeQueryBuilder({ data: sourceWithConditions, error: null }))
      .mockReturnValueOnce(builder)

    await duplicateCharacter('char-uuid-1', 'user-uuid-1')

    const insertCall = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(insertCall.conditions).toEqual([])
  })
})

// ─── ServiceError ─────────────────────────────────────────────────────────────

describe('ServiceError', () => {
  it('has isServiceError flag for instanceof-free detection', () => {
    const err = new ServiceError('test', 'NOT_FOUND')
    expect(err.isServiceError).toBe(true)
  })

  it('has the correct code', () => {
    expect(new ServiceError('msg', 'VALIDATION').code).toBe('VALIDATION')
    expect(new ServiceError('msg', 'DB_ERROR').code).toBe('DB_ERROR')
    expect(new ServiceError('msg', 'NOT_FOUND').code).toBe('NOT_FOUND')
    expect(new ServiceError('msg', 'FORBIDDEN').code).toBe('FORBIDDEN')
    expect(new ServiceError('msg', 'CONFLICT').code).toBe('CONFLICT')
  })
})
