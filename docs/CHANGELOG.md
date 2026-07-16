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

## 2026-07-14 — Unified Adventure Screen

- Branch: `feature/presentation-unified-adventure-screen`
- Summary: Recomposed the main play experience into one unified screen — the playable world as the always-mounted primary surface, a persistent JRPG Story HUD (`StoryHud`, superseding DialogueWindow) docked at the bottom, and a contextual `ActionStrip` (faced-entity verbs, Rest, Menu) — with Character, Dice, Journal, Quests, Atlas, Codex, Settings, and flagged Debug opening through the existing pause overlay over the frozen world. Landed as five independently verified commits (B1 shell `26bcc3d`, B2 Story HUD `61b9809`, B3 Action Layer `a0ea223`, B4 overlay completion `80695e4`, B5 docs/final walkthrough `0450cd9`).
- Major architectural decisions: Story and World are one experience, not two tabs; the pause overlay is THE panel surface (bottom nav and Esc are two doors into it); ambient story beats are watermarked by turn count so history never replays as fresh narration; all intents still flow through the existing overworld adapter and `AdventureActions` — no controller/engine/Director/persistence change. Superseded components (AdventureLeftNav, AdventureRightSidebar, StoryPanel, AdventureScenePanel, ActionBar, DialogueWindow) are unrendered but retained pending a cleanup decision.
- Verification results: `npx tsc --noEmit` and `npm run build:check` pass at every commit; full Vitest counts grew from 2,221 (B1) to 2,241 (B2) to 2,248 (B3–B5). The implementation-review correction adds one focused regression for 2,249 passing tests. Authenticated browser walkthroughs at 1280×800 and 390×844 cover NPC dialogue, ambient non-talk interactions, all overlays, focus containment, reduced motion, and encounter → combat → exact-position return, with zero console errors.

## 2026-07-15 — Unified Adventure Screen Cleanup

- Branch: `feature/presentation-unified-screen-cleanup`
- Summary: Post-merge hygiene for the Unified Adventure Screen. Deleted the six superseded, unrendered presentation components (`AdventureLeftNav`, `AdventureRightSidebar`, `StoryPanel`, `AdventureScenePanel`, `ActionBar`, `DialogueWindow`), the test files exclusively covering them, and `AdventureHub`'s deprecated `AdventurePanel` alias (net −2,658 lines); refreshed `PROJECT_STATE.md` for the merged PR #4. A follow-up documentation correction (this entry's commit) updated README, KNOWN_LIMITATIONS, STYLE_GUIDE, the design doc, and remaining source/test comments so nothing describes the deleted components as present; historical references in DECISIONS, CHANGELOG, ROADMAP dependency lines, and provenance comments were deliberately retained.
- Major architectural decisions: None — presentation cleanup and documentation truth only; `StoryHud`, `ActionStrip`, `OverworldMode`, `PauseMenu`, and all controller/AI/rules/persistence/world-tick/combat/Supabase contracts untouched. One honest gap surfaced and documented: the exploration dice-check popup (`lastCheckResult`) lost its rendering surface with `StoryPanel` and awaits a unified-screen home; `AdventureWorldPreview` is now unreferenced and awaits its own decision.
- Verification results: `npx tsc --noEmit`, `npx vitest run` (2,132 tests, 100 files — the reduction from 2,249 is exactly the deleted components' own suites), and `npm run build:check` pass; repository-wide search confirms no runtime imports of the deleted components remain.

## 2026-07-15 — Unified Check Result Feedback

- Branch: `feature/presentation-check-result-feedback`
- Summary: Restored exploration dice transparency on the unified Adventure Screen. The new `CheckResultDock` (resurrecting the dice popup that lived inside the removed StoryPanel) renders the existing `lastCheckResult` engine summary — die face, modifier, total, DC, outcome, crit/fumble markers — as a compact dock beside the StoryHud, with the same `role="status"` spoken breakdown, the same 4200 ms auto-dismiss window, and a new keyboard-focusable manual dismiss, both through the existing `clearCheckResult` contract. Also refreshed the three post-PR-#5 stale PROJECT_STATE lines.
- Major architectural decisions: None — closes the Constitution Law 6 gap the unified-screen cleanup surfaced, presentation only; engine, Director, persistence, world tick, combat, Supabase, and the ResolutionSummary shape untouched; no second dice-resolution path.
- Verification results: `npx tsc --noEmit`, `npx vitest run` (2,142 tests, 101 files — 10 new), and `npm run build:check` pass; authenticated browser checks at 1280×800 and 390×844 with a real checked action, reduced motion, and zero console errors.

## 2026-07-15 — Dialogue Cinematics v1

- Branch: `feature/presentation-dialogue-cinematics`
- Summary: Cinematic dialogue on the unified Adventure Screen in three commits — B1 speaker presentation (`SpeakerPortrait`: asset-ready slot probing `npc-<id>.png`, falling back to the fixture entity's real glyph, a deterministic warm-hued initial tile keyed by stable identity, or a generic silhouette; StoryHud frames the speaker with the NpcName primitive; ambient mode is the explicit voiceless narrator), B2 transitions (stepped `dialogue-portrait-in` and `dialogue-advance-in` keyframes, ≤200 ms, kill-listed for reduced motion in the same commit, streaming tokens never replay the animation), and B3 player-adjustable text speed (persisted `uiSettingsStore`, four speeds with `normal` = the previous fixed 18 ms/char, `TextSettingsPanel` beside the audio settings in the pause overlay; reduced motion still always renders instantly).
- Major architectural decisions: Portrait identity derives ONLY from existing data — fixture entity id/glyph or a read-only npcMemory name match — with a generic fallback for unknown speakers; no fabricated identity, no binary assets (art lands later through the asset slot with zero code changes). Talk-locks-only, ambient interactions, choices, free input, and the single submitAction pipeline are unchanged; no engine/Director/rules/persistence/world-tick/combat/Supabase change.
- Verification results: `npx tsc --noEmit`, `npx vitest run` (2,165 tests, 104 files — 23 new across the three commits), and `npm run build:check` pass per commit; authenticated browser walkthroughs at 1280×800 and 390×844 (glyph portrait + framed name for Brother Aldwin, narrator mode portrait-free, settings control keyboard-operated, choice persisted across reload, dialogue HUD ≈38% of the 844 px viewport at its largest — three suggested actions showing, overflow scrollable within the HUD) and reduced motion (portrait and beat report `animation-name: none`, full text renders at once), with zero console errors.
