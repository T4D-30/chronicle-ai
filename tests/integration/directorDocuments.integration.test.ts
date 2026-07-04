/**
 * Chronicle AI — Director Documents Integration Tests
 * Phase 10.3
 *
 * Tests uploadDirectorDocument, listDirectorDocuments, getDirectorDocument,
 * indexDirectorDocument, deleteDirectorDocument, and FullTextRetriever
 * against real Postgres with migration 0006 applied, RLS enforced.
 *
 * .from()/.rpc() calls in this test run REAL SQL (including the real
 * search_director_documents function — genuine ts_rank/ts_headline
 * behavior, not mocked). .storage calls run against FakeStorageApi (see
 * pgAdapter.ts) — these tests verify the DB-side upload/delete
 * orchestration (metadata correctness, cleanup-on-failure, RLS) but do
 * NOT verify real bytes reach a real object store, which requires a real
 * Supabase project (see KNOWN_LIMITATIONS.md).
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

const TEST_USER_ID  = '00000000-0000-4000-8000-000000000021'
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000022'
let TEST_CAMPAIGN_ID: string

const adapter = new TestSupabaseAdapter(TEST_DB_URL)

vi.mock('@/lib/supabase/client', () => ({ supabase: adapter }))

const {
  uploadDirectorDocument,
  listDirectorDocuments,
  getDirectorDocument,
  indexDirectorDocument,
  getDirectorDocumentSignedUrl,
  deleteDirectorDocument,
} = await import('@/lib/supabase/directorDocuments')

const { FullTextRetriever } = await import('@/lib/directorDocuments/fullTextRetriever')
const { createCampaign } = await import('@/lib/supabase/campaigns')

function makeFile(name: string, type: string, sizeBytes = 100): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

beforeAll(async () => {
  for (const id of [TEST_USER_ID, OTHER_USER_ID]) {
    await adminPool.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [id, `${id}@integration.test`],
    )
  }
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [TEST_USER_ID])
  await adminPool.query('DELETE FROM public.campaigns WHERE user_id = $1', [OTHER_USER_ID])

  adapter.setTestUserId(TEST_USER_ID)
  const campaign = await createCampaign({ userId: TEST_USER_ID, title: 'Document Test Campaign' })
  TEST_CAMPAIGN_ID = campaign.id
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

describe('Integration: uploadDirectorDocument', () => {
  it('uploads a document and returns real metadata', async () => {
    const file = makeFile('lore.pdf', 'application/pdf', 5000)
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID,
      userId: TEST_USER_ID,
      category: 'world_lore',
      file,
    })

    expect(doc.fileName).toBe('lore.pdf')
    expect(doc.fileType).toBe('application/pdf')
    expect(doc.fileSizeBytes).toBe(5000)
    expect(doc.category).toBe('world_lore')
    expect(doc.isIndexed).toBe(false)
    expect(doc.storagePath).toBe(`${TEST_USER_ID}/${doc.id}`)
  })

  it('rejects an unsupported file type before touching Storage or the DB', async () => {
    const file = makeFile('image.png', 'image/png')
    await expect(
      uploadDirectorDocument({ campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'other', file }),
    ).rejects.toThrow(/Unsupported file type/)
  })

  it('persists the row so a subsequent list call finds it', async () => {
    const file = makeFile('rules.txt', 'text/plain')
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'homebrew_rules', file,
    })
    const list = await listDirectorDocuments(TEST_CAMPAIGN_ID)
    expect(list.some((d) => d.id === doc.id)).toBe(true)
  })
})

describe('Integration: listDirectorDocuments / getDirectorDocument', () => {
  it('lists only documents for the given campaign', async () => {
    adapter.setTestUserId(TEST_USER_ID)
    const otherCampaign = await createCampaign({ userId: TEST_USER_ID, title: 'Other Campaign' })
    await uploadDirectorDocument({
      campaignId: otherCampaign.id, userId: TEST_USER_ID, category: 'other',
      file: makeFile('unrelated.txt', 'text/plain'),
    })

    const list = await listDirectorDocuments(TEST_CAMPAIGN_ID)
    expect(list.every((d) => d.campaignId === TEST_CAMPAIGN_ID)).toBe(true)
  })

  it('getDirectorDocument fetches the exact uploaded document by id', async () => {
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'dm_guide',
      file: makeFile('guide.pdf', 'application/pdf'),
    })
    const fetched = await getDirectorDocument(doc.id)
    expect(fetched.id).toBe(doc.id)
    expect(fetched.fileName).toBe('guide.pdf')
  })

  it('a user cannot fetch another user\'s document (RLS)', async () => {
    adapter.setTestUserId(TEST_USER_ID)
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'other',
      file: makeFile('private.txt', 'text/plain'),
    })

    adapter.setTestUserId(OTHER_USER_ID)
    await expect(getDirectorDocument(doc.id)).rejects.toThrow()
  })
})

describe('Integration: indexDirectorDocument', () => {
  it('sets extracted_text and marks the document indexed', async () => {
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'world_lore',
      file: makeFile('lore.pdf', 'application/pdf'),
    })
    expect(doc.isIndexed).toBe(false)

    const indexed = await indexDirectorDocument(doc.id, 'placeholder extracted text for indexing flag test')
    expect(indexed.isIndexed).toBe(true)
  })

  it('passing null text leaves the document unindexed', async () => {
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'other',
      file: makeFile('empty.txt', 'text/plain'),
    })
    const result = await indexDirectorDocument(doc.id, null)
    expect(result.isIndexed).toBe(false)
  })
})

describe('Integration: getDirectorDocumentSignedUrl', () => {
  it('returns a signed URL for an uploaded document', async () => {
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'other',
      file: makeFile('sheet.pdf', 'application/pdf'),
    })
    const url = await getDirectorDocumentSignedUrl(doc.storagePath)
    expect(url).toContain(doc.storagePath)
  })
})

describe('Integration: deleteDirectorDocument', () => {
  it('removes the document from subsequent list calls', async () => {
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'other',
      file: makeFile('to-delete.txt', 'text/plain'),
    })
    await deleteDirectorDocument(doc.id, doc.storagePath)

    const list = await listDirectorDocuments(TEST_CAMPAIGN_ID)
    expect(list.some((d) => d.id === doc.id)).toBe(false)
  })
})

describe('Integration: FullTextRetriever', () => {
  it('finds an indexed document matching the query, with a real ranked excerpt', async () => {
    // Uses a distinctive, test-unique proper noun (Vermithrax) rather than
    // common fantasy words like "dragon"/"treasure" — other tests in this
    // file upload documents into the same shared TEST_CAMPAIGN_ID (matching
    // this project's established integration-test style, which relies on
    // beforeAll/afterAll cleanup rather than per-test isolation) and some
    // of those also legitimately mention "dragon"/"treasure", which made
    // an earlier version of this test flaky by competing for rank #1.
    const doc = await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'world_lore',
      file: makeFile('dragon-lore.pdf', 'application/pdf'),
    })
    await indexDirectorDocument(
      doc.id,
      'The ancient dragon Vermithrax sleeps beneath the Shattered Mountains, guarding a hoard of forgotten treasure.',
    )

    const results = await FullTextRetriever.retrieve(TEST_CAMPAIGN_ID, 'Vermithrax', 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].fileName).toBe('dragon-lore.pdf')
    expect(results[0].excerpt.toLowerCase()).toContain('vermithrax')
    expect(typeof results[0].relevanceScore).toBe('number')
  })

  it('never returns an unindexed document', async () => {
    await uploadDirectorDocument({
      campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'dm_guide',
      file: makeFile('unindexed-guide.pdf', 'application/pdf'),
    })

    const results = await FullTextRetriever.retrieve(TEST_CAMPAIGN_ID, 'guide', 5)
    expect(results.some((r) => r.fileName === 'unindexed-guide.pdf')).toBe(false)
  })

  it('returns an empty array for a query matching nothing', async () => {
    const results = await FullTextRetriever.retrieve(TEST_CAMPAIGN_ID, 'nonexistent_query_xyzzy_zzz', 5)
    expect(results).toEqual([])
  })

  it('returns an empty array immediately for an empty query, without hitting the DB', async () => {
    const results = await FullTextRetriever.retrieve(TEST_CAMPAIGN_ID, '   ', 5)
    expect(results).toEqual([])
  })

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 3; i++) {
      const doc = await uploadDirectorDocument({
        campaignId: TEST_CAMPAIGN_ID, userId: TEST_USER_ID, category: 'other',
        file: makeFile(`multi-${i}.txt`, 'text/plain'),
      })
      await indexDirectorDocument(doc.id, 'goblin ambush goblin raid goblin scouts')
    }
    const results = await FullTextRetriever.retrieve(TEST_CAMPAIGN_ID, 'goblin', 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })
})
