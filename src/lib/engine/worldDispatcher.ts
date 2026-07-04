/**
 * Living World Dispatcher — Phase 3 (extended Phase 9.2)
 *
 * Applies `worldStateUpdates` from the Director response to the campaign's
 * WorldState. The Director returns a partial patch; this module merges it
 * safely without mutating in place.
 *
 * Design: The dispatcher is purely functional (WorldState in → WorldState out).
 * Persistence (updating the campaigns row) happens in the campaign service.
 * This module has no Supabase dependency.
 *
 * Phase 3 supports: location discovery, NPC alive/dead tracking, world time.
 * Phase 6 (Living Atlas) adds map tokens and fog-of-war.
 * Phase 9.2 adds: current location, plot threads (Quest Log), NPC memory
 * (Codex). These extend WorldState/DirectorConfig fields that already
 * existed but were previously unpopulated — see ROADMAP.md Phase 9.2.
 */

import type { WorldState, LocationState, DirectorConfig } from '@/types/campaign'
import type { PlotThread, NpcMemoryEntry } from '@/types/campaign'

/** The partial update the Director returns in `worldStateUpdates`. */
export interface WorldStateUpdate {
  /** New locations to add (by id — deduped). */
  newLocations?: Partial<LocationState>[]
  /** NPCs whose alive status changed. */
  npcUpdates?: Array<{ id: string; isAlive?: boolean; locationId?: string | null }>
  /** New in-world time description. */
  worldTime?: string
  /** The location ID the player is now at, per the Director's narration. */
  currentLocationId?: string
  /** Arbitrary key-value tags (door states, alert levels, etc.) — stored in a separate field in Phase 3 stretch. */
  tags?: Record<string, string | number | boolean>
}

/**
 * The partial DirectorConfig update the Director can return for narrative
 * bookkeeping — plot threads (quests) and NPC memory (codex). Kept separate
 * from WorldStateUpdate because these live on DirectorConfig, not WorldState,
 * matching the existing schema (see types/campaign.ts).
 */
export interface DirectorConfigUpdate {
  /** New plot threads to start tracking (deduped by id). */
  newThreads?: Array<Partial<PlotThread> & { id: string; title: string }>
  /** Status/description changes to existing threads. */
  threadUpdates?: Array<{ id: string; status?: PlotThread['status']; description?: string; resolvedAtTurn?: number }>
  /** New or updated NPC memory entries (upserted by id). */
  npcMemoryUpdates?: Array<Partial<NpcMemoryEntry> & { id: string; name: string }>
}

/**
 * Apply a DirectorWorldStateUpdate to an existing WorldState.
 * Returns a new WorldState — never mutates input.
 */
export function applyWorldStateUpdate(
  current: WorldState,
  update: Record<string, unknown>,
): WorldState {
  // Safely cast — the Director returns untyped JSON
  const patch = update as WorldStateUpdate

  let next: WorldState = {
    ...current,
    version: current.version + 1,
  }

  // Update world time
  if (patch.worldTime && typeof patch.worldTime === 'string') {
    next = { ...next, worldTime: patch.worldTime }
  }

  // Update current location — only if it resolves to a known location id.
  // We never trust an arbitrary string from the Director as a location;
  // it must match a location already present in WorldState (either
  // pre-existing or added via newLocations in this same patch).
  if (patch.currentLocationId && typeof patch.currentLocationId === 'string') {
    const knownIds = new Set([
      ...current.locations.map((l) => l.id),
      ...(Array.isArray(patch.newLocations) ? patch.newLocations.map((l) => l.id) : []),
    ])
    if (knownIds.has(patch.currentLocationId)) {
      next = { ...next, currentLocationId: patch.currentLocationId }
    }
  }

  // Add new locations (deduped by id)
  if (Array.isArray(patch.newLocations) && patch.newLocations.length > 0) {
    const existingIds = new Set(current.locations.map((l) => l.id))
    const additions = patch.newLocations
      .filter((l): l is LocationState => Boolean(l.id && l.name && l.type) && !existingIds.has(l.id!))
    if (additions.length > 0) {
      next = { ...next, locations: [...current.locations, ...additions] }
    }
  }

  // Apply NPC updates
  if (Array.isArray(patch.npcUpdates) && patch.npcUpdates.length > 0) {
    const updatedNpcs = current.npcs.map((npc) => {
      const upd = patch.npcUpdates!.find((u) => u.id === npc.id)
      if (!upd) return npc
      return {
        ...npc,
        ...(upd.isAlive !== undefined ? { isAlive: upd.isAlive } : {}),
        ...(upd.locationId !== undefined ? { locationId: upd.locationId } : {}),
      }
    })
    next = { ...next, npcs: updatedNpcs }
  }

  return next
}

