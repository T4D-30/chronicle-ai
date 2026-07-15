# ChronAI Project State

- Last updated: 2026-07-15
- Current branch: `main` (cleanup branch `feature/presentation-unified-screen-cleanup` in review)
- Current milestone: Unified Adventure Screen — complete and merged (PR #4); post-merge hygiene pass in review.
- Current roadmap position: `docs/ROADMAP.md` > Presentation > Unified Adventure Screen (complete) → Dialogue Cinematics (next).
- Current PR: Hygiene-pass draft PR for `feature/presentation-unified-screen-cleanup`.

## Recent Architectural Decisions

See `docs/DECISIONS.md` for the append-only rationale behind foundational decisions, including the AI/rules/database boundary, presentation ownership limits, WorldRenderer, overworld state, extending existing architecture instead of creating parallel systems, and the unified Adventure screen superseding the tabbed Story/World split.

## Active Work

The Unified Adventure Screen shipped in PR #4 (merged to `main` as `db19b80`): one screen with the playable world as the always-mounted primary surface, the persistent `StoryHud` (Talk opens locked NPC dialogue; Inspect/Collect/Enter and all other narration are ambient beats with movement free), the contextual `ActionStrip` (faced-entity verbs, Rest, Menu), and every panel — Character, Dice, Journal, Quests, Atlas, Codex, Settings, flagged Debug — opening through the pause overlay over the frozen world. All intents flow through the existing overworld adapter and `AdventureActions`; no Adventure Controller, rules-engine, AI Director, persistence, world-tick, or Supabase contract changed.

The current hygiene pass (this branch) refreshes this snapshot and deletes the superseded, unrendered components the milestone left in place: `AdventureLeftNav`, `AdventureRightSidebar`, `StoryPanel`, `AdventureScenePanel`, `ActionBar`, `DialogueWindow`, plus the test files exclusively covering them. A repository-wide search confirmed no runtime imports or supported flows depended on them.

## Remaining Work

1. Review and merge the hygiene-pass draft PR; do not merge automatically.
2. The old WorldStatusSidebar content (world time, discovered-location/NPC counts) has no surface on the unified screen — decide whether it becomes a pause-overlay tab in a later phase (deliberately not restored in the hygiene pass). `PartyStatusPanel`/`WorldStatusSidebar` component files remain for that decision.
3. Overworld movement remains keyboard-only; touch controls are a future phase.
4. Next roadmap milestone: Dialogue Cinematics (builds on StoryHud). Before starting, decide the portrait-asset/licensing approach.

## Current Git Status

- `main` contains the merged Unified Adventure Screen (PR #4, `db19b80`).
- `feature/presentation-unified-screen-cleanup` holds the single hygiene commit (docs refresh + superseded-component deletion).
- No migration, Edge Function, AI Director, rules-engine, persistence, world-tick, or combat-resolution change is present.

## Known Temporary Files

- None. (`.claude/` is local tooling, excluded via `.git/info/exclude`, and must stay out of commits.)

## Next Recommended Task

After the hygiene PR merges, begin Dialogue Cinematics on a fresh feature branch — portraits, pacing, and cinematic transitions layered on the existing StoryHud without changing its action or narration contracts.
