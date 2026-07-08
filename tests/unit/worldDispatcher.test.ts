import { describe, it, expect } from 'vitest'
import { applyWorldStateUpdate, hasWorldStateChanges } from '@/lib/engine/worldDispatcher'
import { DEFAULT_WORLD_STATE } from '@/types/campaign'

describe('applyWorldStateUpdate', () => {
  it('increments version on every update', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {})
    expect(next.version).toBe(1)
  })

  it('updates world time', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, { worldTime: 'Dusk, Day 3' })
    expect(next.worldTime).toBe('Dusk, Day 3')
  })

  it('does not mutate the original world state', () => {
    const original = { ...DEFAULT_WORLD_STATE, version: 5 }
    applyWorldStateUpdate(original, { worldTime: 'changed' })
    expect(original.version).toBe(5)
    expect(original.worldTime).toBeNull()
  })

  it('adds new locations', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      newLocations: [{ id: 'loc-1', name: 'The Vault', type: 'dungeon', description: '' }],
    })
    expect(next.locations).toHaveLength(1)
    expect(next.locations[0].id).toBe('loc-1')
  })

  it('deduplicates locations by id', () => {
    const withLocation = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      newLocations: [{ id: 'loc-1', name: 'The Vault', type: 'dungeon', description: '' }],
    })
    const again = applyWorldStateUpdate(withLocation, {
      newLocations: [{ id: 'loc-1', name: 'The Vault Again', type: 'dungeon', description: '' }],
    })
    expect(again.locations).toHaveLength(1)
  })

  it('updates NPC alive status', () => {
    const withNpc = {
      ...DEFAULT_WORLD_STATE,
      npcs: [{ id: 'npc-1', name: 'Guard', locationId: null, isAlive: true, combatStats: null }],
    }
    const next = applyWorldStateUpdate(withNpc, {
      npcUpdates: [{ id: 'npc-1', isAlive: false }],
    })
    expect(next.npcs[0].isAlive).toBe(false)
  })
})

describe('hasWorldStateChanges', () => {
  it('returns false for an empty object', () => {
    expect(hasWorldStateChanges({})).toBe(false)
  })

  it('returns true when worldTime is set', () => {
    expect(hasWorldStateChanges({ worldTime: 'Midnight' })).toBe(true)
  })

  it('returns true when newLocations is non-empty', () => {
    expect(hasWorldStateChanges({ newLocations: [{ id: 'x' }] })).toBe(true)
  })

  it('returns false for empty arrays', () => {
    expect(hasWorldStateChanges({ newLocations: [], npcUpdates: [] })).toBe(false)
  })
})

// ─── Phase 12.1 Step 3 — scheduledEventsToAdd (World Event Scheduler) ─────────

describe('applyWorldStateUpdate — scheduledEventsToAdd', () => {
  it('adds a new scheduled event, forcing triggered to false', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      scheduledEventsToAdd: [
        { id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10, triggered: true },
      ],
    })
    expect(next.scheduledEvents).toHaveLength(1)
    expect(next.scheduledEvents[0]).toMatchObject({
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10, triggered: false,
    })
  })

  it('preserves existing scheduled events', () => {
    const withEvent = {
      ...DEFAULT_WORLD_STATE,
      scheduledEvents: [
        { id: 'evt-existing', description: 'Existing event.', triggerAtTurn: 3, triggered: false, directorHint: '' },
      ],
    }
    const next = applyWorldStateUpdate(withEvent, {
      scheduledEventsToAdd: [{ id: 'evt-new', description: 'A storm arrives.', triggerAtTurn: 8 }],
    })
    expect(next.scheduledEvents).toHaveLength(2)
    expect(next.scheduledEvents.map((e) => e.id)).toEqual(['evt-existing', 'evt-new'])
  })

  it('does not duplicate a scheduled event with an id that already exists', () => {
    const withEvent = {
      ...DEFAULT_WORLD_STATE,
      scheduledEvents: [
        { id: 'evt-1', description: 'Original.', triggerAtTurn: 5, triggered: false, directorHint: '' },
      ],
    }
    const next = applyWorldStateUpdate(withEvent, {
      scheduledEventsToAdd: [{ id: 'evt-1', description: 'Duplicate attempt.', triggerAtTurn: 99 }],
    })
    expect(next.scheduledEvents).toHaveLength(1)
    expect(next.scheduledEvents[0].description).toBe('Original.')
  })

  it('supports multiple new scheduled events in one patch', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      scheduledEventsToAdd: [
        { id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10 },
        { id: 'evt-2', description: 'A festival begins.', triggerAtTurn: 15 },
      ],
    })
    expect(next.scheduledEvents).toHaveLength(2)
  })

  it('ignores an entry missing a required id, description, or valid triggerAtTurn', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      scheduledEventsToAdd: [
        { id: '', description: 'No id.', triggerAtTurn: 5 },
        { id: 'evt-2', description: '', triggerAtTurn: 5 },
        { id: 'evt-3', description: 'Bad turn.', triggerAtTurn: 'soon' },
      ] as unknown as Array<{ id: string; description: string; triggerAtTurn: number }>,
    })
    expect(next.scheduledEvents).toHaveLength(0)
  })

  it('carries through optional scheduling metadata (type, title, source, payload)', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      scheduledEventsToAdd: [{
        id: 'evt-1', description: 'A festival begins.', triggerAtTurn: 10,
        type: 'festival-start', title: 'Harvest Festival', source: 'world', payload: { locationId: 'loc-1' },
      }],
    })
    expect(next.scheduledEvents[0]).toMatchObject({
      type: 'festival-start', title: 'Harvest Festival', source: 'world', payload: { locationId: 'loc-1' },
    })
  })

  it('does not mutate the original world state', () => {
    const original = { ...DEFAULT_WORLD_STATE, scheduledEvents: [] }
    applyWorldStateUpdate(original, {
      scheduledEventsToAdd: [{ id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10 }],
    })
    expect(original.scheduledEvents).toHaveLength(0)
  })

  it('hasWorldStateChanges returns true when scheduledEventsToAdd is non-empty', () => {
    expect(hasWorldStateChanges({
      scheduledEventsToAdd: [{ id: 'evt-1', description: 'X', triggerAtTurn: 1 }],
    })).toBe(true)
  })

  it('hasWorldStateChanges returns false when scheduledEventsToAdd is an empty array', () => {
    expect(hasWorldStateChanges({ scheduledEventsToAdd: [] })).toBe(false)
  })
})

