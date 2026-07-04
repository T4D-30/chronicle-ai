# Phase 10 — Director Intelligence: Engineering Specification

*Status: 📐 Not implemented. Design basis: `docs/design/DIRECTOR_BIBLE.md`, `docs/design/DIRECTOR_EXAMPLES.md`. This spec is detailed enough for a future implementation session to execute directly without re-deriving design decisions.*

**Note on numbering:** this is "Phase 10" per the original design brief's Director Intelligence / Living World / Creator Tools / Release Candidate sequence. `docs/design/PUBLIC_ALPHA_ROADMAP.md` sequences the *design-doc* dependency chain differently (Living World first, since Reputation/Legacy/Chronicle Mode all depend on it) — that sequencing concern doesn't apply here, since Director Intelligence has no dependency on Living World. This phase can be implemented independently, in any order relative to Phase 11.

---

## Goal

Close the gap between what `DIRECTOR_BIBLE.md` locks in and what the live system prompt (`supabase/functions/narrate/index.ts`) actually instructs. Four specific rules are 📐 (specified, not implemented) as of Phase 10.0:

1. §9 — Never flatly refuse creative actions
2. §3 — Location-weight narration length tiering
3. §7 — Narrow between-scenes DM voice
4. §4 — Failure-as-complication, structured (currently prose-only judgment)

Everything else in the Bible (§1, §2, §5, §6) is already ✅ implemented as of Phase 9.3 — do not re-implement or restructure those sections; this phase is additive to the existing `buildSystemPrompt` function, following its established pattern exactly.

---

## 1. Never Flatly Refuse (§9)

### Change

Add a new rule to the `## DIRECTOR RULES` section of `buildSystemPrompt` (`supabase/functions/narrate/index.ts`), inserted alongside the existing rules list — do not restructure the list, append to it in a position that reads naturally (recommend: after the "HIDE INFORMATION" rule, before "ESCALATE HINTS," since both concern player-facing information handling).

**Exact rule text to add:**

```
- NEVER FLATLY REFUSE a creative or ambitious player action. Turn it into a
  challenge, a hard skill check, a quest hook, or an in-world explanation of
  why it's not possible YET (with a hint at what could make it possible later
  — an artifact, an ally, training, time). This does not override dice
  transparency: a creative framing earns narrative richness, never a bypass
  of the resolution engine. If a check is warranted, it still happens
  normally per FULL DICE TRANSPARENCY above.
```

### No type changes required

This is a pure prompt-text addition. No new fields on `NarrateRequest`, no client-side changes.

### Testing

