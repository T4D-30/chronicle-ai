/**
 * Chronicle AI — Integration Test Postgres Adapter
 * Phase 1.5 (extended Phase 10.3 for .rpc() and .storage)
 *
 * WHY THIS EXISTS
 * ----------------
 * `supabase-js` speaks HTTP to a PostgREST server. The full local Supabase
 * stack (`supabase start`) runs PostgREST inside Docker. This sandboxed
 * environment has no container runtime, and PostgREST's binary release
 * assets are hosted on a domain not present in this environment's network
 * egress allowlist (release-assets.githubusercontent.com).
 *
 * Real PostgreSQL 16 IS available locally (migrations 0001–0006 applied
 * and verified — see supabase/local-test-support/0000_auth_stub.sql and
 * 0001_storage_stub.sql).
 *
 * This adapter implements the exact query-builder methods our service
 * modules call — .from().select().insert().update().delete().eq().order()
 * .limit().single().maybeSingle() — backed by real SQL execution via `pg`,
 * instead of HTTP+PostgREST. It returns the same { data, error } shape
 * supabase-js returns, so the actual service functions run completely
 * unmodified against a genuine, migrated database.
 *
 * Phase 10.3 added two more surfaces, with different fidelity:
 *   - .rpc(fnName, args) — REAL. Executes the actual Postgres function
 *     (e.g. search_director_documents) against the same pool. This is
 *     genuine database behavior, not a stub.
 *   - .storage — FAKE. Supabase Storage is a separate HTTP service, not a
 *     Postgres feature, and has no local equivalent in this environment.
 *     See FakeStorageApi's own doc comment for exactly what this does and
 *     does not verify.
 *
 * SCOPE BOUNDARY
 * --------------
 * This is intentionally minimal — only the methods our codebase actually
 * uses are implemented. It is NOT a general PostgREST reimplementation.
 * It is used ONLY by tests/integration/*.test.ts and is never imported
 * by production code.
 *
 * RLS NOTE
 * --------
 * RLS policies use auth.uid(), which reads from the Postgres session GUC
 * request.jwt.claim.sub (see 0000_auth_stub.sql). This adapter sets that
 * GUC per-connection from setTestUserId(), mirroring how PostgREST sets
 * it from a decoded JWT on every real request.
 */

import { Pool } from 'pg'

export interface PgError {
  message: string
  code: string
  details?: string
}

export interface PgResult<T> {
  data: T | null
  error: PgError | null
}

type FilterOp = { column: string; value: unknown }
type OrderOp = { column: string; ascending: boolean }

/**
 * Mimics the chainable Supabase PostgrestFilterBuilder for a single table.
 * Each method returns `this` so calls can be chained exactly like
 * `supabase.from('table').select('*').eq('id', x).single()`.
 */
class QueryBuilder<T = Record<string, unknown>> {
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null
  private filters: FilterOp[] = []
  private orderOp: OrderOp | null = null
  private limitCount: number | null = null
  private wantSingle = false
  private wantMaybeSingle = false

  constructor(
    private readonly pool: Pool,
    private readonly table: string,
    private readonly getUserId: () => string | null,
    private readonly schema: string = 'public',
  ) {}

  select(_columns = '*'): this {
    // Only no-op tracking needed — every mode returns full rows via RETURNING * / SELECT *.
    if (this.mode === 'select') this.mode = 'select'
    return this
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = 'insert'
    this.payload = values
    return this
  }

  update(values: Record<string, unknown>): this {
    this.mode = 'update'
    this.payload = values
    return this
  }