// ─── Phase 9.2 — currentLocationId ─────────────────────────────────────────────

describe('applyWorldStateUpdate — currentLocationId', () => {
  it('sets currentLocationId when it matches a known existing location', () => {
    const withLoc = { ...DEFAULT_WORLD_STATE, locations: [
      { id: 'loc-1', name: 'The Vault', type: 'dungeon' as const, parentId: null, description: '', visited: true, discovered: true, properties: {} },
    ] }
    const next = applyWorldStateUpdate(withLoc, { currentLocationId: 'loc-1' })
    expect(next.currentLocationId).toBe('loc-1')
  })

  it('sets currentLocationId when it matches a location newly added in the same patch', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, {
      newLocations: [{ id: 'loc-new', name: 'Hidden Grove', type: 'outdoor', description: '' }],
      currentLocationId: 'loc-new',
    })
    expect(next.currentLocationId).toBe('loc-new')
  })

  it('does NOT set currentLocationId for an unknown id — never trusts an unverified location', () => {
    const next = applyWorldStateUpdate(DEFAULT_WORLD_STATE, { currentLocationId: 'made-up-id' })
    expect(next.currentLocationId).toBeNull()
  })

  it('hasWorldStateChanges returns true when currentLocationId is set', () => {
    expect(hasWorldStateChanges({ currentLocationId: 'loc-1' })).toBe(true)
  })
})

// ─── Phase 9.2 — DirectorConfig dispatcher (Quest Log / Codex) ─────────────────

import { applyDirectorConfigUpdate, hasDirectorConfigChanges } from '@/lib/engine/worldDispatcher'
import { DEFAULT_DIRECTOR_CONFIG } from '@/types/campaign'

