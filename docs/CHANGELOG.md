# ChronAI Changelog

This is the append-only historical record for completed phases and milestones. Do not remove previous entries. Keep current status in `docs/PROJECT_STATE.md`.

## 2026-07-13 — Canonical Game Design Document

- Branch: `feature/presentation-playable-overworld`
- Summary: Added `docs/GAME_DESIGN.md` as the canonical gameplay design reference for what kind of RPG Chronicle AI is building.
- Major architectural decisions: Gameplay design now has its own source of truth, separate from architecture, UI vision, roadmap, project state, and changelog.
- Verification results: Documentation-only change. Full TypeScript/test/build verification not run.

## 2026-07-13 — Roadmap Reset As Future Build Order

- Branch: `feature/presentation-playable-overworld`
- Summary: Reworked `docs/ROADMAP.md` from a phase-history ledger into the master long-term implementation roadmap, with completed milestones retained as complete and future milestones kept concise.
- Major architectural decisions: `ROADMAP.md` now owns future build order; `PROJECT_STATE.md` references the current roadmap position; `CHANGELOG.md` remains the historical record for completed milestones.
- Verification results: Documentation-only change. Full TypeScript/test/build verification not run.

## 2026-07-13 — Project Continuity Documents

- Branch: `feature/presentation-playable-overworld`
- Summary: Established permanent continuity documents so a fresh AI session can resume the project from repository files instead of chat history.
- Major architectural decisions: `PROJECT_STATE.md` is the living snapshot; `CHANGELOG.md` is append-only history; `ARCHITECTURE.md` is the living system map; `UI_VISION.md` remains design philosophy; `AGENTS.md` and `CODEX.md` define operating discipline.
- Verification results: Documentation-only change. Inspected branch, status, recent commits, existing docs, and architecture references. Full TypeScript/test/build verification not run.

## 2026-07-13 — Historical Baseline Through Overworld 8/9

- Branch: `feature/presentation-playable-overworld` for current/recent overworld work; older phase branch names are not recoverable from local state.
- Summary: ChronAI has shipped the deterministic engine, persistence layer, character/campaign flows, AI narration, combat, Atlas, pixel presentation, import/document pipelines, Google auth code path, Adventure Hub redesign, world/character presence work, and playable overworld milestones through pause menu.
- Major architectural decisions: The project is governed by "AI proposes, rules engine resolves, database remembers"; presentation can read real state but cannot become a second authority; the overworld is a UI/input layer over existing `AdventureActions`; combat and narration continue through existing engine/controller/Director contracts.
- Verification results: Historical verification remains available in git history and related phase docs. Verification was not rerun while creating this baseline entry.

## 2026-07-13 — Playable Overworld 9/9 and Unified Adventure Screen Review

- Branch: `feature/presentation-playable-overworld`
- Summary: Completed the encounter-to-existing-combat handoff and verified return to the current overworld area; reviewed the unified World, Story, and Action layers; retained normal Tab navigation; added pause-menu focus management and mobile stacking; bounded the dialogue HUD so the world remains visible; removed stale test/document assumptions.
- Major architectural decisions: No new architecture was introduced. Overworld area remains local presentation state, interactions/exits still use `submitAction`, encounters still use `startCombat`, existing pause panels are reused, and combat continues through the existing engine/controller contract. No Supabase, AI Director, rules, persistence, world-tick, or combat-resolution contract changed.
- Verification results: `npx tsc --noEmit` passed; `npx vitest run` passed 2,243 tests across 102 files (with the documented benign Mammoth/jsdom warnings); `npm run build:check` passed. Responsive and reduced-motion behavior are covered by implementation review and focused tests; no repository preview route remained for a fresh manual browser pass.

## 2026-07-13 — Playable Overworld 9/9 Final Browser Verification

- Branch: `feature/presentation-playable-overworld`
- Summary: Completed the authenticated protected-route walkthrough at desktop width and 390×844. Verified movement and collision, NPC dialogue and dialogue overflow, Escape behavior, standard Tab events remaining unclaimed by the overworld, pause-menu initial focus and focus trap, reduced motion, the forest encounter handoff into existing combat, return to the forest spawn with movement restored, and zero browser console errors.
- Scope clarification: Playable Overworld 9/9 retains separate Story and World tabs in `AdventureHub`. The unified Adventure Screen recomposition is the next milestone and was not implemented here.
- Major architectural decisions: None. The browser pass exercised existing presentation, controller, Director, persistence, and combat paths without changing their contracts or adding preview routes, test-only pages, features, or persistence code.
- Verification results: Authenticated browser walkthrough passed in Chrome against `/adventure/e62ea105-4612-4721-ba18-052e387d4f96`; `npx tsc --noEmit` passed; `npx vitest run` passed 2,243 tests across 102 files with the documented benign Mammoth/jsdom warnings; `npm run build:check` passed.

## 2026-07-13 — Exact-Position Combat Return Correction

- Branch: `feature/presentation-playable-overworld`
- Summary: Corrected the final Overworld 9/9 handoff so combat returns to the exact encounter tile and facing rather than the area's spawn. The active encounter zone is retained locally across the combat remount, preventing an immediate combat retrigger; leaving and re-entering the fixture trigger still rearms it as designed.
- Major architectural decisions: Tile, facing, and active-zone state remain local presentation state lifted through the existing `AdventureHub` overworld area. No durable state, Supabase, controller, AI Director, rules, world-tick, or combat-resolution contract changed.
- Verification results: `npx tsc --noEmit` passed; focused overworld tests passed 80/80; `npx vitest run` passed 2,243 tests across 102 files with the documented benign Mammoth/jsdom warnings; `npm run build:check` passed; the authenticated Chrome walkthrough passed again at desktop and 390×844 with exact-tile return, no immediate retrigger, restored movement, reduced motion, focus behavior, dialogue overflow, and zero console errors.

## 2026-07-13 — Mammoth DOCX CI Rejection Correction

- Branch: `feature/presentation-playable-overworld`
- Summary: Aligned Vitest's Mammoth resolution with the browser bundle used by the application. Corrupt DOCX input now completes through the parser's graceful unavailable result without an unhandled rejection, while the real DOCX fixture is extracted end to end and asserted as high-confidence text.
- Major architectural decisions: None. This is a test-environment module-resolution correction; production document parsing behavior and AI, rules, persistence, world-tick, and combat contracts are unchanged.
- Verification results: focused parser tests passed 18/18 without unhandled errors; `npx vitest run` passed all 2,243 tests across 102 files with exit code 0; `npx tsc --noEmit` passed; `npm run build:check` passed.
