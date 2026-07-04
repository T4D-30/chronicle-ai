# Chronicle AI — Reputation System Specification

*Field-level specification. Elaborates [`DIRECTOR_BIBLE.md`](DIRECTOR_BIBLE.md) §12. Status: 📐 fully unspecified as implementation.*

---

## What Already Exists

- `FactionState.standing`: `'allied' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile'` — a five-point scale, already typed, set at campaign creation, never updated dynamically by play.
- `NpcMemoryEntry.disposition`: same five-point scale, per-individual-NPC, and this one *is* actively written to by the Director today (Phase 9.2) via `directorConfigUpdates.npcMemoryUpdates`.

**The gap:** there is no *global* reputation concept at all, no *settlement*-level reputation distinct from faction, and faction reputation doesn't move dynamically. Individual NPC disposition is the only reputation-adjacent thing that's actually live.

---

## Proposed Scopes

Reputation is tracked at four independent scopes. A single action can affect multiple scopes at different magnitudes.

```typescript
type ReputationScope = 'global' | 'faction' | 'settlement' | 'npc'

/** Shared five-point scale — reuses the existing standing/disposition values
    rather than inventing a new vocabulary. Consistency with what's already
    shipped (FactionState.standing, NpcMemoryEntry.disposition) matters more
    than scope-specific nuance here. */
type ReputationLevel = 'allied' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile'

interface ReputationEntry {
  scope: ReputationScope
  /** Faction id, settlement/location id, or NPC id. Null for 'global'. */
  targetId: string | null
  level: ReputationLevel
  /** Numeric score behind the level, for fine-grained tracking between
      level thresholds — the level is what's shown/narrated, the score is
      what actually moves incrementally per event. */
  score: number
  /** Recent contributing events, most recent first, capped (see below). */
  recentEvents: ReputationEvent[]
}

interface ReputationEvent {
  /** Short description for Director/UI display. */
  description: string
  /** Signed magnitude — positive raises reputation, negative lowers it. */
  delta: number
  /** In-game day this occurred (ties to WorldClock — see LIVING_WORLD.md). */
  occurredOnDay: number
  /** Whether this event has finished "spreading" — see Spread below. */
  fullySpread: boolean
}
```

`ReputationEntry[]` would live on `WorldState` (or a new top-level `campaign.reputation` JSONB column — additive either way, no migration required since both `world_state` and any new campaign column would be unconstrained `jsonb`, consistent with every other Phase 9 addition).

---

## Severity Scaling

**Locked decision:** reputation deltas are not fixed per action type — they scale with stakes. A design table, not a hardcoded formula (the Director assigns the delta within the band; this keeps room for narrative judgment while bounding the range):

| Severity | Example | Delta range |
|---|---|---|
| Trivial | Minor kindness or rudeness, low visibility | ±1–2 |
| Notable | A meaningful favor, a public confrontation | ±3–6 |
| Major | Saving/endangering a settlement, exposing/committing a serious crime | ±8–15 |
| Legendary | Toppling or saving a faction, a kingdom-altering act | ±20+ |

The Director proposes a `reputationEvent` (scope, targetId, delta within the appropriate band, description) as part of `directorConfigUpdates` when narration clearly warrants one — same additive pattern as `newThreads`/`npcMemoryUpdates`. **Constraint:** the Director should not manufacture reputation events for routine action-resolution; this is for narratively significant moments only, mirroring the existing "don't invent quests that didn't arise from the narration" discipline already locked for Quest Log (Phase 9.2).

---

## Spread

A reputation event doesn't just apply at its origin scope — it can propagate outward over in-game time, arriving distorted or delayed at other scopes.

**Mechanism (📐, depends on `LIVING_WORLD.md`'s scheduled-event system):**

1. A `settlement`- or `faction`-scope event with sufficient magnitude (Notable or above) schedules a `WorldEvent` with a `triggerAtTurn` some in-game days later (delay scales with distance/obscurity — a capital city hears local news fast, a remote village hears rumors slowly).
2. When that event triggers, the Director may narrate the story having "arrived," possibly changed in the retelling (a `spreadDistortion` note — e.g. "the story that reaches here credits you with far more than you actually did," or the reverse) — this is Director narrative license, not an engine rule; the underlying `score` change on arrival is smaller than the origin event and explicitly does not multiply the original.
3. `fullySpread` flips `true` once this has resolved, preventing the same event from spreading indefinitely.

**Explicitly not modeled:** a full rumor-network simulation with per-NPC knowledge state. Spread is scope-level (does settlement B know about the event in settlement A yet), not NPC-level (does this specific bard know). NPC-level awareness remains governed by `NpcMemoryEntry.knownFacts`, written to directly by the Director when a specific NPC's knowledge is narratively relevant — exactly as it works today.

---

## Negative Reputation

No different mechanism from positive — same `ReputationEvent.delta`, just negative. The design risk is entirely in Director judgment (assigning appropriate severity to harmful acts) rather than in the data model. No additional spec needed beyond the severity table above.

---

## UI Surface (out of scope for this doc, flagged for future design pass)

This spec covers the data model and update mechanism only. Where/how reputation is shown to the player (a new tab? folded into the existing World Status sidebar built in Phase 9.1? a Codex extension?) is a UI design decision deferred to whichever phase implements this — likely an extension of the `WorldStatusSidebar` pattern already established in `AdventureHub.tsx`, since that component's entire design principle ("show only real WorldState data, never fabricate") applies directly here.

---

## Implementation Checklist (Phase 10.2 — see `PUBLIC_ALPHA_ROADMAP.md`)

- [ ] Add `ReputationEntry`/`ReputationEvent`/`ReputationScope`/`ReputationLevel` types to `src/types/campaign.ts`
- [ ] Decide storage location: extend `WorldState` vs. new `campaign.reputation` column (recommend extending `WorldState` — keeps one JSONB blob per campaign rather than fragmenting persistence logic across two)
- [ ] Extend `worldDispatcher.ts` with `applyReputationUpdate`/`hasReputationChanges`, following the exact established pattern of `applyWorldStateUpdate`/`applyDirectorConfigUpdate`
- [ ] Extend Edge Function prompt: severity table as Director guidance, instruction on when to propose a `reputationEvent`
- [ ] Depends on `LIVING_WORLD.md`'s `WorldClock`/scheduled-event work for the Spread mechanism — sequence this after Phase 11, or ship reputation scoring without spread first and add spread once the clock exists
- [ ] Tests: pure dispatcher functions, unit-testable identically to existing dispatcher tests

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