The Edge Function has no direct Vitest coverage (confirmed absence since the original OpenAI migration — see `KNOWN_LIMITATIONS.md`). Follow the established verification discipline from Phase 9.3: manually confirm the template string still interpolates correctly (no new interpolation here, so this is a visual diff check, not a runtime one) and run the full existing suite to confirm nothing client-side broke (it shouldn't — no client-side files touched).

```bash
npx tsc --noEmit
npm test
npm run build
```

No integration test run needed — no persistence or service-layer change.

---

## 2. Location-Weight Narration Tiering (§3)

### New field required

`LocationState` (`src/types/campaign.ts`) needs a narrative weight signal. Add:

```typescript
export type LocationWeight = 'minor' | 'standard' | 'major'

export interface LocationState {
  id: string
  name: string
  type: LocationType
  parentId: string | null
  description: string
  visited: boolean
  discovered: boolean
  properties: Record<string, string | number | boolean>
  /**
   * Narrative weight — governs Director narration length per
   * DIRECTOR_BIBLE.md §3. Defaults to 'standard' for any location that
   * doesn't explicitly set this (including every location created before
   * this field existed) — this preserves current behavior exactly.
   */
  weight: LocationWeight
}
```

Update `DEFAULT_WORLD_STATE` usage sites: no change needed there (it's an empty array), but any test fixture across the codebase that constructs a `LocationState` literal will need a `weight` field added or TypeScript will fail. Search before implementing:

```bash
grep -rln "type: 'town'\|type: 'dungeon'\|type: LocationType" tests/ src/
```

At time of this spec, known fixture sites include (not exhaustive — re-run the grep before implementing, this list reflects the codebase as of Phase 10.0): `tests/unit/AdventureHub.test.tsx`, `tests/unit/AtlasPanel.test.tsx`, `tests/unit/worldDispatcher.test.ts`, `tests/unit/promptBuilder.test.ts`. Each needs `weight: 'standard'` added to its `LocationState` literals (unless a test specifically wants to exercise 'minor'/'major' behavior — see test plan below).

### Who sets `weight`

The Director, via `worldStateUpdates.newLocations[].weight` when narrating discovery of a new location — same pattern as every other Director-settable field. Suggested default in the prompt: the Director should default new locations to `'standard'` unless the narration context clearly signals otherwise (first sight of a major city, a campaign's climactic location, etc.) — err toward `'standard'`, since `'major'` should be rare and earned.

### Prompt change

In `buildSystemPrompt`, add narration-length guidance conditioned on the *current* location's weight (resolved via `ctx.currentLocation` — already available) — replace the existing flat "2-4 sentences" instruction with a tiered one:

```
- MEDIUM-LENGTH, CINEMATIC descriptions, tiered by location weight:
  - Minor/transitional locations: 1-2 sentences. Brisk, functional.
  - Standard locations (the default): 2-4 sentences. Rich sensory detail,
    not exhausting.
  - Major story locations: 4-7 sentences. Reserve this weight for moments
    that have earned it — first sight of a pivotal place, a climax. Most
    locations are NOT major; overusing this length flattens its impact.
```

**Implementation detail:** `buildSystemPrompt` needs the *current* location's `weight`, not just its name. `ctx.currentLocation` (in `NarrateRequest['worldContext']`, `promptBuilder.ts`) is currently just `string | null` (the resolved name). Extend it to carry weight too:

```typescript
// promptBuilder.ts — NarrateRequest['worldContext']
currentLocation: { name: string; weight: LocationWeight } | null
```

Update `buildNarrateRequest`'s resolution logic (`src/lib/ai/promptBuilder.ts`) — currently:
```typescript
currentLocation: campaign.worldState.currentLocationId
  ? (campaign.worldState.locations.find((l) => l.id === campaign.worldState.currentLocationId)?.name ?? null)
  : null,
```
becomes:
```typescript
currentLocation: (() => {
  const loc = campaign.worldState.currentLocationId
    ? campaign.worldState.locations.find((l) => l.id === campaign.worldState.currentLocationId)
    : null
  return loc ? { name: loc.name, weight: loc.weight } : null
})(),
```

Update the Edge Function's matching type and the `${ctx.currentLocation ? ... }` interpolation in `buildSystemPrompt` accordingly (currently `ctx.currentLocation` is used as a bare string — becomes `ctx.currentLocation.name`, with a new `ctx.currentLocation.weight` read for the tiering instruction).

### Testing

- Unit tests for `buildNarrateRequest`'s new `currentLocation` shape — extend `tests/unit/promptBuilder.test.ts`'s existing `describe('buildNarrateRequest — currentLocation ...')` block (already exists from Phase 9.2/9.3) with weight-specific assertions, following the exact pattern already there.
- Update every fixture identified by the grep above.

```bash
npx tsc --noEmit
npm test
npm run build
```

No integration test needed unless `weight` is persisted differently than other `LocationState` fields (it isn't — same JSONB column, no migration).

---

## 3. Between-Scenes DM Voice (§7)

### Scope, strictly bounded

**Only** fires at session pause or session end — never mid-turn, never as part of ordinary narration. This is the narrowest, highest-risk-if-done-wrong item in this phase (risk: scope creep into general "Director personality" commentary that breaks immersion — explicitly forbidden by the Bible).

### Mechanism

Do **not** add this to `buildSystemPrompt`/the narrate flow at all — narrate is only called during active turns, never at pause/end. Instead:

- New, separate, small Edge Function or extension of an existing pause/end-adjacent code path (check `src/lib/supabase/sessions.ts`'s `pauseSession`/`endSession` — these are currently pure DB writes, no AI call involved)
- Recommend: a new lightweight Edge Function `session-note` (or an optional parameter on an existing one) that takes the session's last few turns and returns ONE short, out-of-fiction sentence — not full narration, not the main Director persona mid-scene
- Client-side: `AdventureHub.tsx`'s pause handler (`handlePause`, added Phase 9.2) could optionally display this note alongside the existing "Progress saved" confirmation — additive UI, not a replacement

### Explicit non-goals for this sub-phase

Do not build: mid-scene commentary, reactions to player choices, humor, anything that could be perceived as the Director "watching" and judging the player. If in doubt, don't ship it — this is the one Bible rule where under-implementing is safer than over-implementing.

### Testing

New Edge Function or extension needs the same "no direct Vitest coverage, manual verification" treatment as `narrate` itself. If implemented as a client-side change (e.g., conditionally calling a new lightweight function), that part gets normal unit test coverage following the `AdventureHub.test.tsx` pattern for pause-flow tests already established in Phase 9.2.

---

## 4. Structured Failure-as-Complication (§4)

### Current state

Purely prose-level Director judgment today — the prompt says failures should create complications, but nothing structurally enforces or even tracks that a complication was offered.

### Recommended minimal change

Add an optional `complicationHint` field the Director can set on non-critical failures, mirroring how `checkResult` already flows:

```typescript
// NarrateRequest response side — director.ts's DirectorResult, extend with:
interface DirectorResult {
  // ...existing fields unchanged...
  /** Optional Director-authored note on what complication a failure created. Phase 10. */
  complicationNote?: string
}
```

This is presentation/logging-only at first — surfaced nowhere in the UI yet, just captured for future analysis of whether the Director is actually honoring this rule in practice. **Do not** build UI for this in Phase 10; that's premature without knowing whether the data is even being populated meaningfully.

### Prompt change

Add to the response schema section of `buildSystemPrompt`:
```
"complicationNote": "<if this turn's check failed, one clause on what complication resulted — omit on success or on trivial failures>"
```

### Testing

Extend `director.ts`'s `parseDirectorResponse` tests (`tests/unit/director.test.ts`) with `complicationNote` pass-through tests, following the exact pattern used for `directorConfigUpdates` in Phase 9.2 (optional field, defaults to absent, pass-through when present).

```bash
npx tsc --noEmit
npm test
npm run build
```

---

## Suggested Implementation Order Within This Phase

1. §9 (never refuse) — pure prompt text, zero risk, ship first
2. §4 (complication note) — small type addition, follows an exact existing pattern
3. §3 (location weight) — larger, touches multiple fixtures, do with care
4. §7 (between-scenes voice) — highest design risk, do last, consider shipping separately from the other three if time-constrained

---

## Exit Criteria

- [ ] All four sub-items implemented or explicitly deferred with a note in `KNOWN_LIMITATIONS.md`
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` all clean
- [ ] `docs/ROADMAP.md` updated with a new Phase 10 entry (append, do not edit Phase 9.x history)
- [ ] `docs/design/DIRECTOR_BIBLE.md` status markers updated from 📐 to ✅ for whatever actually ships

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