/**
 * Check whether a Director worldStateUpdate contains anything meaningful.
 * Empty objects from the Director don't need to be persisted.
 */
export function hasWorldStateChanges(update: Record<string, unknown>): boolean {
  const patch = update as WorldStateUpdate
  return Boolean(
    patch.worldTime ||
    patch.currentLocationId ||
    (Array.isArray(patch.newLocations) && patch.newLocations.length > 0) ||
    (Array.isArray(patch.npcUpdates) && patch.npcUpdates.length > 0),
  )
}

// ─── DirectorConfig dispatcher (plot threads / NPC memory) ────────────────────

/**
 * Apply a DirectorConfigUpdate (new/updated plot threads, NPC memory) to
 * an existing DirectorConfig. Returns a new DirectorConfig — never mutates.
 *
 * Threads and NPC memory entries are upserted by id: an update whose id
 * matches an existing entry patches it; otherwise it's appended as new.
 * This mirrors the npcUpdates pattern in applyWorldStateUpdate above.
 */
export function applyDirectorConfigUpdate(
  current: DirectorConfig,
  update: Record<string, unknown>,
): DirectorConfig {
  const patch = update as DirectorConfigUpdate
  let next: DirectorConfig = { ...current }

  if (Array.isArray(patch.newThreads) && patch.newThreads.length > 0) {
    const existingIds = new Set(current.activeThreads.map((t) => t.id))
    const additions: PlotThread[] = patch.newThreads
      .filter((t) => Boolean(t.id && t.title) && !existingIds.has(t.id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? '',
        status: t.status ?? 'active',
        startedAtTurn: t.startedAtTurn ?? 0,
        resolvedAtTurn: t.resolvedAtTurn ?? null,
        isHidden: t.isHidden ?? false,
      }))
    if (additions.length > 0) {
      next = { ...next, activeThreads: [...current.activeThreads, ...additions] }
    }
  }

  if (Array.isArray(patch.threadUpdates) && patch.threadUpdates.length > 0) {
    const updatedThreads = next.activeThreads.map((thread) => {
      const upd = patch.threadUpdates!.find((u) => u.id === thread.id)
      if (!upd) return thread
      return {
        ...thread,
        ...(upd.status !== undefined ? { status: upd.status } : {}),
        ...(upd.description !== undefined ? { description: upd.description } : {}),
        ...(upd.resolvedAtTurn !== undefined ? { resolvedAtTurn: upd.resolvedAtTurn } : {}),
      }
    })
    next = { ...next, activeThreads: updatedThreads }
  }

  if (Array.isArray(patch.npcMemoryUpdates) && patch.npcMemoryUpdates.length > 0) {
    const existingIds = new Set(current.npcMemory.map((n) => n.id))
    const upserted = [...current.npcMemory]
    for (const entry of patch.npcMemoryUpdates) {
      if (!entry.id || !entry.name) continue
      const idx = upserted.findIndex((n) => n.id === entry.id)
      if (idx === -1) {
        upserted.push({
          id: entry.id,
          name: entry.name,
          disposition: entry.disposition ?? 'neutral',
          knownFacts: entry.knownFacts ?? [],
          lastKnownLocation: entry.lastKnownLocation ?? null,
          isAlive: entry.isAlive ?? true,
          metPlayer: entry.metPlayer ?? true,
        })
      } else {
        upserted[idx] = {
          ...upserted[idx],
          ...(entry.disposition !== undefined ? { disposition: entry.disposition } : {}),
          ...(entry.knownFacts !== undefined ? { knownFacts: entry.knownFacts } : {}),
          ...(entry.lastKnownLocation !== undefined ? { lastKnownLocation: entry.lastKnownLocation } : {}),
          ...(entry.isAlive !== undefined ? { isAlive: entry.isAlive } : {}),
          ...(entry.metPlayer !== undefined ? { metPlayer: entry.metPlayer } : {}),
        }
      }
    }
    if (upserted.length !== existingIds.size || patch.npcMemoryUpdates.some((e) => existingIds.has(e.id))) {
      next = { ...next, npcMemory: upserted }
    }
  }

  return next
}

/** Check whether a DirectorConfigUpdate contains anything meaningful. */
export function hasDirectorConfigChanges(update: Record<string, unknown>): boolean {
  const patch = update as DirectorConfigUpdate
  return Boolean(
    (Array.isArray(patch.newThreads) && patch.newThreads.length > 0) ||
    (Array.isArray(patch.threadUpdates) && patch.threadUpdates.length > 0) ||
    (Array.isArray(patch.npcMemoryUpdates) && patch.npcMemoryUpdates.length > 0),
  )
}
