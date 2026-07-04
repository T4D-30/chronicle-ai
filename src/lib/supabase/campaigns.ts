/**
 * Chronicle AI — Campaign Service
 * Phase 1.4
 *
 * Typed Supabase operations for the campaigns table.
 * Handles Director config and Living World state persistence.
 *
 * Constitution Law 4: "The Map Is Persistent — the AI does not redraw the world"
 * updateWorldState() performs a MERGE, not a REPLACE — the Director can only
 * add to world state, never silently clear it.
 */

import { supabase } from './client'
import { ServiceError, fromPostgrestError, assertFound } from './errors'
import {
  DEFAULT_DIRECTOR_CONFIG,
  DEFAULT_WORLD_STATE,
} from '@/types/campaign'
import type {
  Campaign,
  DirectorConfig,
  WorldState,
  CampaignTone,
  CampaignDifficulty,
} from '@/types/campaign'
import type { CampaignRow } from '@/types/database'
import type { Json } from '@/types/supabase-generated'

/**
 * Cast a rich domain JSONB shape (DirectorConfig, WorldState) to the generated
 * client's `Json` type at the write boundary. Domain types are plain
 * serialisable objects, so this is a safe structural cast — not a type lie.
 */
function toJson<T>(value: T): Json {
  return value as unknown as Json
}

/**
 * Hydrate a raw Supabase row (where JSONB columns are typed `Json`) into our
 * rich `CampaignRow` domain shape at the read boundary.
 */
function asCampaignRow(row: unknown): CampaignRow {
  return row as CampaignRow
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  userId: string
  title: string
  description?: string
  tone?: CampaignTone
  difficulty?: CampaignDifficulty
  /** Optionally link a character at creation time. */
  characterId?: string
  /** Seed the Director config at creation (optional — defaults applied). */
  directorConfig?: Partial<DirectorConfig>
}

export interface UpdateCampaignInput {
  title?: string
  description?: string
  status?: CampaignRow['status']
  characterId?: string | null
  tone?: CampaignTone
  difficulty?: CampaignDifficulty
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TONES: CampaignTone[] = ['grim', 'heroic', 'mysterious', 'comedic']
const VALID_DIFFICULTIES: CampaignDifficulty[] = ['easy', 'standard', 'brutal']
const VALID_STATUSES: CampaignRow['status'][] = ['idle', 'active', 'paused', 'completed']

function validateCreateInput(input: CreateCampaignInput): void {
  const title = input.title?.trim() ?? ''
  if (title.length === 0) {
    throw new ServiceError('[createCampaign] Campaign title cannot be empty.', 'VALIDATION')
  }
  if (title.length > 120) {
    throw new ServiceError(
      `[createCampaign] Campaign title must be 120 characters or fewer, got ${title.length}.`,
      'VALIDATION',
    )
  }
  if (input.tone && !VALID_TONES.includes(input.tone)) {
    throw new ServiceError(
      `[createCampaign] Invalid tone "${input.tone}". Must be one of: ${VALID_TONES.join(', ')}.`,
      'VALIDATION',
    )
  }
  if (input.difficulty && !VALID_DIFFICULTIES.includes(input.difficulty)) {
    throw new ServiceError(
      `[createCampaign] Invalid difficulty "${input.difficulty}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}.`,
      'VALIDATION',
    )
  }
}

function validateUpdateInput(patch: UpdateCampaignInput): void {
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (title.length === 0) {
      throw new ServiceError('[updateCampaign] Campaign title cannot be empty.', 'VALIDATION')
    }
    if (title.length > 120) {
      throw new ServiceError(
        `[updateCampaign] Campaign title must be 120 characters or fewer.`,
        'VALIDATION',
      )
    }
  }
  if (patch.tone && !VALID_TONES.includes(patch.tone)) {
    throw new ServiceError(`[updateCampaign] Invalid tone "${patch.tone}".`, 'VALIDATION')
  }
  if (patch.difficulty && !VALID_DIFFICULTIES.includes(patch.difficulty)) {
    throw new ServiceError(
      `[updateCampaign] Invalid difficulty "${patch.difficulty}".`,
      'VALIDATION',
    )
  }
  if (patch.status && !VALID_STATUSES.includes(patch.status)) {
    throw new ServiceError(`[updateCampaign] Invalid status "${patch.status}".`, 'VALIDATION')
  }
}

