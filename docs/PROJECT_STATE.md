# ChronAI Project State

- Last updated: 2026-07-13
- Current branch: `feature/presentation-playable-overworld`
- Current milestone: Playable Overworld complete (9/9)
- Current roadmap position: `docs/ROADMAP.md` > Presentation > Playable Overworld.
- Current PR: Not open/unknown from local repository state.

## Recent Architectural Decisions

See `docs/DECISIONS.md` for the append-only rationale behind foundational decisions, including the AI/rules/database boundary, presentation ownership limits, WorldRenderer, overworld state, and extending existing architecture instead of creating parallel systems.

## Active Work

The playable-overworld milestone is complete and awaiting commit/handoff. The unified Adventure Screen keeps the world as the playable surface, docks real Director narration and dialogue over it, exposes contextual interaction plus existing menu panels, and hands encounters to the existing combat flow. The overworld remains presentation/input only: meaningful actions use existing `AdventureActions` (`submitAction` and `startCombat`).

Primary files in scope:
- `src/components/adventure/AdventureHub.tsx`
- `src/components/adventure/overworld/*`
- `src/components/adventure/overworld/maps/*`
- `tests/unit/Overworld*.test.tsx`
- `tests/unit/overworld*.test.ts`

## Remaining Work

1. Commit the verified playable-overworld milestone when requested.
2. Push the feature branch and open a pull request when requested.
3. Run a manual touch-device pass before claiming touch play; the current overworld movement controls are keyboard-only.

## Current Git Status

- Branch contains uncommitted playable-overworld review fixes, tests, and continuity-document updates.
- No preview route, preview page, scratch file, migration, Edge Function, AI Director, rules-engine, persistence, world-tick, or combat-resolution change is present in the reviewed worktree.

## Known Temporary Files

- None.

## Next Recommended Task

Start the planned Dialogue Cinematics milestone as a separate phase/branch only after this milestone is committed. Preserve the existing `DialogueWindow`/`submitAction` boundary and add presentation polish without changing Director or rules contracts.
