import { describe, it, expect } from 'vitest'
import {
  createScheduledWorldEvent,
  scheduleWorldEvent,
  mergeScheduledEvents,
} from '@/lib/world/worldEventScheduler'
import type { WorldEvent } from '@/types/campaign'

describe('createScheduledWorldEvent', () => {
  it('always sets triggered to false', () => {
    const event = createScheduledWorldEvent({
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10,
    })
    expect(event.triggered).toBe(false)
  })

  it('defaults directorHint to an empty string when omitted', () => {
    const event = createScheduledWorldEvent({
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10,
    })
    expect(event.directorHint).toBe('')
  })

  it('defaults source to "director" when omitted', () => {
    const event = createScheduledWorldEvent({
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10,
    })
    expect(event.source).toBe('director')
  })

  it('preserves a provided source', () => {
    const event = createScheduledWorldEvent({
      id: 'evt-1', description: 'Crops finish growing.', triggerAtTurn: 10, source: 'world',
    })
    expect(event.source).toBe('world')
  })

  it('includes optional metadata fields only when provided', () => {
    const minimal = createScheduledWorldEvent({
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10,
    })
    expect(minimal).not.toHaveProperty('type')
    expect(minimal).not.toHaveProperty('title')
    expect(minimal).not.toHaveProperty('createdTurn')
    expect(minimal).not.toHaveProperty('payload')

    const full = createScheduledWorldEvent({
      id: 'evt-2',
      description: 'A festival begins.',
      triggerAtTurn: 20,
      type: 'festival-start',
      title: 'Harvest Festival',
      createdTurn: 10,
      payload: { locationId: 'loc-1' },
    })
    expect(full.type).toBe('festival-start')
    expect(full.title).toBe('Harvest Festival')
    expect(full.createdTurn).toBe(10)
    expect(full.payload).toEqual({ locationId: 'loc-1' })
  })

  it('carries the exact id, description, and triggerAtTurn given', () => {
    const event = createScheduledWorldEvent({
      id: 'evt-1', description: 'A storm arrives.', triggerAtTurn: 7,
    })
    expect(event.id).toBe('evt-1')
    expect(event.description).toBe('A storm arrives.')
    expect(event.triggerAtTurn).toBe(7)
  })
})

describe('scheduleWorldEvent', () => {
  function makeEvent(overrides: Partial<WorldEvent> = {}): WorldEvent {
    return {
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10,
      triggered: false, directorHint: '', ...overrides,
    }
  }

  it('adds a new event to an empty list', () => {
    const result = scheduleWorldEvent([], makeEvent())
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('evt-1')
  })

  it('preserves existing events', () => {
    const existing = makeEvent({ id: 'evt-existing' })
    const result = scheduleWorldEvent([existing], makeEvent({ id: 'evt-new' }))
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(existing)
  })

  it('returns the same array reference when the id already exists (no-op)', () => {
    const existing = [makeEvent({ id: 'evt-1' })]
    const result = scheduleWorldEvent(existing, makeEvent({ id: 'evt-1', description: 'A different event.' }))
    expect(result).toBe(existing)
  })

  it('does not mutate the input array', () => {
    const existing = [makeEvent({ id: 'evt-existing' })]
    scheduleWorldEvent(existing, makeEvent({ id: 'evt-new' }))
    expect(existing).toHaveLength(1)
  })
})

describe('mergeScheduledEvents', () => {
  function makeEvent(overrides: Partial<WorldEvent> = {}): WorldEvent {
    return {
      id: 'evt-1', description: 'A caravan returns.', triggerAtTurn: 10,
      triggered: false, directorHint: '', ...overrides,
    }
  }

  it('merges multiple new events into an empty list', () => {
    const result = mergeScheduledEvents([], [
      makeEvent({ id: 'evt-1' }),
      makeEvent({ id: 'evt-2' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('preserves existing events alongside new ones', () => {
    const existing = [makeEvent({ id: 'evt-existing' })]
    const result = mergeScheduledEvents(existing, [makeEvent({ id: 'evt-new' })])
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(existing[0])
  })

  it('dedupes against existing events by id', () => {
    const existing = [makeEvent({ id: 'evt-1', description: 'Original.' })]
    const result = mergeScheduledEvents(existing, [makeEvent({ id: 'evt-1', description: 'Attempted overwrite.' })])
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Original.')
  })

  it('dedupes within the incoming batch itself, keeping the first', () => {
    const result = mergeScheduledEvents([], [
      makeEvent({ id: 'evt-1', description: 'First.' }),
      makeEvent({ id: 'evt-1', description: 'Second.' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('First.')
  })

  it('returns the same array reference when nothing new is added', () => {
    const existing = [makeEvent({ id: 'evt-1' })]
    const result = mergeScheduledEvents(existing, [makeEvent({ id: 'evt-1' })])
    expect(result).toBe(existing)
  })

  it('returns the same array reference for an empty newEvents list', () => {
    const existing = [makeEvent({ id: 'evt-1' })]
    const result = mergeScheduledEvents(existing, [])
    expect(result).toBe(existing)
  })

  it('does not mutate either input array', () => {
    const existing = [makeEvent({ id: 'evt-existing' })]
    const incoming = [makeEvent({ id: 'evt-new' })]
    mergeScheduledEvents(existing, incoming)
    expect(existing).toHaveLength(1)
    expect(incoming).toHaveLength(1)
  })
})
