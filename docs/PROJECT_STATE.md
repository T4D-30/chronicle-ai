# ChronAI Project State

- Last updated: 2026-07-13
- Current branch: `feature/presentation-playable-overworld`
- Current milestone: Playable Overworld complete (9/9)
- Current roadmap position: `docs/ROADMAP.md` > Presentation > Playable Overworld.
- Current PR: Not open/unknown from local repository state.

## Recent Architectural Decisions

See `docs/DECISIONS.md` for the append-only rationale behind foundational decisions, including the AI/rules/database boundary, presentation ownership limits, WorldRenderer, overworld state, and extending existing architecture instead of creating parallel systems.

## Active Work

The playable-overworld milestone is complete and fully verified. The World tab provides the playable map, NPC dialogue stays docked over the visible map, contextual interactions use grounded intents, the pause menu reuses existing panels, and encounters hand off to the existing combat flow. The overworld remains presentation/input only: meaningful actions use existing `AdventureActions` (`submitAction` and `startCombat`). Story and World remain separate AdventureHub tabs in this milestone; merging them into one unified Adventure screen is the next presentation phase, not part of Overworld 9/9.

Primary files in scope:
- `src/components/adventure/AdventureHub.tsx`
- `src/components/adventure/overworld/*`
- `src/components/adventure/overworld/maps/*`
- `tests/unit/Overworld*.test.tsx`
- `tests/unit/overworld*.test.ts`

## Remaining Work

1. Commit and push the verified playable-overworld milestone.
2. Open a pull request for review.
3. Do not claim touch play; the responsive layout is verified at 390×844, but overworld movement remains keyboard-only.

## Current Git Status

- The continuity-document pass is committed separately as `cee5258`.
- The playable-overworld implementation, scoped review fixes, tests, and final verification record are ready for their own milestone commit.
- No preview route, preview page, scratch file, migration, Edge Function, AI Director, rules-engine, persistence, world-tick, or combat-resolution change is present in the reviewed worktree.

## Known Temporary Files

- None.

## Next Recommended Task

Create `feature/presentation-unified-adventure-screen` from the landed work and merge the separate Story and World experiences as the next presentation milestone. Recompose the existing overworld, dialogue, actions, pause panels, and combat handoff without changing Director, rules, or persistence contracts.
