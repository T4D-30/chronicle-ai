# Chronicle AI — Living World Specification

*Field-level specification for how the world evolves independent of direct player action. Elaborates [`DIRECTOR_BIBLE.md`](DIRECTOR_BIBLE.md) §8. Status: 📐 fully unspecified as implementation — this document is the spec, not a record of built work.*

---

## What Already Exists (foundation, not the feature)

These types are real, in the schema today (`src/types/campaign.ts`), and actively used — but only for *reactive* state (things the Director records because the player caused them), never for *proactive* off-screen evolution:

| Field | Type | Currently used for |
|---|---|---|
| `WorldState.worldTime` | `string \| null` | Free-text time description the Director can set. Not structured, not compared, nothing keys off it. |
| `WorldState.currentLocationId` | `string \| null` | Real, resolved honestly against `locations[]`. Player-driven only. |
| `WorldState.locations[]` (`LocationState`) | typed array | Discovery/visited tracking. Has a `properties` bag (`Record<string, string \| number \| boolean>`) already available for Director-set flags like `{ cleared: true }`. |
| `WorldState.npcs[]` (`NpcWorldState`) | typed array | Alive/dead tracking, combat stats. |
| `WorldState.factions[]` (`FactionState`) | typed array | `standing` field exists but nothing currently *writes* to it dynamically — it's set at campaign creation and never updated by play. |
| `WorldState.scheduledEvents[]` (`WorldEvent`) | typed array | **Fully unused.** Has `triggerAtTurn`, `triggered`, `directorHint` — this is scaffolding for exactly the "world advances on a schedule" mechanic this spec calls for, and nothing reads or writes it anywhere in the app today. |
| `DirectorConfig.activeThreads[]` (`PlotThread`) | typed array | Real, player-facing (Quest Log). Player-driven only. |
| `DirectorConfig.npcMemory[]` (`NpcMemoryEntry`) | typed array | Real, player-facing (Codex). Player-driven only. |

**The gap is precise:** every one of these fields changes *only* in direct response to a player action reaching the Director. Nothing changes because in-game time passed. That's the entire scope of "Living World" as new work.

---

## Time Model (prerequisite for everything else in this doc)

`worldTime` today is free text ("Dusk, third day of travel") set at the Director's discretion, with no structure. To schedule or evolve anything against elapsed time, time needs to become **comparable**, not just descriptive.

### Proposed structure (📐 new)

```typescript
interface WorldClock {
  /** Absolute day counter since campaign start. Day 1 = campaign creation. */
  day: number
  /** Coarse time-of-day, sufficient for narration and scheduling — not hour-level. */
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
  /** Optional in-world calendar label the Director can layer on top for flavor (e.g. "the 3rd of Harvestmoon"). Purely cosmetic — day/timeOfDay are load-bearing. */
  calendarLabel: string | null
}
```

Add `WorldState.clock: WorldClock` alongside (not replacing) the existing `worldTime: string | null` — keep `worldTime` as the Director's free-text flavor description, add `clock` as the structured, comparable value everything else keys off. This is additive and backward-compatible: existing campaigns with `worldTime: null` and no `clock` simply have no scheduled evolution until the field is populated.

### Advancement rule (locked, from `DIRECTOR_BIBLE.md` §11)

The clock advances **only** when the Director's narration establishes that in-fiction time has passed — a rest, a journey, a skipped-ahead scene, an explicit time jump. It never advances based on wall-clock time between sessions. A session paused for three real-world weeks and resumed shows a clock unchanged from when it was paused.

**Where this is decided:** the Director includes a `clockAdvance` hint in `worldStateUpdates` (same pattern as `currentLocationId` — see `promptBuilder.ts`), e.g. `{ clockAdvance: { days: 1, newTimeOfDay: 'morning' } }`, only when the narration itself described time passing. The client-side dispatcher (`worldDispatcher.ts`) applies it the same way it applies every other `WorldStateUpdate` field today — no new architectural pattern, just a new field following the existing one.

---

## Off-Screen Evolution Model

### The core mechanism: scheduled events, finally wired up

`WorldEvent` already has the right shape. The missing piece is *when it's checked and by whom*.

**Proposed flow (📐):**

