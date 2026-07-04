/**
 * Chronicle AI — Google OAuth Profile Provisioning Integration Tests
 * Phase 10.5
 *
 * Tests the REAL public.handle_new_user() trigger (migrations 0001 +
 * 0007_google_oauth_provisioning.sql) against real Postgres — this is
 * database-level logic no application code path exercises (only
 * Supabase Auth itself inserts into auth.users; this test does the same
 * via a direct admin connection, exactly mirroring what a real Google
 * OAuth sign-in produces).
 *
 * Does NOT use TestSupabaseAdapter — that adapter exists to stand in for
 * supabase-js's query builder for application-level reads/writes.
 * Inserting into auth.users is not something application code ever does;
 * only Supabase Auth's own internal signup flow does it. A direct `pg`
 * connection is the correct and only way to test this trigger honestly.
 *
 * HOW TO RUN
 * ----------
 *   1. npm run db:test:setup
 *   2. npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'

const ADMIN_DB_URL =
  process.env.ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chronicle_ai'
const RLS_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://authenticated_test:authenticated_test@localhost:5432/chronicle_ai'

const adminPool = new Pool({ connectionString: ADMIN_DB_URL })

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@integration.test`
}

async function insertAuthUser(id: string, email: string, rawUserMetaData: Record<string, unknown>) {
  await adminPool.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)`,
    [id, email, JSON.stringify(rawUserMetaData)],
  )
}

async function getProfile(id: string) {
  const result = await adminPool.query(
    `SELECT id, display_name, avatar_url FROM public.profiles WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

async function countProfiles(id: string): Promise<number> {
  const result = await adminPool.query(`SELECT count(*)::int AS count FROM public.profiles WHERE id = $1`, [id])
  return result.rows[0].count
}

async function cleanupUser(id: string) {
  await adminPool.query(`DELETE FROM auth.users WHERE id = $1`, [id])
}

beforeAll(async () => {
  await adminPool.query('SELECT 1')
})

afterAll(async () => {
  await adminPool.end()
})

describe('Integration: handle_new_user() trigger — Google OAuth provisioning', () => {
  const userId = '10000000-0000-4000-8000-000000000001'

  beforeEach(async () => {
    await cleanupUser(userId)
  })

  it('creates exactly one profiles row automatically when a Google-style user is inserted into auth.users', async () => {
    await insertAuthUser(userId, uniqueEmail('google-new'), {
      full_name: 'Aldric Sorn',
      avatar_url: 'https://lh3.googleusercontent.com/photo.jpg',
      email_verified: true,
      iss: 'https://accounts.google.com',
    })

    const count = await countProfiles(userId)
    expect(count).toBe(1)
  })

  it('populates display_name from full_name for a Google user (no display_name key present)', async () => {
    await insertAuthUser(userId, uniqueEmail('google-name'), {
      full_name: 'Aldric Sorn',
      avatar_url: 'https://lh3.googleusercontent.com/photo.jpg',
    })

    const profile = await getProfile(userId)
    expect(profile.display_name).toBe('Aldric Sorn')
  })

  it('populates avatar_url from Google metadata', async () => {
    await insertAuthUser(userId, uniqueEmail('google-avatar'), {
      full_name: 'Aldric Sorn',
      avatar_url: 'https://lh3.googleusercontent.com/photo.jpg',
    })

    const profile = await getProfile(userId)
    expect(profile.avatar_url).toBe('https://lh3.googleusercontent.com/photo.jpg')
  })

  it('falls back to the "name" key for display_name when full_name is absent', async () => {
    await insertAuthUser(userId, uniqueEmail('google-name-fallback'), {
      name: 'Camila Tello',
    })

    const profile = await getProfile(userId)
    expect(profile.display_name).toBe('Camila Tello')
  })

  it('falls back to the "picture" key for avatar_url when avatar_url is absent', async () => {
    await insertAuthUser(userId, uniqueEmail('google-picture-fallback'), {
      full_name: 'Aldric Sorn',
      picture: 'https://lh3.googleusercontent.com/other-photo.jpg',
    })

    const profile = await getProfile(userId)
    expect(profile.avatar_url).toBe('https://lh3.googleusercontent.com/other-photo.jpg')
  })

  it('prefers display_name over full_name/name if somehow both are present (email/password precedence preserved)', async () => {
    await insertAuthUser(userId, uniqueEmail('mixed-metadata'), {
      display_name: 'Explicit Display Name',
      full_name: 'Should Not Win',
    })

    const profile = await getProfile(userId)
    expect(profile.display_name).toBe('Explicit Display Name')
  })
})

describe('Integration: handle_new_user() trigger — email/password provisioning (regression, unchanged by 0007)', () => {
  const userId = '10000000-0000-4000-8000-000000000002'

  beforeEach(async () => {
    await cleanupUser(userId)
  })

  it('still populates display_name from the display_name key for email/password sign-up', async () => {
    await insertAuthUser(userId, uniqueEmail('emailpw'), { display_name: 'Camila Tello' })
    const profile = await getProfile(userId)
    expect(profile.display_name).toBe('Camila Tello')
  })

  it('leaves avatar_url null for an email/password user — no avatar data ever provided', async () => {
    await insertAuthUser(userId, uniqueEmail('emailpw-avatar'), { display_name: 'Camila Tello' })
    const profile = await getProfile(userId)
    expect(profile.avatar_url).toBeNull()
  })

  it('creates a profile successfully even with completely empty metadata (display_name and avatar_url both null, never blocking sign-up)', async () => {
    await insertAuthUser(userId, uniqueEmail('empty-metadata'), {})
    const profile = await getProfile(userId)
    expect(profile).not.toBeNull()
    expect(profile.display_name).toBeNull()
    expect(profile.avatar_url).toBeNull()
  })
})

describe('Integration: no duplicate profiles across repeated Google logins', () => {
  const userId = '10000000-0000-4000-8000-000000000003'

  beforeEach(async () => {
    await cleanupUser(userId)
  })

  it('a second Google sign-in for the same user does not create a second profiles row', async () => {
    await insertAuthUser(userId, uniqueEmail('returning-google-user'), {
      full_name: 'Aldric Sorn',
      avatar_url: 'https://lh3.googleusercontent.com/photo.jpg',
    })
    expect(await countProfiles(userId)).toBe(1)

    // Simulate what a real returning Google login does at the database
    // level: Supabase Auth UPDATES the existing auth.users row (e.g. its
    // last_sign_in_at timestamp — not modeled in this project's minimal
    // local auth stub, so this test updates a column the stub genuinely
    // has instead), it never re-INSERTs it. handle_new_user() is an
    // AFTER INSERT trigger — it does not fire on UPDATE, which is exactly
    // why a returning user's profile is never duplicated.
    await adminPool.query(`UPDATE auth.users SET email = $1 WHERE id = $2`, [uniqueEmail('returning-google-user-2'), userId])

    expect(await countProfiles(userId)).toBe(1)
  })

  it('attempting to insert a second auth.users row with the same id fails at the database level (the real duplicate-prevention mechanism)', async () => {
    await insertAuthUser(userId, uniqueEmail('dup-attempt'), { full_name: 'Aldric Sorn' })

    await expect(insertAuthUser(userId, uniqueEmail('dup-attempt-2'), { full_name: 'Aldric Sorn' }))
      .rejects.toThrow()

    expect(await countProfiles(userId)).toBe(1)
  })
})

describe('Integration: RLS compatibility for Google-provisioned profiles', () => {
  const ownerId = '10000000-0000-4000-8000-000000000004'
  const otherUserId = '10000000-0000-4000-8000-000000000005'
  const rlsPool = new Pool({ connectionString: RLS_DB_URL })

  beforeEach(async () => {
    await cleanupUser(ownerId)
    await cleanupUser(otherUserId)
  })

  afterAll(async () => {
    await rlsPool.end()
  })

  it('a Google-provisioned profile is readable by its own owner under RLS', async () => {
    await insertAuthUser(ownerId, uniqueEmail('rls-owner'), { full_name: 'Aldric Sorn' })

    const client = await rlsPool.connect()
    try {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [ownerId])
      const result = await client.query(`SELECT id, display_name FROM public.profiles WHERE id = $1`, [ownerId])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].display_name).toBe('Aldric Sorn')
    } finally {
      client.release()
    }
  })

  it('a Google-provisioned profile is NOT readable by a different authenticated user under RLS — the same owner-only policy applies regardless of sign-up method', async () => {
    await insertAuthUser(ownerId, uniqueEmail('rls-target'), { full_name: 'Aldric Sorn' })
    await insertAuthUser(otherUserId, uniqueEmail('rls-other'), { full_name: 'Someone Else' })

    const client = await rlsPool.connect()
    try {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [otherUserId])
      const result = await client.query(`SELECT id FROM public.profiles WHERE id = $1`, [ownerId])
      expect(result.rows).toHaveLength(0)
    } finally {
      client.release()
    }
  })
})
