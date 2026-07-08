/**
 * World Event Scheduler — Phase 12.1 Step 3
 *
 * Pure, deterministic helpers for creating and merging future
 * scheduledEvents entries into WorldState. This module never fires an
 * event — that remains tickWorld()'s exclusive responsibility
 * (src/lib/world/worldTick.ts). It never persists anything — persistence
 * stays in the Adventure Controller, same division of responsibility
 * worldDispatcher.ts already established for other WorldState patches.
 *
 * The Director schedules events; World Tick fires them; the Controller
 * persists WorldState. This module only implements the first of those —
 * it has no opinion on who calls it or when.
 *
 * No Supabase calls, no React dependencies. Deterministic given an id:
 * the same id passed twice never produces two entries.
 */

import type { WorldEvent, ScheduledEventSource } from '@/types/campaign'

export interface CreateScheduledWorldEventInput {
  id: string
  description: string
  /** Absolute turn number this event should fire at (see WorldEvent.triggerAtTurn). */
  triggerAtTurn: number
  /** Free-text categorization, e.g. 'caravan-return'. Optional. */
  type?: string
  /** Short label distinct from the full description. Optional. */
  title?: string
  /** Turn number this event was scheduled on. Optional, informational only. */
  createdTurn?: number
  /** Who/what scheduled this event. Defaults to 'director'. */
  source?: ScheduledEventSource
  /** Arbitrary structured data for whatever consumes this event when it fires. Optional. */
  payload?: Record<string, unknown>
  /** Prompt hint for the Director when this event later fires. Defaults to ''. */
  directorHint?: string
}

/**
 * Build a single new WorldEvent from a creation input. Pure. Always sets
 * `triggered: false` — the input has no way to override this, since only
 * tickWorld() may ever mark an event as fired.
 */
export function createScheduledWorldEvent(input: CreateScheduledWorldEventInput): WorldEvent {
  return {
    id: input.id,
    description: input.description,
    triggerAtTurn: input.triggerAtTurn,
    triggered: false,
    directorHint: input.directorHint ?? '',
    source: input.source ?? 'director',
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.createdTurn !== undefined ? { createdTurn: input.createdTurn } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
  }
}

/**
 * Add a single new scheduled event to an existing list, deduped by id.
 * Pure — never mutates `events`. Returns the same array reference when
 * `event.id` already exists (no-op), so callers can cheaply check whether
 * anything actually changed via reference equality.
 */
export function scheduleWorldEvent(events: WorldEvent[], event: WorldEvent): WorldEvent[] {
  if (events.some((e) => e.id === event.id)) return events
  return [...events, event]
}

/**
 * Merge multiple new scheduled events into an existing list in one pass,
 * deduped by id — both against `events` and within `newEvents` itself (if
 * two incoming events share an id, only the first is kept). Pure — never
 * mutates either input array. Returns the same `events` reference when
 * nothing new was actually added.
 */
export function mergeScheduledEvents(events: WorldEvent[], newEvents: WorldEvent[]): WorldEvent[] {
  const seenIds = new Set(events.map((e) => e.id))
  const additions: WorldEvent[] = []
  for (const event of newEvents) {
    if (seenIds.has(event.id)) continue
    seenIds.add(event.id)
    additions.push(event)
  }
  return additions.length > 0 ? [...events, ...additions] : events
}
