# Phase 11 — Living World: Engineering Specification

*Status: 📐 Not implemented. Design basis: `docs/design/LIVING_WORLD.md`. This spec is the field-level design doc made implementation-ready — exact types, exact function signatures, exact test plan.*

**Dependency note:** This phase has no dependency on Phase 10 (Director Intelligence) — they can be built in either order or in parallel. Phases 12 and beyond (Reputation, Legacy, Chronicle Mode) all depend on this phase being complete first — see `docs/design/PUBLIC_ALPHA_ROADMAP.md`.

---

## Goal

Give the world a structured, comparable sense of time, and a mechanism for scheduled events to fire and reach the Director — the two prerequisites for anything in the world changing independent of direct player action.

---

## 1. WorldClock Type

### New type, new field

`src/types/campaign.ts`:

```typescript
export type TimeOfDay = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export interface WorldClock {
  /** Absolute day counter since campaign start. Day 1 = campaign creation. */
  day: number
  timeOfDay: TimeOfDay
  /** Optional flavor label the Director can layer on top (e.g. "the 3rd of
      Harvestmoon"). Cosmetic only — day/timeOfDay are what logic keys off. */
  calendarLabel: string | null
}

export interface WorldState {
  // ...existing fields unchanged...
  /**
   * Structured, comparable time. Additive alongside the existing free-text
   * worldTime field (kept for Director flavor text) — clock is what
   * scheduled events and future Reputation/Legacy systems key off. Phase 11.
   */
  clock: WorldClock
}
```

Update `DEFAULT_WORLD_STATE`:
```typescript
export const DEFAULT_WORLD_STATE: WorldState = {
  // ...existing fields unchanged...
  clock: { day: 1, timeOfDay: 'morning', calendarLabel: null },
}
```

**Breaking-change check:** every place that spreads `DEFAULT_WORLD_STATE` (confirmed in Phase 10.0 audit: this pattern is used consistently across the codebase, e.g. `{ ...DEFAULT_WORLD_STATE, locations: [...] }`) picks up `clock` automatically — no fixture needs manual updating for this field specifically, unlike the Phase 10 `LocationState.weight` addition. Confirm this by re-running:
```bash
npx tsc --noEmit
```
after adding the type — any fixture that constructs a bare `WorldState` object literal *without* spreading `DEFAULT_WORLD_STATE` will fail to compile and needs `clock` added explicitly. Expected to be rare (most test fixtures already spread the default, per the established pattern since Phase 9.2).

---

## 2. Clock Advancement

### New WorldStateUpdate field

`src/lib/engine/worldDispatcher.ts`:

```typescript
export interface WorldStateUpdate {
  // ...existing fields unchanged...
  /**
   * Signals in-game time has passed, per the Director's narration (a rest,
   * a journey, an explicit time skip). Never inferred from real-world
   * elapsed time between sessions — see DIRECTOR_BIBLE.md §11.
   */
  clockAdvance?: {
    days?: number          // added to current day; omit for same-day advancement
    newTimeOfDay?: TimeOfDay
  }
}
```

### Dispatcher change

Extend `applyWorldStateUpdate` (follow the exact existing pattern — see how `currentLocationId` is handled just above where this should be inserted):

```typescript
// Advance the world clock — only when the Director's narration established
// that time passed. Never inferred from anything else.
if (patch.clockAdvance) {
  const nextDay = current.clock.day + (patch.clockAdvance.days ?? 0)
  next = {
    ...next,
    clock: {
      day: nextDay,
      timeOfDay: patch.clockAdvance.newTimeOfDay ?? current.clock.timeOfDay,
      calendarLabel: current.clock.calendarLabel, // unchanged by clock advancement alone
    },
  }
}
```

Extend `hasWorldStateChanges`:
```typescript
export function hasWorldStateChanges(update: Record<string, unknown>): boolean {
  const patch = update as WorldStateUpdate
  return Boolean(
    patch.worldTime ||
    patch.currentLocationId ||
    patch.clockAdvance ||   // add this line
    (Array.isArray(patch.newLocations) && patch.newLocations.length > 0) ||
    (Array.isArray(patch.npcUpdates) && patch.npcUpdates.length > 0),
  )
}
```

### Prompt change

`buildSystemPrompt` (`supabase/functions/narrate/index.ts`) — add to `## DIRECTOR RULES`:
```
- If your narration establishes that meaningful in-game time has passed (a
  rest, a journey, an explicit skip-ahead), set clockAdvance with the
  elapsed days and/or new time of day. Do NOT advance the clock for an
  ordinary single action/exchange — most turns should NOT include
  clockAdvance at all.
```

Add to the response schema section, inside `worldStateUpdates`:
```
"clockAdvance": { "days": 1, "newTimeOfDay": "morning" }
```
with the existing "omit any field with nothing to report" instruction already covering this (no new instruction needed there).

### Tests

Follow the exact pattern of the existing `currentLocationId` test block in `tests/unit/worldDispatcher.test.ts` (`describe('applyWorldStateUpdate — currentLocationId')`). New block:

```typescript
describe('applyWorldStateUpdate — clockAdvance (Phase 11)', () => {
  it('advances day by the given amount', () => { /* ... */ })
  it('updates timeOfDay when provided', () => { /* ... */ })
  it('preserves timeOfDay when clockAdvance.newTimeOfDay is omitted', () => { /* ... */ })
  it('does not advance the clock when clockAdvance is absent', () => { /* ... */ })
  it('hasWorldStateChanges returns true when clockAdvance is present', () => { /* ... */ })
})
```

