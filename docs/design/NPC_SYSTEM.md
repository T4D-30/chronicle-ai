# Chronicle AI — NPC System Specification

*Covers NPC memory (already real) and the Legacy/Nemesis system (📐 new). Elaborates [`DIRECTOR_BIBLE.md`](DIRECTOR_BIBLE.md) §12.*

---

## Part 1 — NPC Memory (✅ Implemented, Phase 9.2)

Two distinct NPC representations exist today, serving different purposes. This split is intentional, not duplication — documenting it here so future work doesn't accidentally merge them incorrectly.

| Type | Lives on | Purpose | Written by |
|---|---|---|---|
| `NpcWorldState` | `WorldState.npcs[]` | Combat-relevant: is this NPC alive, where are they, what are their combat stats | Director, via `worldStateUpdates.npcUpdates` |
| `NpcMemoryEntry` | `DirectorConfig.npcMemory[]` | Narrative-relevant: disposition, known facts, met status — powers the Codex UI | Director, via `directorConfigUpdates.npcMemoryUpdates` |

An NPC can exist in one, both, or neither at a given time — a combat-only enemy might never get an `NpcMemoryEntry` (no narrative weight), while a purely social NPC might never get an `NpcWorldState` (never enters combat).

**Known minor inconsistency (flagged, not fixed in this pass — see repository audit):** `NpcMemoryEntry.disposition` uses a four-value scale (`friendly | neutral | suspicious | hostile`) while `FactionState.standing` uses a five-value scale (`allied | friendly | neutral | unfriendly | hostile`). These should probably converge before the Reputation System (which explicitly reuses "the existing standing/disposition values") is implemented — see `REPUTATION_SYSTEM.md`. Converging them is a small, low-risk type change but touches live Codex rendering (`CodexPanel.tsx`) and its tests, so it's flagged for a dedicated small PR rather than done silently inside this documentation pass.

**Gating rules (✅ implemented, `CodexPanel.tsx`):** only NPCs with `metPlayer: true` are ever shown to the player. Unmet NPCs the Director is privately tracking stay private — same information-hiding discipline as everything else in the Director Bible §5.

---

## Part 2 — Legacy / Nemesis System (📐 New Specification)

**Design intent:** NPCs the player meaningfully affects don't freeze in place. A spared villain, a rescued child, a humiliated noble — these should be able to continue existing and changing off-screen, and return later altered by what happened in between. This is explicitly original to Chronicle AI, not a reimplementation of any copyrighted nemesis/rival system — the mechanism here is built from this project's own existing primitives (scheduled `WorldEvent`s, NPC memory, Director-narrated consequence), not borrowed design.

### What Qualifies for Legacy Tracking

Not every NPC — that would be both expensive and narratively noisy. An NPC becomes legacy-tracked when the Director recognizes a **meaningful, memorable player impact** on them: sparing someone who could have been killed, a significant betrayal or rescue, a public humiliation, empowering someone who was powerless. This is a Director judgment call, not an automatic trigger — consistent with how Quest Log threads are only created when "a quest-worthy goal emerges," never automatically.

### Proposed Type

```typescript
type LegacyRelationship = 'ally' | 'rival' | 'nemesis' | 'debtor' | 'unresolved'

interface LegacyThread {
  id: string
  /** Links to the NpcMemoryEntry this legacy thread is about. */
  npcId: string
  npcName: string
  relationship: LegacyRelationship
  /** The originating moment — what the player did that started this thread. */
  originEvent: string
  /** In-game day the origin event occurred (ties to WorldClock). */
  originDay: number
  /**
   * What this NPC has been doing off-screen, updated as scheduled events
   * fire. Most recent first. This is the NPC's own arc, narrated in
   * summary — not full scene-by-scene simulation.
   */
  developments: LegacyDevelopment[]
  /** Whether this NPC is due to re-enter the story — see Return below. */
  readyToReturn: boolean
}

interface LegacyDevelopment {
  description: string
  occurredOnDay: number
}
```

`LegacyThread[]` would live alongside `activeThreads` on `DirectorConfig` — a new `DirectorConfig.legacyThreads` field, additive, same JSONB column, no migration.

### Off-Screen Development (depends on `LIVING_WORLD.md`)

Exactly the scheduled-event mechanism specified in `LIVING_WORLD.md`: when a `LegacyThread` is created, the Director may schedule a `WorldEvent` with a `directorHint` describing what this NPC might be doing by a future in-game date ("the spared bandit leader has had two months to rebuild — check what that looks like"). When it fires, the Director narrates a `LegacyDevelopment` and may set `readyToReturn: true` if the moment is narratively right for the NPC to re-enter the story.

**Constraint (locked):** development is proposed by the Director at the *scheduling* moment (what plausibly could happen), but the actual content at *trigger* time is generated fresh, informed by everything that's happened in the campaign since — not a pre-written outcome playing out on rails. This keeps legacy NPCs consistent with the Director's general "narrate consequence, don't predetermine" discipline (Director Bible §2).

### Return

`readyToReturn: true` is a signal, not an automatic scene insertion. The Director should look for a natural narrative opportunity to bring the NPC back — a relevant location visit, a related quest thread, a thematically appropriate moment — rather than forcing a return the moment the flag flips. This mirrors how `WorldEvent.triggered` already works: the flag says "this is now available to the Director," not "this must happen on this exact turn."

### Worked Examples (informal — see `DIRECTOR_EXAMPLES.md` for full narrated versions)

- **Spared villain**: player defeats but doesn't kill a bandit leader → `LegacyThread(relationship: 'nemesis')` → scheduled development: "gathering resources, recruiting" → returns later, stronger, possibly with new allies of their own
- **Rescued child**: player saves a child from danger → `LegacyThread(relationship: 'debtor')` or `'ally'` → scheduled development: "grows up, possibly trains" → returns years later (Chronicle Mode timescale) as a capable ally, remembering exactly who saved them
- **Humiliated noble**: player publicly embarrasses a noble rather than defeating them physically → `LegacyThread(relationship: 'rival')` → scheduled development: "works political channels rather than direct confrontation" → returns as a political obstacle, not a combat encounter — the *form* of their return should match the *form* of the original conflict

---

## Implementation Checklist (Phase 10.2, bundled with Reputation — see `PUBLIC_ALPHA_ROADMAP.md`)

- [ ] Resolve the disposition/standing scale inconsistency flagged in Part 1 before or alongside this work
- [ ] Add `LegacyThread`/`LegacyDevelopment`/`LegacyRelationship` types
- [ ] Add `DirectorConfig.legacyThreads: LegacyThread[]` (additive, default `[]`)
- [ ] Extend `worldDispatcher.ts` with legacy-thread creation/update functions, same established pattern
- [ ] Depends on `LIVING_WORLD.md`'s scheduled-event mechanism for the off-screen development loop
- [ ] Extend Edge Function prompt with Legacy guidance and the "propose a legacy thread only for meaningful impact" constraint
- [ ] UI: likely a Codex extension (legacy NPCs shown distinctly from ordinary met-NPC entries) — deferred design decision, same as Reputation's UI surface
- [ ] Tests: pure dispatcher functions, unit-testable identically to existing dispatcher tests

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
