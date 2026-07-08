/**
 * World Tick — Phase 12.1 Step 1 (Living World Engine foundation)
 *
 * The smallest deterministic contract for advancing a campaign's world by
 * one tick. A "tick" here is measured in the same unit already used
 * throughout WorldState/DirectorConfig — the session's turn number
 * (see WorldEvent.triggerAtTurn, PlotThread.startedAtTurn in
 * src/types/campaign.ts) — not a new, separate counter.
 *
 * Design: purely functional (WorldState in → WorldState out), no Supabase
 * dependency, no AI call, no randomness, no wall-clock time — same shape
 * as src/lib/engine/worldDispatcher.ts's applyWorldStateUpdate(). Inputs
 * are never mutated.
 *
 * SCOPE (Step 1 only): this module only resolves WorldEvent entries that
 * are already present in WorldState.scheduledEvents — it does not create,
 * schedule, or fabricate any event. Nothing in the running app currently
 * populates scheduledEvents (confirmed: worldDispatcher.ts's
 * WorldStateUpdate has no field for adding one), so this module is
 * correct but functionally inert until a future phase wires a producer.
 * It is also not wired into adventureController.ts/useAdventureSession.ts
 * yet — that integration is explicitly out of scope for this step.
 */

import type { WorldState, WorldEvent } from '@/types/campaign'

/** Result of advancing a WorldState by one tick. */
export interface WorldTickResult {
  /** The updated WorldState. A new reference — input is never mutated. */
  worldState: WorldState
  /** Scheduled events that became due and were marked triggered this tick. */
  firedEvents: WorldEvent[]
}

/**
 * Returns the scheduled events that are due at `currentTurn` and have not
 * already fired. Pure — does not mutate `events`. Inclusive: an event
 * with `triggerAtTurn === currentTurn` is due.
 */
export function getDueEvents(events: WorldEvent[], currentTurn: number): WorldEvent[] {
  return events.filter((event) => !event.triggered && event.triggerAtTurn <= currentTurn)
}

/**
 * Advances `worldState` by one tick at `currentTurn`: any scheduled
 * events whose triggerAtTurn has arrived are marked triggered in the
 * returned WorldState and surfaced in `firedEvents`. Never creates,
 * removes, or invents an event — it only resolves ones already scheduled
 * elsewhere. Pure function; never mutates `worldState`.
 */
export function tickWorld(worldState: WorldState, currentTurn: number): WorldTickResult {
  const due = getDueEvents(worldState.scheduledEvents, currentTurn)

  if (due.length === 0) {
    return { worldState, firedEvents: [] }
  }

  const dueIds = new Set(due.map((event) => event.id))
  const nextScheduledEvents = worldState.scheduledEvents.map((event) =>
    dueIds.has(event.id) ? { ...event, triggered: true } : event,
  )

  return {
    worldState: { ...worldState, scheduledEvents: nextScheduledEvents },
    firedEvents: due,
  }
}