  delete(): this {
    this.mode = 'delete'
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value })
    return this
  }

  order(column: string, opts: { ascending: boolean } = { ascending: true }): this {
    this.orderOp = { column, ascending: opts.ascending }
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  single(): Promise<PgResult<T>> {
    this.wantSingle = true
    return this.execute()
  }

  maybeSingle(): Promise<PgResult<T>> {
    this.wantMaybeSingle = true
    return this.execute()
  }

  // Allow awaiting the builder directly (no .single()/.maybeSingle() call) —
  // mirrors supabase-js's thenable PostgrestBuilder for multi-row selects.
  then<TResult1 = PgResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: PgResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute<T[]>().then(onfulfilled, onrejected)
  }

  private whereClause(startIndex: number): { sql: string; values: unknown[] } {
    if (this.filters.length === 0) return { sql: '', values: [] }
    const clauses: string[] = []
    const values: unknown[] = []
    this.filters.forEach((f, i) => {
      clauses.push(`"${f.column}" = $${startIndex + i}`)
      values.push(f.value)
    })
    return { sql: ` WHERE ${clauses.join(' AND ')}`, values }
  }

  private async execute<R = T>(): Promise<PgResult<R>> {
    const client = await this.pool.connect()
    try {
      // Mirror PostgREST: set the per-request JWT claim GUC so RLS's
      // auth.uid() resolves to the "authenticated" test user, exactly as
      // it would from a decoded JWT on a real request.
      const userId = this.getUserId()
      await client.query(
        `SELECT set_config('request.jwt.claim.sub', $1, false)`,
        [userId ?? ''],
      )

      let sql: string
      let values: unknown[]

      if (this.mode === 'select') {
        const where = this.whereClause(1)
        sql = `SELECT * FROM "${this.schema}"."${this.table}"${where.sql}`
        values = where.values
        if (this.orderOp) {
          sql += ` ORDER BY "${this.orderOp.column}" ${this.orderOp.ascending ? 'ASC' : 'DESC'}`
        }
        if (this.limitCount !== null) {
          sql += ` LIMIT ${this.limitCount}`
        }
      } else if (this.mode === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload as Record<string, unknown>]
        const columns = Object.keys(rows[0] ?? {})
        const valueRows: string[] = []
        values = []
        let paramIdx = 1
        for (const row of rows) {
          const placeholders = columns.map(() => `$${paramIdx++}`)
          valueRows.push(`(${placeholders.join(', ')})`)
          for (const col of columns) values.push(serializeForPg(row[col]))
        }
        sql = `INSERT INTO "${this.schema}"."${this.table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueRows.join(', ')} RETURNING *`
      } else if (this.mode === 'update') {
        const patch = this.payload as Record<string, unknown>
        const columns = Object.keys(patch)
        const setClauses = columns.map((c, i) => `"${c}" = $${i + 1}`)
        values = columns.map((c) => serializeForPg(patch[c]))
        const where = this.whereClause(values.length + 1)
        values = values.concat(where.values)
        sql = `UPDATE "${this.schema}"."${this.table}" SET ${setClauses.join(', ')}${where.sql} RETURNING *`
      } else {
        const where = this.whereClause(1)
        values = where.values
        sql = `DELETE FROM "${this.schema}"."${this.table}"${where.sql} RETURNING *`
      }

      const result = await client.query(sql, values)
      const rows = result.rows as R extends unknown[] ? R : R[]

      if (this.wantSingle) {
        if (result.rows.length === 0) {
          return {
            data: null,
            error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
          }
        }
        return { data: result.rows[0] as R, error: null }
      }

      if (this.wantMaybeSingle) {
        return { data: (result.rows[0] ?? null) as R | null, error: null }
      }

      return { data: rows as R, error: null }
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : String(err),
          code: (err as { code?: string }).code ?? 'PG_ERROR',
        },
      }
    } finally {
      client.release()
    }
  }
}

/** JS objects destined for jsonb columns must be stringified for node-postgres. */
function serializeForPg(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value)
  }
  return value
}

/**
 * A minimal stand-in for the SupabaseClient used by our service modules.
 * `.from(table)` and `.rpc(fn, args)` are REAL — both execute genuine SQL
 * against the same Postgres pool, so callers get real database behavior.
 * `.storage` is a FAKE, in-memory stand-in — see its own doc comment for
 * why real Storage cannot be exercised in this environment, same root
 * cause as this file's header comment for PostgREST.
 */
