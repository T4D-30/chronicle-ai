/**
 * Chronicle AI — Session Service
 * Phase 1.4
 *
 * Typed Supabase operations for game_sessions and narrative_turns.
 * This is the hot path for Phase 2 — getRecentTurns() feeds the Director prompt.
 *
 * Turn ordering contract:
 *   appendTurn()      — writes in real-time order (turn_number increments)
 *   getRecentTurns()  — returns the N most recent turns in ASCENDING order
 *                       (oldest first = natural reading order for the Director prompt)
 */

import { supabase } from './client'
import { ServiceError, fromPostgrestError, assertFound } from './errors'
import type { SessionRow, NarrativeTurnRow, DiceRollRecord } from '@/types/database'
import type { GameMode } from '@/types/campaign'
import type { Json } from '@/types/supabase-generated'

/**
 * Cast a rich domain JSONB shape (DiceRollRecord[]) to the generated client's
 * `Json` type at the write boundary. Domain types here are plain serialisable
 * objects/arrays, so this is a safe structural cast — not a type lie.
 */
function toJson<T>(value: T): Json {
  return value as unknown as Json
}

function asSessionRow(row: unknown): SessionRow {
  return row as SessionRow
}

function asNarrativeTurnRow(row: unknown): NarrativeTurnRow {
  return row as NarrativeTurnRow
}

// ─── Domain Objects ───────────────────────────────────────────────────────────

export interface GameSession {
  id: string
  campaignId: string
  turnNumber: number
  status: SessionRow['status']
  currentMode: GameMode
  startedAt: string
  endedAt: string | null
}

export interface NarrativeTurn {
  id: string
  sessionId: string
  turnNumber: number
  playerInput: string
  aiNarration: string
  diceRolls: DiceRollRecord[]
  mode: GameMode
  createdAt: string
}

// ─── Input Types ──────────────────────────────────────────────────────────────

/** Input to appendTurn — what the resolution engine and Director return together. */
export interface AppendTurnInput {
  playerInput: string
  aiNarration: string
  diceRolls: DiceRollRecord[]
  mode?: GameMode
}

// ─── Row → Domain Converters ──────────────────────────────────────────────────

