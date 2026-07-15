# ChronAI Project State

- Last updated: 2026-07-14
- Current branch: `feature/presentation-unified-adventure-screen`
- Current milestone: Unified Adventure Screen (B1–B5) — complete, pending review/PR.
- Current roadmap position: `docs/ROADMAP.md` > Presentation > Unified Adventure Screen.
- Current PR: Not open yet.

## Recent Architectural Decisions

See `docs/DECISIONS.md` for the append-only rationale behind foundational decisions, including the AI/rules/database boundary, presentation ownership limits, WorldRenderer, overworld state, extending existing architecture instead of creating parallel systems, and the unified Adventure screen superseding the tabbed Story/World split.

## Active Work

The Unified Adventure Screen milestone recomposed the main play experience into one screen with three integrated layers, in five independently verified commits:

1. **B1 — Unified shell** (`26bcc3d`): Story and World tabs merged into a single Adventure surface; OverworldMode is the always-mounted primary view; Character, Dice, Journal, Quests, Atlas, Codex, Settings, and flagged Debug open through the existing pause overlay over the frozen world (bottom nav and Esc are two doors into the same overlay); combat still swaps the surface (Law 5) and disables overlay tabs.
2. **B2 — Story HUD** (`61b9809`): `StoryHud` generalizes DialogueWindow into the persistent bottom dock — NPC dialogue (locked) plus ambient story beats (movement free), turn-count watermarking so old turns never replay as fresh narration, ≤35% viewport, free-form input restored.
3. **B3 — Action Layer** (`a0ea223`): `ActionStrip` offers the faced entity's verbs, Rest, and Menu; verb clicks route through the same typed interact intents as the keyboard; button/input key events can no longer reach the world handler (no double submission). Talk opens locked NPC dialogue; Inspect/Collect/Enter remain ambient interactions.
4. **B4 — Overlay completion** (`80695e4`): every overlay verified over the frozen world with position preserved; bottom-nav tabs gained explicit `aria-label`s (they had no accessible name below `sm`).
5. **B5** — final integration walkthrough and this documentation pass.

No Adventure Controller, rules-engine, AI Director, persistence, world-tick, or Supabase contract changed. Superseded presentation components (`AdventureLeftNav`, `AdventureRightSidebar`, `StoryPanel`, `AdventureScenePanel`, `ActionBar`, `DialogueWindow`) are no longer rendered but remain in the tree pending an explicit cleanup decision.

Primary files in scope:
- `src/components/adventure/AdventureHub.tsx`
- `src/components/adventure/overworld/StoryHud.tsx`
- `src/components/adventure/overworld/ActionStrip.tsx`
- `src/components/adventure/overworld/{OverworldMode,OverworldScene,PauseMenu,InteractionLayer}.tsx`
- `tests/unit/{AdventureHub,StoryHud,OverworldActionStrip,OverworldDialogue,OverworldPauseMenu,AdventurePage,phase7Polish}.test.tsx`

## Remaining Work

1. Open a PR for `feature/presentation-unified-adventure-screen` when requested; do not merge automatically.
2. Decide the cleanup phase for the superseded components listed above (deletion needs explicit approval).
3. The old WorldStatusSidebar content (world time, discovered-location/NPC counts) has no surface on the unified screen — decide whether it becomes a pause-overlay tab in a later phase.
4. Overworld movement remains keyboard-only; touch controls are a future phase.

## Current Git Status

- `main` contains the merged Playable Overworld (PR #3).
- This branch adds the five unified-screen commits plus this documentation commit; the working tree is expected to be clean after this handoff update.
- No migration, Edge Function, AI Director, rules-engine, persistence, world-tick, or combat-resolution change is present.

## Known Temporary Files

- None. (An untracked `.claude/settings.json` permission file may appear locally from tooling; it is not part of the project.)

## Next Recommended Task

Review the unified-screen branch, open the PR, and after merge pick the next roadmap phase — Dialogue Cinematics builds directly on the new StoryHud, or the superseded-component cleanup can land first as a small hygiene phase.