// ─── Row → Domain Converter ───────────────────────────────────────────────────

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    characterId: row.character_id,
    directorConfig: row.director_config ?? DEFAULT_DIRECTOR_CONFIG,
    worldState: row.world_state ?? DEFAULT_WORLD_STATE,
    tone: row.tone,
    difficulty: row.difficulty,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new campaign with default Director config and world state.
 *
 * @throws ServiceError('VALIDATION') for invalid input
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  validateCreateInput(input)

  const tone = input.tone ?? 'heroic'
  const difficulty = input.difficulty ?? 'standard'

  const directorConfig: DirectorConfig = {
    ...DEFAULT_DIRECTOR_CONFIG,
    ...input.directorConfig,
    tone,
    difficulty,
  }

  const row = {
    user_id: input.userId,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    status: 'idle' as const,
    character_id: input.characterId ?? null,
    director_config: toJson(directorConfig),
    world_state: toJson(DEFAULT_WORLD_STATE),
    tone,
    difficulty,
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert(row)
    .select()
    .single()

  if (error) throw fromPostgrestError(error, 'createCampaign')
  assertFound(data, 'createCampaign')

  return rowToCampaign(asCampaignRow(data))
}

/**
 * Get a single campaign by ID.
 * RLS ensures only the owner can access their campaigns.
 *
 * @throws ServiceError('NOT_FOUND') if campaign doesn't exist or RLS blocks
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function getCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[getCampaign] Campaign not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'getCampaign')
  }
  assertFound(data, 'getCampaign')

  return rowToCampaign(asCampaignRow(data))
}

/**
 * List all campaigns belonging to the given user, most recent first.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function listCampaigns(userId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw fromPostgrestError(error, 'listCampaigns')

  return (data ?? []).map((row) => rowToCampaign(asCampaignRow(row)))
}

/**
 * Update campaign metadata (title, description, status, characterId, tone, difficulty).
 * Does NOT update directorConfig or worldState — use dedicated functions for those.
 *
 * @throws ServiceError('VALIDATION') for invalid patch values
 * @throws ServiceError('NOT_FOUND') if campaign doesn't exist or RLS blocks
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function updateCampaign(id: string, patch: UpdateCampaignInput): Promise<Campaign> {
  validateUpdateInput(patch)

  const dbPatch: {
    title?: string
    description?: string | null
    status?: CampaignRow['status']
    character_id?: string | null
    tone?: CampaignTone
    difficulty?: CampaignDifficulty
  } = {}

  if (patch.title !== undefined) dbPatch.title = patch.title.trim()
  if (patch.description !== undefined) dbPatch.description = patch.description.trim() || null
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.characterId !== undefined) dbPatch.character_id = patch.characterId
  if (patch.tone !== undefined) dbPatch.tone = patch.tone
  if (patch.difficulty !== undefined) dbPatch.difficulty = patch.difficulty

  const { data, error } = await supabase
    .from('campaigns')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[updateCampaign] Campaign not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'updateCampaign')
  }
  assertFound(data, 'updateCampaign')

  return rowToCampaign(asCampaignRow(data))
}

/**
 * Update the Living World state for a campaign.
 *
 * MERGE semantics per Constitution Law 4: the patch is merged into the
 * existing world_state — it cannot delete top-level keys, only add/update them.
 * This protects against the Director accidentally resetting discovered locations.
 *
 * @param id        - Campaign ID
 * @param patch     - Partial WorldState to merge. Keys present are updated; absent keys unchanged.
 *
 * @throws ServiceError('NOT_FOUND') if campaign doesn't exist or RLS blocks
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function updateWorldState(
  id: string,
  patch: Partial<WorldState>,
): Promise<Campaign> {
  // Fetch current state first, then merge
  const current = await getCampaign(id)

  const merged: WorldState = {
    ...current.worldState,
    ...patch,
    // Bump version on every update
    version: (current.worldState.version ?? 0) + 1,
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update({ world_state: toJson(merged) })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(`[updateWorldState] Campaign not found: ${id}`, 'NOT_FOUND', error)
    }
    throw fromPostgrestError(error, 'updateWorldState')
  }
  assertFound(data, 'updateWorldState')

  return rowToCampaign(asCampaignRow(data))
}

/**
 * Update the Director config for a campaign.
 * Merges patch into existing config — preserves fields not explicitly changed.
 *
 * @throws ServiceError('NOT_FOUND') if campaign doesn't exist or RLS blocks
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function updateDirectorConfig(
  id: string,
  patch: Partial<DirectorConfig>,
): Promise<Campaign> {
  const current = await getCampaign(id)

  const merged: DirectorConfig = {
    ...current.directorConfig,
    ...patch,
  }

  // Keep tone and difficulty columns in sync with director_config
  const dbPatch = {
    director_config: toJson(merged),
    tone: merged.tone,
    difficulty: merged.difficulty,
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ServiceError(
        `[updateDirectorConfig] Campaign not found: ${id}`,
        'NOT_FOUND',
        error,
      )
    }
    throw fromPostgrestError(error, 'updateDirectorConfig')
  }
  assertFound(data, 'updateDirectorConfig')

  return rowToCampaign(asCampaignRow(data))
}

/**
 * Delete a campaign and all its sessions/turns (CASCADE in DB).
 * RLS ensures only the owner can delete their campaigns.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)

  if (error) throw fromPostgrestError(error, 'deleteCampaign')
}