describe('applyDirectorConfigUpdate — plot threads (Quest Log)', () => {
  it('adds a new plot thread with sensible defaults', () => {
    const next = applyDirectorConfigUpdate(DEFAULT_DIRECTOR_CONFIG, {
      newThreads: [{ id: 't1', title: 'Find the missing merchant' }],
    })
    expect(next.activeThreads).toHaveLength(1)
    expect(next.activeThreads[0]).toMatchObject({
      id: 't1', title: 'Find the missing merchant', status: 'active', isHidden: false,
    })
  })

  it('does not duplicate a thread with an id that already exists', () => {
    const withThread = { ...DEFAULT_DIRECTOR_CONFIG, activeThreads: [
      { id: 't1', title: 'Existing', description: '', status: 'active' as const, startedAtTurn: 0, resolvedAtTurn: null, isHidden: false },
    ] }
    const next = applyDirectorConfigUpdate(withThread, {
      newThreads: [{ id: 't1', title: 'Duplicate attempt' }],
    })
    expect(next.activeThreads).toHaveLength(1)
    expect(next.activeThreads[0].title).toBe('Existing')
  })

  it('updates an existing thread status to resolved', () => {
    const withThread = { ...DEFAULT_DIRECTOR_CONFIG, activeThreads: [
      { id: 't1', title: 'Find the merchant', description: '', status: 'active' as const, startedAtTurn: 2, resolvedAtTurn: null, isHidden: false },
    ] }
    const next = applyDirectorConfigUpdate(withThread, {
      threadUpdates: [{ id: 't1', status: 'resolved', resolvedAtTurn: 9 }],
    })
    expect(next.activeThreads[0].status).toBe('resolved')
    expect(next.activeThreads[0].resolvedAtTurn).toBe(9)
  })

  it('does not mutate the original DirectorConfig', () => {
    const original = { ...DEFAULT_DIRECTOR_CONFIG, activeThreads: [] }
    applyDirectorConfigUpdate(original, { newThreads: [{ id: 't1', title: 'New' }] })
    expect(original.activeThreads).toHaveLength(0)
  })

  it('ignores a newThreads entry missing a required id or title', () => {
    const next = applyDirectorConfigUpdate(DEFAULT_DIRECTOR_CONFIG, {
      newThreads: [{ id: '', title: 'No id' } as unknown as { id: string; title: string }],
    })
    expect(next.activeThreads).toHaveLength(0)
  })
})

describe('applyDirectorConfigUpdate — NPC memory (Codex)', () => {
  it('adds a new NPC memory entry with sensible defaults', () => {
    const next = applyDirectorConfigUpdate(DEFAULT_DIRECTOR_CONFIG, {
      npcMemoryUpdates: [{ id: 'npc-1', name: 'Barkeep Joss' }],
    })
    expect(next.npcMemory).toHaveLength(1)
    expect(next.npcMemory[0]).toMatchObject({
      id: 'npc-1', name: 'Barkeep Joss', disposition: 'neutral', metPlayer: true, isAlive: true,
    })
  })

  it('upserts an existing NPC memory entry rather than duplicating', () => {
    const withNpc = { ...DEFAULT_DIRECTOR_CONFIG, npcMemory: [
      { id: 'npc-1', name: 'Barkeep Joss', disposition: 'neutral' as const, knownFacts: [], lastKnownLocation: null, isAlive: true, metPlayer: true },
    ] }
    const next = applyDirectorConfigUpdate(withNpc, {
      npcMemoryUpdates: [{ id: 'npc-1', name: 'Barkeep Joss', disposition: 'friendly', knownFacts: ['Owes the player a favor'] }],
    })
    expect(next.npcMemory).toHaveLength(1)
    expect(next.npcMemory[0].disposition).toBe('friendly')
    expect(next.npcMemory[0].knownFacts).toEqual(['Owes the player a favor'])
  })

  it('preserves fields not included in a partial update', () => {
    const withNpc = { ...DEFAULT_DIRECTOR_CONFIG, npcMemory: [
      { id: 'npc-1', name: 'Barkeep Joss', disposition: 'friendly' as const, knownFacts: ['Likes ale'], lastKnownLocation: 'tavern', isAlive: true, metPlayer: true },
    ] }
    const next = applyDirectorConfigUpdate(withNpc, {
      npcMemoryUpdates: [{ id: 'npc-1', name: 'Barkeep Joss', isAlive: false }],
    })
    expect(next.npcMemory[0].disposition).toBe('friendly')
    expect(next.npcMemory[0].knownFacts).toEqual(['Likes ale'])
    expect(next.npcMemory[0].isAlive).toBe(false)
  })

  it('ignores an entry missing a required id or name', () => {
    const next = applyDirectorConfigUpdate(DEFAULT_DIRECTOR_CONFIG, {
      npcMemoryUpdates: [{ id: 'npc-1' } as unknown as { id: string; name: string }],
    })
    expect(next.npcMemory).toHaveLength(0)
  })
})

describe('hasDirectorConfigChanges', () => {
  it('returns false for an empty object', () => {
    expect(hasDirectorConfigChanges({})).toBe(false)
  })

  it('returns true when newThreads is non-empty', () => {
    expect(hasDirectorConfigChanges({ newThreads: [{ id: 't1', title: 'X' }] })).toBe(true)
  })

  it('returns true when npcMemoryUpdates is non-empty', () => {
    expect(hasDirectorConfigChanges({ npcMemoryUpdates: [{ id: 'n1', name: 'X' }] })).toBe(true)
  })

  it('returns false for empty arrays', () => {
    expect(hasDirectorConfigChanges({ newThreads: [], threadUpdates: [], npcMemoryUpdates: [] })).toBe(false)
  })
})