export class TestSupabaseAdapter {
  private pool: Pool
  private currentUserId: string | null = null
  readonly storage: FakeStorageApi

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
    this.storage = new FakeStorageApi()
  }

  /**
   * Set the "authenticated user" for subsequent queries — mirrors what
   * PostgREST does per-request based on the caller's JWT (auth.uid()
   * resolves to this value via the request.jwt.claim.sub GUC). Must be
   * called before any query that depends on RLS.
   */
  setTestUserId(userId: string | null): void {
    this.currentUserId = userId
  }

  from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.pool, table, () => this.currentUserId)
  }

  /**
   * Executes a real Postgres function via the same pool `.from()` uses —
   * genuinely runs the SQL defined in the corresponding migration (e.g.
   * search_director_documents, migration 0006), not a stub. Sets the same
   * request.jwt.claim.sub GUC .from() does first, so RLS-aware functions
   * (this one is intentionally not SECURITY DEFINER — see the migration's
   * comment) see the correct auth.uid().
   */
  async rpc<T = unknown>(
    fnName: string,
    args: Record<string, unknown> = {},
  ): Promise<PgResult<T[]>> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `SELECT set_config('request.jwt.claim.sub', $1, false)`,
        [this.currentUserId ?? ''],
      )
      const argNames = Object.keys(args)
      const placeholders = argNames.map((_, i) => `${argNames[i]} := $${i + 1}`)
      const values = argNames.map((k) => serializeForPg(args[k]))
      const sql = `SELECT * FROM public.${fnName}(${placeholders.join(', ')})`
      const result = await client.query(sql, values)
      return { data: result.rows as T[], error: null }
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : String(err),
          code: (err as { code?: string }).code ?? 'PG_ERROR',
        },
      }
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  getUserId(): string | null {
    return this.currentUserId
  }
}

/**
 * FAKE Storage stand-in — in-memory only, never touches disk or any real
 * object store. This environment has no Supabase Storage API server (same
 * root cause as this file's header comment: no container runtime, and the
 * real Storage service isn't a Postgres extension, it's a separate HTTP
 * service Supabase runs alongside PostgREST). Integration tests that
 * exercise uploadDirectorDocument() etc. verify the DB-side behavior
 * (metadata row correctness, RLS, cleanup-on-failure logic) against this
 * fake; they do NOT verify real file bytes ever reach real object
 * storage — that requires a real Supabase project, out of scope for local
 * integration tests same as every other "real credentials needed" gap in
 * this project (documented in KNOWN_LIMITATIONS.md).
 */
class FakeStorageApi {
  private objects = new Map<string, Map<string, { contentType: string; size: number }>>()

  from(bucket: string) {
    if (!this.objects.has(bucket)) this.objects.set(bucket, new Map())
    const bucketObjects = this.objects.get(bucket)!

    return {
      upload: async (path: string, file: { type?: string; size?: number }, _opts?: unknown) => {
        if (bucketObjects.has(path)) {
          return { data: null, error: { message: 'The resource already exists', name: 'StorageApiError' } }
        }
        bucketObjects.set(path, { contentType: file.type ?? 'application/octet-stream', size: file.size ?? 0 })
        return { data: { path }, error: null }
      },
      remove: async (paths: string[]) => {
        for (const p of paths) bucketObjects.delete(p)
        return { data: paths.map((p) => ({ name: p })), error: null }
      },
      createSignedUrl: async (path: string, _expiresIn: number) => {
        if (!bucketObjects.has(path)) {
          return { data: null, error: { message: 'Object not found', name: 'StorageApiError' } }
        }
        return { data: { signedUrl: `https://fake-signed-url.test/${bucket}/${path}` }, error: null }
      },
    }
  }
}
