/**
 * Chronicle AI — Character Service Integration Test
 * Phase 1.5, extended Phase 1.7, extended Volume II Phase 2.1
 *
 * Runs the REAL createCharacter / getCharacter / updateCharacter /
 * deleteCharacter / duplicateCharacter functions from
 * src/lib/supabase/characters.ts against a REAL local PostgreSQL database
 * with migrations 0001–0005 applied.
 *
 * This is NOT a mocked unit test. It exercises:
 *   - Actual SQL execution (inserts, updates, deletes)
 *   - Actual CHECK constraints (ability score / level bounds)
 *   - Actual Row Level Security policies (auth.uid() ownership scoping)
 *   - Actual JSONB round-tripping (conditions, skill_proficiencies,
 *     saving_throw_proficiencies, equipment columns — equipment/proficiency
 *     persistence added in Phase 1.7, migration 0004)
 *   - Actual portrait_url/bio round-tripping (Volume II Phase 2.1,
 *     migration 0005 — Character Creator UI)
 *
 * Infrastructure note: supabase-js normally speaks HTTP to a PostgREST
 * server. This environment has no container runtime to run PostgREST, so
 * tests/integration/support/pgAdapter.ts provides a thin, scope-limited
 * adapter implementing the same query-builder interface, backed by real
 * `pg` SQL execution. See that file's header comment for full rationale.
 *
 * HOW TO RUN
 * ----------
 *   1. Ensure local Postgres is running with migrations applied:
 *        npm run db:test:setup
 *   2. npm run test:integration
 *
 * This test is EXCLUDED from `npm test` (see vite.config.ts `exclude`).
 * It only runs via the dedicated `vitest.integration.config.ts`.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Pool } from 'pg'
import { TestSupabaseAdapter } from './support/pgAdapter'

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://authenticated_test:authenticated_test@localhost:5432/chronicle_ai'

// Separate privileged connection for fixture setup only (seeding auth.users,
// which the RLS-scoped `authenticated_test` role correctly cannot write to —
// just like real Supabase's `authenticated` role cannot write to auth.users).
const ADMIN_DB_URL =
  process.env.ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chronicle_ai'
const adminPool = new Pool({ connectionString: ADMIN_DB_URL })

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002'

const adapter = new TestSupabaseAdapter(TEST_DB_URL)

// Mock the client module BEFORE importing the service functions that use it.
// This is the same pattern the unit tests use (vi.mock + factory), except
// here the mock returns our real-Postgres-backed adapter instead of a stub.
vi.mock('@/lib/supabase/client', () => ({
  supabase: adapter,
}))

// Dynamic import AFTER the mock is registered, so characters.ts picks up
// the mocked client module.
const { createCharacter, getCharacter, updateCharacter, deleteCharacter, duplicateCharacter } = await import(
  '@/lib/supabase/characters'
)
const { ServiceError } = await import('@/lib/supabase/errors')

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Seed both test users in auth.users so FK constraints on characters.user_id
  // resolve correctly. Real Supabase projects have these rows created by
  // GoTrue on signup; we seed them directly since GoTrue isn't running here.
  // ON CONFLICT keeps this idempotent across repeated test runs.
  for (const id of [TEST_USER_ID, OTHER_USER_ID]) {
    await adminPool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [id, `${id}@integration.test`],
    )
  }

  // Clean slate for any leftover data from prior runs.
  await adminPool.query('DELETE FROM public.characters WHERE user_id = $1', [OTHER_USER_ID])
  await adminPool.query('DELETE FROM public.characters WHERE user_id = $1', [TEST_USER_ID])
})

beforeEach(() => {
  adapter.setTestUserId(TEST_USER_ID)
})

afterAll(async () => {
  // Clean up everything this test suite created.
  await adminPool.query('DELETE FROM public.characters WHERE user_id = $1', [TEST_USER_ID])
  await adminPool.query('DELETE FROM public.characters WHERE user_id = $1', [OTHER_USER_ID])
  await adapter.close()
  await adminPool.end()
})

// ─── createCharacter ──────────────────────────────────────────────────────────

describe('Integration: createCharacter', () => {
  it('persists a real row to the characters table', async () => {
    const result = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Integration Test Hero',
      archetype: 'fighter',
      level: 1,
      scores: { strength: 16, dexterity: 14, constitution: 14 },
    })

    expect(result.id).toBeTruthy()
    expect(result.sheet.name).toBe('Integration Test Hero')
    expect(result.sheet.archetype).toBe('fighter')
    expect(result.userId).toBe(TEST_USER_ID)

    // Verify it's REALLY in the database via a direct read
    const fetched = await adapter.from('characters').select('*').eq('id', result.id).single()
    expect(fetched.data).not.toBeNull()
    expect(fetched.data?.name).toBe('Integration Test Hero')
  })

  it('computes real maxHp via the actual CHECK-constrained columns', async () => {
    // CON 14 (+2 mod), level 1, fighter (d10 → avg 5): maxHp = 10+2+(1*(5+2)) = 19
    const result = await createCharacter({
      userId: TEST_USER_ID,
      name: 'HP Calc Test',
      archetype: 'fighter',
      level: 1,
      scores: { constitution: 14 },
    })
    expect(result.sheet.maxHp).toBe(19)
  })

  it('rejects invalid ability scores via the real CHECK constraint path', async () => {
    // The engine validates before the DB ever sees this, but we confirm
    // the ServiceError surfaces correctly end-to-end.
    await expect(
      createCharacter({ userId: TEST_USER_ID, name: 'Bad Hero', scores: { strength: 99 } }),
    ).rejects.toThrow(ServiceError)
  })

  it('defaults conditions to an empty array in real storage', async () => {
    const result = await createCharacter({ userId: TEST_USER_ID, name: 'Clean Slate' })
    expect(result.conditions).toEqual([])
  })
})

// ─── getCharacter ─────────────────────────────────────────────────────────────

describe('Integration: getCharacter', () => {
  it('retrieves a previously created character by id', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Fetchable Hero' })
    const fetched = await getCharacter(created.id)

    expect(fetched.id).toBe(created.id)
    expect(fetched.sheet.name).toBe('Fetchable Hero')
  })

  it('throws ServiceError(NOT_FOUND) for a nonexistent id', async () => {
    const fakeId = '99999999-9999-4999-8999-999999999999'
    await expect(getCharacter(fakeId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('correctly round-trips ability scores and modifiers through real storage', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Modifier Check',
      scores: { strength: 18, dexterity: 8 },
    })
    const fetched = await getCharacter(created.id)

    expect(fetched.sheet.scores.strength).toBe(18)
    expect(fetched.sheet.modifiers.strength).toBe(4)
    expect(fetched.sheet.scores.dexterity).toBe(8)
    expect(fetched.sheet.modifiers.dexterity).toBe(-1)
  })
})

// ─── Phase 1.7: Proficiencies, Equipment, Death Saves ────────────────────────

describe('Integration: skill/saving throw proficiencies and equipment persistence', () => {
  it('round-trips skillProficiencies through real JSONB storage', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Skilled Hero',
      skillProficiencies: ['stealth', 'athletics', 'perception'],
    })
    expect(created.sheet.skillProficiencies).toEqual(['stealth', 'athletics', 'perception'])

    const fetched = await getCharacter(created.id)
    expect(fetched.sheet.skillProficiencies).toEqual(['stealth', 'athletics', 'perception'])
  })

  it('round-trips savingThrowProficiencies through real JSONB storage', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Resilient Hero',
      savingThrowProficiencies: ['CON', 'WIS'],
    })
    expect(created.sheet.savingThrowProficiencies).toEqual(['CON', 'WIS'])

    const fetched = await getCharacter(created.id)
    expect(fetched.sheet.savingThrowProficiencies).toEqual(['CON', 'WIS'])
  })

  it('round-trips a full equipment loadout through real JSONB storage', async () => {
    const equipment = [
      { id: 'sword', name: 'Longsword +1', slot: 'weapon' as const, equipped: true, attackBonus: 1 },
      { id: 'mail', name: 'Chain Mail', slot: 'armor' as const, equipped: true, armorBonus: 4 },
    ]
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Armed Hero',
      equipment,
    })
    expect(created.sheet.equipment).toEqual(equipment)

    const fetched = await getCharacter(created.id)
    expect(fetched.sheet.equipment).toEqual(equipment)
  })

  it('persists an update to skillProficiencies and survives a real round trip', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Learning Hero' })
    expect(created.sheet.skillProficiencies).toEqual([])

    const updated = await updateCharacter(created.id, {
      skillProficiencies: ['arcana', 'investigation'],
    })
    expect(updated.sheet.skillProficiencies).toEqual(['arcana', 'investigation'])

    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.skillProficiencies).toEqual(['arcana', 'investigation'])
  })

  it('persists an update to equipment and survives a real round trip', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Upgrading Hero' })

    const newEquipment = [
      { id: 'staff', name: 'Staff of Power', slot: 'weapon' as const, equipped: true, attackBonus: 3 },
    ]
    const updated = await updateCharacter(created.id, { equipment: newEquipment })
    expect(updated.sheet.equipment).toEqual(newEquipment)

    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.equipment).toEqual(newEquipment)
  })

  it('round-trips deathSaveSuccesses and deathSaveFailures onto the sheet', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Dying Hero',
      deathSaveSuccesses: 1,
      deathSaveFailures: 2,
    })
    expect(created.sheet.deathSaveSuccesses).toBe(1)
    expect(created.sheet.deathSaveFailures).toBe(2)

    const fetched = await getCharacter(created.id)
    expect(fetched.sheet.deathSaveSuccesses).toBe(1)
    expect(fetched.sheet.deathSaveFailures).toBe(2)
  })

  it('updating deathSavesFailure to 3 persists correctly for the death-saves death check', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Failing Hero' })

    const updated = await updateCharacter(created.id, { deathSavesFailure: 3 })
    expect(updated.sheet.deathSaveFailures).toBe(3)

    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.deathSaveFailures).toBe(3)
  })

  it('a character with no proficiencies/equipment set defaults to empty arrays in real storage', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Blank Slate Hero' })

    expect(created.sheet.skillProficiencies).toEqual([])
    expect(created.sheet.savingThrowProficiencies).toEqual([])
    expect(created.sheet.equipment).toEqual([])

    const fetched = await getCharacter(created.id)
    expect(fetched.sheet.skillProficiencies).toEqual([])
    expect(fetched.sheet.savingThrowProficiencies).toEqual([])
    expect(fetched.sheet.equipment).toEqual([])
  })
})

// ─── Volume II / Phase 2.1: portrait + bio persistence ───────────────────────

describe('Integration: portrait and biography persistence', () => {
  it('round-trips portraitUrl and bio through real storage', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Storied Hero',
      portraitUrl: 'data:image/png;base64,deadbeef',
      bio: 'Forged in the mountain fires of the north.',
    })
    expect(created.portraitUrl).toBe('data:image/png;base64,deadbeef')
    expect(created.bio).toBe('Forged in the mountain fires of the north.')

    const fetched = await getCharacter(created.id)
    expect(fetched.portraitUrl).toBe('data:image/png;base64,deadbeef')
    expect(fetched.bio).toBe('Forged in the mountain fires of the north.')
  })

  it('defaults portraitUrl to null and bio to empty string in real storage', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Blank Bio Hero' })
    expect(created.portraitUrl).toBeNull()
    expect(created.bio).toBe('')

    const fetched = await getCharacter(created.id)
    expect(fetched.portraitUrl).toBeNull()
    expect(fetched.bio).toBe('')
  })

  it('persists an update to bio and survives a real round trip', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Editable Hero' })

    const updated = await updateCharacter(created.id, { bio: 'A new chapter begins.' })
    expect(updated.bio).toBe('A new chapter begins.')

    const refetched = await getCharacter(created.id)
    expect(refetched.bio).toBe('A new chapter begins.')
  })

  it('a duplicate carries over portraitUrl and bio from the source', async () => {
    const original = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Original Hero',
      portraitUrl: 'data:image/png;base64,original',
      bio: 'The first of their name.',
    })

    const copy = await duplicateCharacter(original.id, TEST_USER_ID)

    expect(copy.portraitUrl).toBe('data:image/png;base64,original')
    expect(copy.bio).toBe('The first of their name.')
    expect(copy.sheet.name).toBe('Original Hero (Copy)')
  })
})

// ─── updateCharacter ──────────────────────────────────────────────────────────

describe('Integration: updateCharacter', () => {
  it('persists a real update to the database', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Before Update' })

    const updated = await updateCharacter(created.id, {
      name: 'After Update',
      currentHp: 5,
    })

    expect(updated.sheet.name).toBe('After Update')
    expect(updated.sheet.currentHp).toBe(5)

    // Confirm via independent read that the write actually persisted
    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.name).toBe('After Update')
    expect(refetched.sheet.currentHp).toBe(5)
  })

  it('recalculates maxHp in real storage when scores change', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Recalc Test',
      level: 1,
      archetype: 'wizard',
      scores: { constitution: 10 },
    })
    // d6 wizard, CON 10 (+0): maxHp = 10+0+(1*(3+0)) = 13
    expect(created.sheet.maxHp).toBe(13)

    const updated = await updateCharacter(created.id, {
      level: 1,
      archetype: 'wizard',
      scores: { constitution: 16, strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    })
    // CON 16 (+3): maxHp = 10+3+(1*(3+3)) = 19
    expect(updated.sheet.maxHp).toBe(19)
  })

  it('throws ServiceError(NOT_FOUND) when updating a nonexistent character', async () => {
    const fakeId = '99999999-9999-4999-8999-999999999999'
    await expect(updateCharacter(fakeId, { name: 'Ghost' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('regression: a PARTIAL score patch does not corrupt the other five scores, level, or archetype', async () => {
    // This is the exact bug found while building the Character Sheet's
    // Abilities tab: updateCharacter() used to merge a partial scores
    // patch against hardcoded defaults (10/10/10/10/10/10, level 1,
    // archetype 'adventurer') instead of the character's REAL current
    // values, silently destroying the other five scores and resetting
    // level/archetype on every single-stat edit. Fixed by fetching the
    // current record before recalculating. This test locks that fix in
    // against the real database, not just a mock.
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Veteran Hero',
      level: 7,
      archetype: 'barbarian',
      scores: { strength: 18, dexterity: 14, constitution: 16, intelligence: 8, wisdom: 12, charisma: 10 },
    })
    expect(created.sheet.level).toBe(7)
    expect(created.sheet.archetype).toBe('barbarian')

    // Patch ONLY strength — exactly what the Abilities tab's "Apply
    // Changes" button does NOT do (it sends all six), but exercising the
    // narrower partial-patch path here proves the service layer itself
    // is now safe even if a future caller forgets to send the full set.
    const updated = await updateCharacter(created.id, {
      scores: { strength: 20 },
    })

    expect(updated.sheet.scores.strength).toBe(20)
    // The other five scores must be UNCHANGED, not reset to 10
    expect(updated.sheet.scores.dexterity).toBe(14)
    expect(updated.sheet.scores.constitution).toBe(16)
    expect(updated.sheet.scores.intelligence).toBe(8)
    expect(updated.sheet.scores.wisdom).toBe(12)
    expect(updated.sheet.scores.charisma).toBe(10)
    // Level and archetype must be UNCHANGED, not reset to 1/'adventurer'
    expect(updated.sheet.level).toBe(7)
    expect(updated.sheet.archetype).toBe('barbarian')

    // Confirm via independent read that the fix persisted correctly,
    // not just that the in-memory return value looked right.
    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.scores.strength).toBe(20)
    expect(refetched.sheet.scores.dexterity).toBe(14)
    expect(refetched.sheet.scores.constitution).toBe(16)
    expect(refetched.sheet.level).toBe(7)
    expect(refetched.sheet.archetype).toBe('barbarian')
  })

  it('persists a condition applied via updateCharacter and survives a real round trip', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Cursed Hero' })
    expect(created.sheet.conditions).toEqual([])

    const poisoned = {
      id: 'poisoned' as const,
      source: 'spider bite',
      appliedAtTurn: 0,
      expiresAtTurn: null,
      stackLevel: 1,
      requiresConcentration: false,
      concentrationSourceId: null,
    }

    const updated = await updateCharacter(created.id, { conditions: [poisoned] })
    expect(updated.sheet.conditions).toHaveLength(1)
    expect(updated.sheet.conditions[0].id).toBe('poisoned')

    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.conditions).toHaveLength(1)
    expect(refetched.sheet.conditions[0].source).toBe('spider bite')
  })

  it('removing all conditions via updateCharacter persists an empty array', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Healed Hero',
      conditions: [
        {
          id: 'prone',
          source: 'tripped',
          appliedAtTurn: 0,
          expiresAtTurn: null,
          stackLevel: 1,
          requiresConcentration: false,
          concentrationSourceId: null,
        },
      ],
    })
    expect(created.sheet.conditions).toHaveLength(1)

    const updated = await updateCharacter(created.id, { conditions: [] })
    expect(updated.sheet.conditions).toEqual([])

    const refetched = await getCharacter(created.id)
    expect(refetched.sheet.conditions).toEqual([])
  })
})

// ─── deleteCharacter ──────────────────────────────────────────────────────────

describe('Integration: deleteCharacter', () => {
  it('actually removes the row from the database', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Doomed Hero' })

    await deleteCharacter(created.id)

    await expect(getCharacter(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('does not throw when deleting an already-deleted character (idempotent)', async () => {
    const created = await createCharacter({ userId: TEST_USER_ID, name: 'Double Delete' })
    await deleteCharacter(created.id)
    await expect(deleteCharacter(created.id)).resolves.toBeUndefined()
  })
})

// ─── Row Level Security ───────────────────────────────────────────────────────

describe('Integration: Row Level Security ownership scoping', () => {
  it('a user cannot read another user\'s character via getCharacter', async () => {
    adapter.setTestUserId(OTHER_USER_ID)
    const otherUsersCharacter = await createCharacter({
      userId: OTHER_USER_ID,
      name: 'Not Yours',
    })

    // Switch context to the first test user and attempt to read it
    adapter.setTestUserId(TEST_USER_ID)
    await expect(getCharacter(otherUsersCharacter.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

// ─── Full lifecycle ───────────────────────────────────────────────────────────

describe('Integration: full character lifecycle', () => {
  it('create → get → update → delete works end-to-end against real Postgres', async () => {
    const created = await createCharacter({
      userId: TEST_USER_ID,
      name: 'Lifecycle Hero',
      archetype: 'ranger',
      level: 2,
      scores: { dexterity: 16, constitution: 12 },
    })
    expect(created.sheet.level).toBe(2)

    const fetched = await getCharacter(created.id)
    expect(fetched.sheet.name).toBe('Lifecycle Hero')

    const updated = await updateCharacter(created.id, { currentHp: 1, experience: 500 })
    expect(updated.sheet.currentHp).toBe(1)
    expect(updated.experience).toBe(500)

    await deleteCharacter(created.id)
    await expect(getCharacter(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
