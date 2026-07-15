# ChronAI Project State

- Last updated: 2026-07-15
- Current branch: `feature/presentation-dialogue-cinematics`
- Current milestone: Dialogue Cinematics v1 — in progress (B1–B4). Unified Adventure Screen (PR #4), its hygiene pass (PR #5), and Unified Check Result Feedback (PR #6) are merged to `main`.
- Current roadmap position: `docs/ROADMAP.md` > Presentation > Dialogue Cinematics.
- Current PR: none yet (draft PR opens after B4).

## Recent Architectural Decisions

See `docs/DECISIONS.md` for the append-only rationale behind foundational decisions, including the AI/rules/database boundary, presentation ownership limits, WorldRenderer, overworld state, extending existing architecture instead of creating parallel systems, and the unified Adventure screen superseding the tabbed Story/World split.

## Active Work

The Unified Adventure Screen shipped in PR #4 (merged to `main` as `db19b80`): one screen with the playable world as the always-mounted primary surface, the persistent `StoryHud` (Talk opens locked NPC dialogue; Inspect/Collect/Enter and all other narration are ambient beats with movement free), the contextual `ActionStrip` (faced-entity verbs, Rest, Menu), and every panel — Character, Dice, Journal, Quests, Atlas, Codex, Settings, flagged Debug — opening through the pause overlay over the frozen world. All intents flow through the existing overworld adapter and `AdventureActions`; no Adventure Controller, rules-engine, AI Director, persistence, world-tick, or Supabase contract changed.

The hygiene pass (PR #5, merged as `cc00aa6`) deleted the superseded components and corrected all documentation to the unified architecture. The current micro-milestone, Unified Check Result Feedback, restores exploration dice transparency (Constitution Law 6): the new `CheckResultDock` renders the existing `lastCheckResult` engine summary — die face, modifier, total, DC, outcome — as a compact dock beside the StoryHud, with the pre-cleanup 4200 ms auto-dismiss plus a keyboard-accessible manual dismiss, both through the existing `clearCheckResult` contract. Presentation only; no engine/Director/persistence/data-shape change.

## Remaining Work

1. Review and merge the check-result-feedback draft PR; do not merge automatically.
2. The old WorldStatusSidebar content (world time, discovered-location/NPC counts) has no surface on the unified screen — decide whether it becomes a pause-overlay tab in a later phase (deliberately not restored in the hygiene pass). `PartyStatusPanel`/`WorldStatusSidebar` component files remain for that decision.
3. Overworld movement remains keyboard-only; touch controls are a future phase.
4. Next roadmap milestone: Dialogue Cinematics (builds on StoryHud). Before starting, decide the portrait-asset/licensing approach.

## Current Git Status

- `main` contains the merged Unified Adventure Screen (PR #4, `db19b80`) and its hygiene pass (PR #5, `cc00aa6`).
- `feature/presentation-check-result-feedback` holds this micro-milestone (CheckResultDock + tests, then this documentation commit).
- No migration, Edge Function, AI Director, rules-engine, persistence, world-tick, or combat-resolution change is present.

## Known Temporary Files

- None. (`.claude/` is local tooling, excluded via `.git/info/exclude`, and must stay out of commits.)

## Next Recommended Task

After this PR merges, begin Dialogue Cinematics on a fresh feature branch — portraits, pacing, and cinematic transitions layered on the existing StoryHud without changing its action or narration contracts.
