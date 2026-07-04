/**
 * Chronicle AI — Supabase Service Utilities
 * Phase 1.4
 *
 * Shared infrastructure used by characters.ts, campaigns.ts, sessions.ts.
 * Not exported from the public index — internal to the supabase lib only.
 */

import type { PostgrestError } from '@supabase/supabase-js'

// ─── Typed Service Error ──────────────────────────────────────────────────────

/**
 * All service functions throw ServiceError on failure.
 * Callers can `instanceof ServiceError` to distinguish from unexpected throws,
 * and inspect `code` to handle specific DB-level errors (e.g. not-found, rls).
 */
export class ServiceError extends Error {
  /** Discriminant for `instanceof` checks without the class itself. */
  readonly isServiceError = true as const

  constructor(
    message: string,
    /** Short machine-readable code for the error category. */
    public readonly code:
      | 'NOT_FOUND'
      | 'VALIDATION'
      | 'DB_ERROR'
      | 'CONFLICT'
      | 'FORBIDDEN',
    /** Underlying Supabase error, if any. */
    public readonly cause?: PostgrestError,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

/**
 * Convert a Supabase PostgrestError into a ServiceError.
 * Maps known Postgres/PostgREST error codes to semantic codes.
 */
export function fromPostgrestError(err: PostgrestError, context: string): ServiceError {
  // PostgREST error codes: https://postgrest.org/en/stable/references/errors.html
  // Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  const msg = `[${context}] ${err.message}`

  // Row-level security violation or permission denied
  if (err.code === '42501' || err.message.includes('row-level security')) {
    return new ServiceError(msg, 'FORBIDDEN', err)
  }
  // Unique constraint violation
  if (err.code === '23505') {
    return new ServiceError(msg, 'CONFLICT', err)
  }
  // Foreign key violation
  if (err.code === '23503') {
    return new ServiceError(msg, 'VALIDATION', err)
  }

  return new ServiceError(msg, 'DB_ERROR', err)
}

/**
 * Assert a Supabase query returned data (not null/undefined).
 * Throws ServiceError('NOT_FOUND') if data is absent.
 */
export function assertFound<T>(
  data: T | null | undefined,
  context: string,
): asserts data is T {
  if (data === null || data === undefined) {
    throw new ServiceError(`[${context}] Record not found.`, 'NOT_FOUND')
  }
}
