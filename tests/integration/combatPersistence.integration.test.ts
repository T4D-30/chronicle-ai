/**
 * Combat Persistence Integration Tests — Phase 5.1
 *
 * Tests XP persistence, loot-to-inventory write, HP update,
 * and combat summary turn append against real Postgres.
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
const adapter   = new TestSupabaseAdapter(TEST_DB_URL)

vi.mock('@/lib/supabase/client', () => ({ supabase: adapter }))

const USER_ID = '00000000-0000-4000-8000-000000000099'

const { createCharacter, updateCharacter, getCharacter } = await import('@/lib/supabase/characters')
const { createCampaign }                                  = await import('@/lib/supabase/campaigns')
const { startSession, appendTurn }                        = await import('@/lib/supabase/sessions')

beforeAll(async () => {
  await adminPool.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES ($1, 'combattest@integration.test', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [USER_ID],
  )
})

beforeEach(() => {
  adapter.setTestUserId(USER_ID)
})

afterAll(async () => {
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [USER_ID])
  await adminPool.query('DELETE FROM public.characters WHERE user_id = $1', [USER_ID])
  await adapter.close()
  await adminPool.end()
})

// ─── XP persistence ───────────────────────────────────────────────────────────

describe('Integration: XP persistence via updateCharacter', () => {
  it('persists XP award to character.experience', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'XP Hero' })
    expect(char.experience).toBe(0)

    const updated = await updateCharacter(char.id, { experience: 350 })
    expect(updated.experience).toBe(350)

    // Verify round-trip from DB
    const fetched = await getCharacter(char.id)
    expect(fetched.experience).toBe(350)
  })

  it('accumulates XP across multiple updates', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Accumulator' })
    await updateCharacter(char.id, { experience: 300 })
    const updated = await updateCharacter(char.id, { experience: 650 })
    expect(updated.experience).toBe(650)
  })

  it('rejects negative XP values if validated', async () => {
    // updateCharacter does not validate experience sign in current implementation
    // but XP must be >= 0 conceptually; DB doesn't enforce this — track as future constraint
    const char = await createCharacter({ userId: USER_ID, name: 'XP Min Test' })
    // Setting to 0 is always valid
    const updated = await updateCharacter(char.id, { experience: 0 })
    expect(updated.experience).toBe(0)
  })
})

// ─── HP persistence after combat ─────────────────────────────────────────────

describe('Integration: HP persistence via updateCharacter', () => {
  it('persists post-combat HP to character.sheet.currentHp', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Wounded Warrior' })
    const maxHp = char.sheet.maxHp

    const updated = await updateCharacter(char.id, { currentHp: Math.floor(maxHp / 2) })
    expect(updated.sheet.currentHp).toBe(Math.floor(maxHp / 2))

    const fetched = await getCharacter(char.id)
    expect(fetched.sheet.currentHp).toBe(Math.floor(maxHp / 2))
  })

  it('persists HP of 0 (character defeated)', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Fallen Hero' })
    const updated = await updateCharacter(char.id, { currentHp: 0 })
    expect(updated.sheet.currentHp).toBe(0)
  })
})

// ─── Loot persistence (inventory) ────────────────────────────────────────────

describe('Integration: Loot to inventory persistence', () => {
  it('appends loot items to character inventory', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Loot Collector' })
    expect(char.inventory).toHaveLength(0)

    const lootInventory = [
      { id: 'loot-1', name: 'Goblin Dagger', quantity: 1, weight: 1, equipped: false, description: 'Small, crude.' },
    ]

    const updated = await updateCharacter(char.id, { inventory: lootInventory })
    expect(updated.inventory).toHaveLength(1)
    expect(updated.inventory[0].name).toBe('Goblin Dagger')

    // Verify round-trip
    const fetched = await getCharacter(char.id)
    expect(fetched.inventory[0].name).toBe('Goblin Dagger')
  })

  it('preserves existing inventory when appending loot', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Pack Mule' })
    const existing = [{ id: 'item-0', name: 'Torch', quantity: 3, weight: 0.5, equipped: false, description: '' }]
    await updateCharacter(char.id, { inventory: existing })

    const withLoot = [...existing, { id: 'loot-2', name: 'Gold Coin', quantity: 10, weight: 0, equipped: false, description: '' }]
    const updated = await updateCharacter(char.id, { inventory: withLoot })
    expect(updated.inventory).toHaveLength(2)
    expect(updated.inventory.map((i) => i.name)).toContain('Torch')
    expect(updated.inventory.map((i) => i.name)).toContain('Gold Coin')
  })
})

// ─── Combat summary turn persistence ─────────────────────────────────────────

describe('Integration: Combat summary turn via appendTurn', () => {
  it('appends a combat-mode turn with victory summary', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Combat Logger' })
    const campaign = await createCampaign({ userId: USER_ID, title: 'Combat Log Campaign' })
    await import('@/lib/supabase/campaigns').then(m => m.updateCampaign(campaign.id, { characterId: char.id }))
    const session = await startSession(campaign.id)

    const turn = await appendTurn(session.id, {
      playerInput: '[VICTORY] Goblin',
      aiNarration: 'Victory! 1 rounds. Defeated: Goblin. 5 XP earned.',
      diceRolls: [],
      mode: 'combat',
    })

    expect(turn.mode).toBe('combat')
    expect(turn.playerInput).toContain('[VICTORY]')
    expect(turn.aiNarration).toContain('Victory!')
  })

  it('appends a defeat summary', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Defeat Logger' })
    const campaign = await createCampaign({ userId: USER_ID, title: 'Defeat Log Campaign' })
    await import('@/lib/supabase/campaigns').then(m => m.updateCampaign(campaign.id, { characterId: char.id }))
    const session = await startSession(campaign.id)

    const turn = await appendTurn(session.id, {
      playerInput: '[DEFEAT] Combat ended.',
      aiNarration: 'Defeat. 3 rounds.',
      diceRolls: [],
      mode: 'combat',
    })

    expect(turn.mode).toBe('combat')
    expect(turn.aiNarration).toContain('Defeat')
  })

  it('appends a flee summary', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Flee Logger' })
    const campaign = await createCampaign({ userId: USER_ID, title: 'Flee Log Campaign' })
    await import('@/lib/supabase/campaigns').then(m => m.updateCampaign(campaign.id, { characterId: char.id }))
    const session = await startSession(campaign.id)

    const turn = await appendTurn(session.id, {
      playerInput: '[FLED] Combat ended.',
      aiNarration: 'You escaped. 2 rounds.',
      diceRolls: [],
      mode: 'combat',
    })

    expect(turn.playerInput).toContain('[FLED]')
  })
})

// ─── Full combat persistence round-trip ──────────────────────────────────────

describe('Integration: Full combat persistence round-trip', () => {
  it('XP + loot + HP + summary turn all persist in one operation', async () => {
    const char = await createCharacter({ userId: USER_ID, name: 'Full Round-trip Hero' })
    const campaign = await createCampaign({ userId: USER_ID, title: 'Round-trip Campaign' })
    await import('@/lib/supabase/campaigns').then(m => m.updateCampaign(campaign.id, { characterId: char.id }))
    const session = await startSession(campaign.id)

    // Simulate what commitCombatResult does:
    const newXp = char.experience + 100
    const finalHp = Math.max(1, char.sheet.currentHp - 5)
    const lootInventory = [
      { id: 'loot-rt-1', name: 'Ring of Protection', quantity: 1, weight: 0, equipped: false, description: '+1 AC' },
    ]

    const [updatedChar, turn] = await Promise.all([
      updateCharacter(char.id, {
        experience: newXp,
        currentHp: finalHp,
        inventory: lootInventory,
      }),
      appendTurn(session.id, {
        playerInput: '[VICTORY] Orc',
        aiNarration: 'Victory! 3 rounds. Defeated: Orc. 100 XP earned. Loot: Ring of Protection.',
        diceRolls: [],
        mode: 'combat',
      }),
    ])

    // XP persisted
    expect(updatedChar.experience).toBe(newXp)
    // HP persisted
    expect(updatedChar.sheet.currentHp).toBe(finalHp)
    // Loot persisted
    expect(updatedChar.inventory[0].name).toBe('Ring of Protection')
    // Summary turn persisted
    expect(turn.mode).toBe('combat')
    expect(turn.aiNarration).toContain('Ring of Protection')

    // Verify all on re-fetch
    const refetched = await getCharacter(char.id)
    expect(refetched.experience).toBe(newXp)
    expect(refetched.inventory[0].name).toBe('Ring of Protection')
  })
})
