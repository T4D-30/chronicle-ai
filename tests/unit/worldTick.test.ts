import { describe, it, expect } from 'vitest'
import { getDueEvents, tickWorld } from '@/lib/world/worldTick'
import { DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { WorldEvent } from '@/types/campaign'

function makeEvent(overrides: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: 'evt-1',
    description: 'The bridge collapses.',
    triggerAtTurn: 5,
    triggered: false,
    directorHint: 'Describe the bridge giving way.',
    ...overrides,
  }
}

describe('getDueEvents', () => {
  it('returns an empty array when there are no scheduled events', () => {
    expect(getDueEvents([], 10)).toEqual([])
  })

  it('excludes an event whose triggerAtTurn is in the future', () => {
    const event = makeEvent({ triggerAtTurn: 10 })
    expect(getDueEvents([event], 5)).toEqual([])
  })

  it('includes an event whose triggerAtTurn equals currentTurn (inclusive boundary)', () => {
    const event = makeEvent({ triggerAtTurn: 5 })
    expect(getDueEvents([event], 5)).toEqual([event])
  })

  it('includes an event whose triggerAtTurn is in the past', () => {
    const event = makeEvent({ triggerAtTurn: 3 })
    expect(getDueEvents([event], 5)).toEqual([event])
  })

  it('excludes an already-triggered event even if its turn has passed', () => {
    const event = makeEvent({ triggerAtTurn: 3, triggered: true })
    expect(getDueEvents([event], 5)).toEqual([])
  })

  it('does not mutate the input events array', () => {
    const events = [makeEvent({ triggerAtTurn: 3 })]
    getDueEvents(events, 5)
    expect(events[0].triggered).toBe(false)
  })
})

describe('tickWorld', () => {
  it('returns an unchanged worldState and no firedEvents when nothing is due', () => {
    const result = tickWorld(DEFAULT_WORLD_STATE, 1)
    expect(result.firedEvents).toEqual([])
    expect(result.worldState).toBe(DEFAULT_WORLD_STATE)
  })

  it('marks a due event as triggered and returns it in firedEvents', () => {
    const worldState = {
      ...DEFAULT_WORLD_STATE,
      scheduledEvents: [makeEvent({ id: 'evt-1', triggerAtTurn: 5 })],
    }
    const result = tickWorld(worldState, 5)

    expect(result.firedEvents).toHaveLength(1)
    expect(result.firedEvents[0].id).toBe('evt-1')
    expect(result.worldState.scheduledEvents[0].triggered).toBe(true)
  })

  it('only fires events that are due, leaving others untouched', () => {
    const dueEvent = makeEvent({ id: 'evt-due', triggerAtTurn: 3 })
    const futureEvent = makeEvent({ id: 'evt-future', triggerAtTurn: 20 })
    const worldState = {
      ...DEFAULT_WORLD_STATE,
      scheduledEvents: [dueEvent, futureEvent],
    }
    const result = tickWorld(worldState, 5)

    expect(result.firedEvents).toEqual([dueEvent])
    const [resolvedDue, resolvedFuture] = result.worldState.scheduledEvents
    expect(resolvedDue.triggered).toBe(true)
    expect(resolvedFuture.triggered).toBe(false)
  })

  it('does not re-fire an already-triggered event', () => {
    const worldState = {
      ...DEFAULT_WORLD_STATE,
      scheduledEvents: [makeEvent({ id: 'evt-1', triggerAtTurn: 3, triggered: true })],
    }
    const result = tickWorld(worldState, 5)

    expect(result.firedEvents).toEqual([])
    expect(result.worldState.scheduledEvents[0].triggered).toBe(true)
  })

  it('does not mutate the input worldState or its scheduledEvents array', () => {
    const originalEvent = makeEvent({ id: 'evt-1', triggerAtTurn: 3 })
    const worldState = {
      ...DEFAULT_WORLD_STATE,
      version: 7,
      scheduledEvents: [originalEvent],
    }
    tickWorld(worldState, 5)

    expect(worldState.version).toBe(7)
    expect(worldState.scheduledEvents[0].triggered).toBe(false)
    expect(originalEvent.triggered).toBe(false)
  })

  it('does not change unrelated WorldState fields', () => {
    const worldState = {
      ...DEFAULT_WORLD_STATE,
      version: 3,
      worldTime: 'Midnight',
      scheduledEvents: [makeEvent({ id: 'evt-1', triggerAtTurn: 1 })],
    }
    const result = tickWorld(worldState, 1)

    expect(result.worldState.version).toBe(3)
    expect(result.worldState.worldTime).toBe('Midnight')
  })
})