---

## 3. Scheduled Event Trigger Mechanism

`WorldEvent` (`triggerAtTurn`, `triggered`, `directorHint`) already exists on `WorldState.scheduledEvents` — confirmed unused anywhere in the app as of Phase 10.0. This section wires it up.

**Naming correction to make during implementation:** `triggerAtTurn` should conceptually be `triggerOnDay` now that `WorldClock.day` exists — a scheduled event is about elapsed time, not action count. Recommend renaming the field (`triggerAtTurn` → `triggerOnDay`) rather than keeping a misleading name; this is a pre-1.0 internal field with zero live usage, so renaming has zero migration cost (no existing campaign data uses it).

```typescript
export interface WorldEvent {
  id: string
  description: string
  /** In-game day this event triggers. Compares against WorldClock.day. */
  triggerOnDay: number   // renamed from triggerAtTurn
  triggered: boolean
  directorHint: string
}
```

### New pure function

`src/lib/engine/worldDispatcher.ts` (or a new sibling file `worldClock.ts` if `worldDispatcher.ts` is getting large — judgment call at implementation time; the existing file was ~250 lines before this phase, still reasonable to extend in place):

```typescript
/**
 * Returns scheduled events that are due to fire (triggerOnDay <= current day,
 * not yet triggered), and a new WorldState with those events marked
 * triggered: true. Pure function — caller is responsible for surfacing the
 * returned events to the Director prompt on the NEXT request.
 */
export function checkScheduledEvents(
  worldState: WorldState,
): { dueEvents: WorldEvent[]; nextWorldState: WorldState } {
  const dueEvents = worldState.scheduledEvents.filter(
    (e) => !e.triggered && e.triggerOnDay <= worldState.clock.day,
  )
  if (dueEvents.length === 0) {
    return { dueEvents: [], nextWorldState: worldState }
  }
  const dueIds = new Set(dueEvents.map((e) => e.id))
  const nextWorldState: WorldState = {
    ...worldState,
    scheduledEvents: worldState.scheduledEvents.map((e) =>
      dueIds.has(e.id) ? { ...e, triggered: true } : e,
    ),
  }
  return { dueEvents, nextWorldState }
}
```

### Where this gets called

`src/components/adventure/useAdventureSession.ts` — after a turn's `worldStateUpdates` are applied (right after the existing `updateWorldState` call in the `onDone` handler, same location the Phase 9.2 `applyDirectorConfigUpdate` call was added), call `checkScheduledEvents` on the freshly-updated world state, persist the `nextWorldState` if any events fired (another `updateWorldState` call, or fold into the existing one if not yet persisted), and store `dueEvents` in local state for the *next* `buildNarrateRequest` call to include.

**New client state needed:** `AdventureState` (`useAdventureSession.ts`) gains a field, e.g. `pendingWorldEvents: WorldEvent[]`, cleared once consumed by the next request.

### New NarrateRequest field + prompt section

```typescript
// NarrateRequest (both promptBuilder.ts and the Edge Function's mirrored type)
triggeredWorldEvents?: Array<{ description: string; directorHint: string }>
```

`buildSystemPrompt` — new section, same pattern as `THIS TURN'S CHECK`:
```
${triggeredWorldEvents?.length ? `## TRIGGERED WORLD EVENTS (narrate the consequence of these as part of this turn)
${triggeredWorldEvents.map(e => `- ${e.directorHint}`).join('\n')}
` : ''}
```

### Who creates scheduled events

Director-authored, via a new `directorConfigUpdates`-adjacent (or `worldStateUpdates`-adjacent — recommend `worldStateUpdates` since `scheduledEvents` lives on `WorldState`, not `DirectorConfig`) field:

```typescript
// WorldStateUpdate
newScheduledEvents?: Array<{ id: string; description: string; triggerOnDay: number; directorHint: string }>
```

Dispatcher handling follows the exact `newLocations` dedup-by-id pattern already established.

### Tests

- `checkScheduledEvents` pure function: straightforward unit tests (due/not-due/already-triggered/multiple-due cases) — no mocking needed, follows the plain pure-function test style already used for `applyWorldStateUpdate`.
- Dispatcher extension for `newScheduledEvents`: same pattern as existing `newLocations` tests.
- `useAdventureSession` integration: extend `tests/unit/useAdventureSession.test.tsx` (established in Phase 9.2/9.3) with a scenario asserting a due event is included in the *next* `submitAction`'s captured request — follow the existing `capturedRequest` assertion pattern in that file exactly.

---

## Exit Criteria

- [ ] `WorldClock` type, `WorldState.clock` field, `clockAdvance` update mechanism — implemented and tested
- [ ] `WorldEvent.triggerAtTurn` renamed to `triggerOnDay`
- [ ] `checkScheduledEvents` pure function — implemented and tested
- [ ] Wired into `useAdventureSession.ts`'s turn-completion flow
- [ ] `TRIGGERED WORLD EVENTS` prompt section added
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` clean
- [ ] `npm run test:integration` run (persistence call sites changed — new `updateWorldState` call site for event-triggering, consistent with the Phase 9.2 rule to run integration tests when this happens)
- [ ] `docs/ROADMAP.md` updated with new Phase 11 entry (append only)
- [ ] `docs/design/LIVING_WORLD.md` status markers updated 📐 → ✅ for what ships

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