1. On each turn, after the Director's response is applied, the client checks `WorldState.scheduledEvents` for any event where `triggerAtTurn <= WorldState.clock.day` (comparing against the *day*, not the turn counter — turns are player-action-driven, days are time-driven; a scheduled event is about time passing, not about how many actions the player took) and `triggered === false`.
2. Any triggered events are collected and their `directorHint` strings are added to the *next* Director request's system prompt, in a new `TRIGGERED WORLD EVENTS` section — same pattern as the existing `THIS TURN'S CHECK` injection.
3. The Director narrates the consequence of the triggered event(s) as part of the next turn's response — the world event becomes part of the fiction the player experiences, not a silent backend flag flip.
4. `triggered` is set `true` once consumed.

**Who creates scheduled events?** Two sources, both additive to the existing `worldStateUpdates`/`directorConfigUpdates` pattern:
- The Director itself, when narration implies a future consequence ("the guild said they'd decide by the new moon" → a `WorldEvent` scheduled for that day)
- A future world-generation pass at campaign creation (a festival calendar, a faction's planned moves) — out of scope for this spec, flagged as Phase 11 stretch

### Faction and settlement drift (the actual "world changes while you're away" feeling)

`FactionState.standing` exists but never moves on its own. Two proposed mechanisms, both driven by the scheduled-event system above rather than a new parallel system:

- **Reactive drift**: a faction's standing shifts as a direct, immediate consequence of a specific player action (already possible today via `worldStateUpdates`, just not exercised — no new spec needed here, this is really a Reputation System concern, see `REPUTATION_SYSTEM.md`)
- **Ambient drift**: a faction's fortunes shift over elapsed time *independent* of the player — a rival faction's scheduled event resolves and shifts the balance of power, and the next time the player interacts with either faction, the Director reflects the new state. This is exactly a `WorldEvent` with a `directorHint` like "The Merchant Guild's bid failed; the Thieves' Guild gained influence in the docks district."

**Constraint (locked):** ambient drift must never contradict something the player directly caused or was told. If the player personally brokered a truce between two factions, no ambient event should silently undo it. Scheduled events that touch a faction/location/NPC the player has *actively shaped* should be reviewed (by the Director, at generation time) against `activeThreads` and `npcMemory` for contradiction before being scheduled — this is a soft constraint on prompt design, not an engine-enforced rule, and is the main open design risk in this spec.

---

## What This Does NOT Include (explicitly out of scope for this spec)

- Real-time simulation of every NPC's daily schedule (too expensive, not needed for the "world feels alive" goal — selective, narratively-relevant events achieve the same feeling at a fraction of the complexity)
- Automatic economic simulation (prices, supply/demand) — flavor only, via `directorHint` text, not a modeled economy
- Any change to the deterministic engine (`src/lib/engine/`) — Living World is entirely a Director-narration and `WorldState`-patching concern, same layer as everything else added in Phase 9.2/9.3. It does not touch dice resolution, character stats, or combat.

---

## Implementation Checklist (for the engineering session that builds this — see `PUBLIC_ALPHA_ROADMAP.md` Phase 11)

- [ ] Add `WorldClock` type and `WorldState.clock` field (additive, default `null` or day 1)
- [ ] Extend `WorldStateUpdate` (client) and the Edge Function's request/response types with `clockAdvance`
- [ ] Extend `worldDispatcher.ts`'s `applyWorldStateUpdate` to handle `clockAdvance`
- [ ] Add scheduled-event trigger-check logic (client-side, runs after each turn) — new function, e.g. `checkScheduledEvents(worldState, currentDay)`, pure and testable in isolation like every other dispatcher function
- [ ] Extend the Edge Function system prompt: inject `TRIGGERED WORLD EVENTS` section when present, same pattern as `THIS TURN'S CHECK`
- [ ] Extend the Edge Function system prompt: instruct the Director on when it's allowed to schedule a new `WorldEvent` (time-bound promises, "check back in X days" moments)
- [ ] Tests: pure dispatcher functions get unit tests exactly like `applyWorldStateUpdate`/`applyDirectorConfigUpdate` do today (see `tests/unit/worldDispatcher.test.ts` for the established pattern to follow)

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