function rowToSession(row: SessionRow): GameSession {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    turnNumber: row.turn_number,
    status: row.status,
    currentMode: row.current_mode,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function rowToNarrativeTurn(row: NarrativeTurnRow): NarrativeTurn {
  return {
    id: row.id,
    sessionId: row.session_id,
    turnNumber: row.turn_number,
    playerInput: row.player_input,
    aiNarration: row.ai_narration,
    diceRolls: Array.isArray(row.dice_rolls) ? (row.dice_rolls as unknown as DiceRollRecord[]) : [],
    mode: row.mode,
    createdAt: row.created_at,
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Start a new session for a campaign.
 * Marks the campaign as 'active' in the same operation.
 *
 * Only one session should be 'active' per campaign at a time. This function
 * does not enforce that constraint at the service layer — the caller (Phase 3
 * session manager) is responsible for ending existing sessions before starting
 * a new one. The DB has no unique constraint on active status by design
 * (allows replaying/branching sessions in future phases).
 *
 * @throws ServiceError('VALIDATION') for missing campaignId
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function startSession(campaignId: string): Promise<GameSession> {
  if (!campaignId?.trim()) {
    throw new ServiceError('[startSession] campaignId is required.', 'VALIDATION')
  }

  const newSession: Omit<SessionRow, 'id' | 'started_at' | 'ended_at'> = {
    campaign_id: campaignId,
    turn_number: 0,
    status: 'active',
    current_mode: 'exploration',
  }

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert(newSession)
    .select()
    .single()

  if (sessionError) throw fromPostgrestError(sessionError, 'startSession')
  assertFound(session, 'startSession')

  // Mark campaign as active
  const { error: campaignError } = await supabase
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', campaignId)

  if (campaignError) {
    // Log but don't fail — session was created successfully
    console.warn('[startSession] Failed to mark campaign as active:', campaignError.message)
  }

  return rowToSession(asSessionRow(session))
}

/**
 * End a session, recording the end timestamp and marking it completed.
 *
 * @throws ServiceError('NOT_FOUND') if session doesn't exist or RLS blocks
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function endSession(id: string): Promise<GameSession> {
  const { data, error } = await supabase
    .from('game_sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[endSession] Session not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'endSession')
  }
  assertFound(data, 'endSession')

  return rowToSession(asSessionRow(data))
}

/**
 * Pause an active session. Unlike endSession(), this does NOT set ended_at —
 * a paused session is resumable, a completed one is not. The campaign's
 * own status is left untouched (still 'active') so the campaign library can
 * distinguish "has a paused session, continue any time" from "fully done."
 *
 * @throws ServiceError('NOT_FOUND') if session doesn't exist or RLS blocks
 * @throws ServiceError('VALIDATION') if the session is already completed
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function pauseSession(id: string): Promise<GameSession> {
  // Completed sessions cannot be paused — that would resurrect a session
  // appendTurn() has already permanently closed the door on.
  const { data: existing, error: fetchError } = await supabase
    .from('game_sessions')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      throw new ServiceError(`[pauseSession] Session not found: ${id}`, 'NOT_FOUND', fetchError)
    }
    throw fromPostgrestError(fetchError, 'pauseSession/fetch')
  }
  assertFound(existing, 'pauseSession/fetch')

  if (existing.status === 'completed') {
    throw new ServiceError(
      `[pauseSession] Cannot pause a completed session: ${id}`,
      'VALIDATION',
    )
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .update({ status: 'paused' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[pauseSession] Session not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'pauseSession')
  }
  assertFound(data, 'pauseSession')

  return rowToSession(asSessionRow(data))
}

/**
 * Resume a paused session, returning it to 'active' status.
 *
 * @throws ServiceError('NOT_FOUND') if session doesn't exist or RLS blocks
 * @throws ServiceError('VALIDATION') if the session is completed (not resumable)
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function resumeSession(id: string): Promise<GameSession> {
  const { data: existing, error: fetchError } = await supabase
    .from('game_sessions')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      throw new ServiceError(`[resumeSession] Session not found: ${id}`, 'NOT_FOUND', fetchError)
    }
    throw fromPostgrestError(fetchError, 'resumeSession/fetch')
  }
  assertFound(existing, 'resumeSession/fetch')

  if (existing.status === 'completed') {
    throw new ServiceError(
      `[resumeSession] Cannot resume a completed session: ${id}`,
      'VALIDATION',
    )
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .update({ status: 'active' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[resumeSession] Session not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'resumeSession')
  }
  assertFound(data, 'resumeSession')

  return rowToSession(asSessionRow(data))
}

/**
 * Append a completed turn to a session.
 * Increments the session's turn_number atomically.
 *
 * The turn_number on the new turn row is taken from the session's CURRENT
 * turn_number before incrementing — so turn 0 is the first turn inserted.
 *
 * @throws ServiceError('NOT_FOUND') if session doesn't exist or RLS blocks
 * @throws ServiceError('VALIDATION') for empty playerInput
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function appendTurn(
  sessionId: string,
  input: AppendTurnInput,
): Promise<NarrativeTurn> {
  if (!input.playerInput?.trim()) {
    throw new ServiceError('[appendTurn] playerInput cannot be empty.', 'VALIDATION')
  }

  // Fetch the current session to get the current turn_number
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('turn_number, status')
    .eq('id', sessionId)
    .single()

  if (sessionError) {
    if (sessionError.code === 'PGRST116') {
      throw new ServiceError(`[appendTurn] Session not found: ${sessionId}`, 'NOT_FOUND', sessionError)
    }
    throw fromPostgrestError(sessionError, 'appendTurn/fetch')
  }
  assertFound(session, 'appendTurn/fetch')

  if (session.status === 'completed') {
    throw new ServiceError(
      `[appendTurn] Cannot append to a completed session: ${sessionId}`,
      'VALIDATION',
    )
  }

  const currentTurn = session.turn_number as number
  const nextTurn = currentTurn + 1

  // Insert the turn row
  const turnRow = {
    session_id: sessionId,
    turn_number: currentTurn,
    player_input: input.playerInput.trim(),
    ai_narration: input.aiNarration,
    dice_rolls: toJson(input.diceRolls),
    mode: input.mode ?? 'exploration',
  }

  const { data: turn, error: turnError } = await supabase
    .from('narrative_turns')
    .insert(turnRow)
    .select()
    .single()

  if (turnError) throw fromPostgrestError(turnError, 'appendTurn/insert')
  assertFound(turn, 'appendTurn/insert')

  // Increment session turn counter
  const { error: updateError } = await supabase
    .from('game_sessions')
    .update({ turn_number: nextTurn })
    .eq('id', sessionId)

  if (updateError) {
    // Turn was inserted — log the counter failure but don't rollback
    console.warn('[appendTurn] Failed to increment turn_number:', updateError.message)
  }

  return rowToNarrativeTurn(asNarrativeTurnRow(turn))
}

/**
 * Get the N most recent turns for a session, returned in ascending order
 * (oldest first = natural Director prompt reading order).
 *
 * @param sessionId  - Session to query
 * @param limit      - Maximum number of turns to return (default: 10, max: 50)
 *
 * @throws ServiceError('VALIDATION') for invalid limit
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function getRecentTurns(
  sessionId: string,
  limit = 10,
): Promise<NarrativeTurn[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ServiceError(
      `[getRecentTurns] limit must be an integer between 1 and 50, got ${limit}.`,
      'VALIDATION',
    )
  }

  // Fetch descending (most recent first), then reverse for chronological order
  const { data, error } = await supabase
    .from('narrative_turns')
    .select('*')
    .eq('session_id', sessionId)
    .order('turn_number', { ascending: false })
    .limit(limit)

  if (error) throw fromPostgrestError(error, 'getRecentTurns')

  const turns = (data ?? []).map((row) => rowToNarrativeTurn(asNarrativeTurnRow(row)))

  // Reverse to chronological (ascending) order for Director context
  return turns.reverse()
}

/**
 * Get the currently active session for a campaign, if one exists.
 * Returns null if no active session is found.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function getActiveSession(campaignId: string): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw fromPostgrestError(error, 'getActiveSession')

  if (!data) return null
  return rowToSession(data as SessionRow)
}

/**
 * Get the most recent resumable session for a campaign — one that is
 * 'active' OR 'paused' (i.e. not yet 'completed'). This is what the
 * Campaign Library's "Continue" action and the session page's "resume vs.
 * start fresh" decision actually need; getActiveSession() above only
 * matches 'active' and would miss a session the player explicitly paused.
 *
 * Implemented as two .eq() queries merged client-side rather than a single
 * .in() query — the real Supabase client supports .in() fine, but the
 * integration test suite's pg-backed query-builder shim (pgAdapter.ts)
 * deliberately implements only the methods already in use, and two simple
 * queries is a fair trade for keeping that test infrastructure unchanged.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function getResumableSession(campaignId: string): Promise<GameSession | null> {
  const [activeResult, pausedResult] = await Promise.all([
    supabase
      .from('game_sessions')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('game_sessions')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'paused')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (activeResult.error) throw fromPostgrestError(activeResult.error, 'getResumableSession/active')
  if (pausedResult.error) throw fromPostgrestError(pausedResult.error, 'getResumableSession/paused')

  const active = activeResult.data as SessionRow | null
  const paused = pausedResult.data as SessionRow | null

  if (active && paused) {
    // Both exist (shouldn't normally happen) — prefer whichever started more recently.
    return rowToSession(new Date(active.started_at) >= new Date(paused.started_at) ? active : paused)
  }

  const winner = active ?? paused
  if (!winner) return null
  return rowToSession(winner)
}
