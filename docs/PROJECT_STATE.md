# ChronAI Project State

- Last updated: 2026-07-13
- Current branch: `feature/presentation-playable-overworld`
- Current phase: Presentation 3 - Playable Overworld
- Current PR: Not open/unknown from local repository state
- Current milestone: Overworld 9/9 — combat handoff and final verification

## Vision

ChronAI is a solo tabletop RPG that should feel like a premium pixel-art game: the player explores a living adventure world, the AI Director narrates and proposes, the deterministic rules engine resolves mechanics, and Supabase preserves the campaign's durable truth.

## Architecture

- Adventure Controller: Orchestrates player actions through state loading, deterministic resolution, persistence, and narration without owning rules, prose, or storage.
- AI Director: Generates narration, suggestions, memory updates, and story framing from authoritative state and resolved outcomes, but never decides mechanics.
- Rules Engine: Resolves dice, checks, modifiers, conditions, combat, XP, HP, and outcomes deterministically.
- World State: Stores campaign facts such as locations, current location, NPCs, factions, quests, scheduled events, and Director-visible memory as data, not prose assumptions.
- Combat: Uses the engine for initiative, attacks, damage, death saves, XP, loot, and result summaries while UI panels present those resolved facts.
- Persistence: Supabase is the source of truth for users, characters, campaigns, sessions, turns, world state, Director documents, and RLS-backed ownership.
- Presentation Layer: React, Vite, Tailwind, pixel UI, and Zustand presentation state render real data and submit intent through existing controller actions.
- World Renderer: Shared pixel world surfaces and overworld components provide scene-first presentation while keeping map position and visuals as non-authoritative UI state.
- Audio: Manifest-driven music, ambience, and SFX read real context when available, fail silently when assets are absent, and respect player settings.

## Completed

- [x] Phase 0: Project scaffold, auth shell, Supabase client, routing, app shell, UI primitives, initial schema, tests, and core docs.
- [x] Phase 1.1: Deterministic dice, outcome, intent, and action resolver foundation.
- [x] Phase 1.2: Character engine with HP, ability modifiers, proficiency, levels, and serialization.
- [x] Phase 1.3: Conditions and campaign domain types with campaign/world JSONB persistence.
- [x] Phase 1.4: Supabase service layer for characters, campaigns, sessions, turns, and typed service errors.
- [x] Phase 1.5: Generated database types and real PostgreSQL integration testing.
- [x] Phase 1.6: Full modifier pipeline, skills, equipment, action validation, and automatic character action resolution.
- [x] Phase 1.7: Persistence cleanup for proficiencies, equipment, conditions, death saves, and character updates.
- [x] Phase 2.1: Character library, creation wizard, character sheet, autosave-ready primitives, and CRUD flows.
- [x] Phase 2.2: Campaign library, campaign wizard, detail page, session lifecycle, and campaign store.
- [x] Phase 2.3: Adventure Hub shell with panels, session loading, character sidebar, dice panel, and debug surface.
- [x] Phase 2.4: AI narration loop with streaming Edge Function, prompt builder, Director parsing, turn persistence, and suggested actions.
- [x] Phase 3: World dispatcher foundation and session summary panel.
- [x] Phase 5: Combat engine and JRPG battle panel over deterministic mechanics.
- [x] Phase 5.1: Combat persistence, XP, loot, post-combat HP, world updates, and level-up signaling.
- [x] Phase 6: Data-driven Living Atlas list/detail/search/hierarchy over real `WorldState.locations`.
- [x] Phase 7: Accessibility, route splitting, error boundaries, skeletons, onboarding polish, and shared utilities.
- [x] Phase 8: Roadmap consolidation, deployment docs, release checklist, and production readiness docs.
- [x] Phase 8.1: Production env flag gating, Vercel config, CI workflow, and `build:check`.
- [x] Phase 8.3: Interactive DM interface with `ActionBar`, quick actions, combat menus, and shared submit path.
- [x] Phase 9.0: Pixel UI foundation, fonts, borders, ambient overlay, audio framework, and asset slots.
- [x] Phase 9.1: Retro RPG integration across Adventure Hub, combat, character sheet, cards, landing page, Atlas, and Journal.
- [x] AI provider migration: Edge Function narration moved from Anthropic to OpenAI while preserving client streaming contract.
- [x] Phase 10.1: Character import architecture with honest manual-entry provider and shared CharacterWizard review path.
- [x] Phase 10.2: Campaign import architecture with honest manual-entry provider and shared CampaignWizard review path.
- [x] Phase 10.3/10.4: Director document upload, private storage metadata, client-side text extraction, full-text retrieval, and Director prompt integration.
- [x] Phase 10.5: Google Sign-In code path, callback handling, automatic profile provisioning, and local test coverage.
- [x] Phase 11 UI Redesign: Additive Adventure Hub layout with left nav, center scene, right sidebar, and real-data panels.
- [x] World presence / character presence: WorldRenderer, weather/time visual layers, and deterministic player sprite appearance work landed before overworld.
- [x] Playable Overworld 1-2/9: Typed overworld model and Monastery Courtyard fixture map.
- [x] Playable Overworld 3-4/9: Movement and camera viewport.
- [x] Playable Overworld 5/9: Interaction adapter boundary and Adventure Hub integration.
- [x] Playable Overworld 6/9: Dialogue mode over the existing Director/action pipeline.
- [x] Playable Overworld 7/9: Area transitions and Forest Path map.
- [x] Playable Overworld 8/9: Pause menu reusing existing panels over the overworld.

## Current Work

- Goal: Finish the playable overworld vertical slice while keeping it a presentation/input layer over the existing Adventure Controller, rules engine, combat, and persistence contracts.
- Main files: `src/components/adventure/AdventureHub.tsx`, `src/components/adventure/overworld/*`, `src/components/adventure/overworld/maps/*`, `tests/unit/Overworld*.test.tsx`, `tests/unit/overworld*.test.ts`, `src/app/routes/index.tsx`, and `src/app/pages/__LayoutPreviewPage.tsx`.
- Acceptance criteria: The World tab supports keyboard/controller-like movement, collision, interactions, dialogue, exits, encounter handoff to existing combat, pause-menu access, reduced-motion-safe transitions, and tests without inventing new state authority.
- Known issues: Local working tree currently has a dev-only preview route in `src/app/routes/index.tsx` and untracked `src/app/pages/__LayoutPreviewPage.tsx`; comments say this is temporary and must be removed before commit.
- What must not change: Do not modify Supabase migrations, Edge Functions, AI Director behavior, core engine behavior, or persistence contracts without explicit approval; do not make tile position durable game state; do not let overworld presentation bypass `actions.submitAction` or `actions.startCombat`.

## Next

1. Complete Overworld 9/9 and remove temporary manual-verification route/files before committing.
2. Run full verification for the branch: TypeScript, unit tests, production build check, browser verification, and reduced-motion check.
3. Update any player-facing docs only if the overworld behavior is intended to ship in this phase.
4. Open a PR for `feature/presentation-playable-overworld` after the working tree contains only intended changes.
5. Resume the public-alpha roadmap after overworld work: Director Intelligence, Living World foundation, Reputation/Legacy, Creator Tools, then Release Candidate hardening.

## Constraints

- The AI proposes; the rules engine resolves; the database remembers.
- Never fabricate game state or let AI prose decide mechanical outcomes.
- Preserve deterministic engine behavior and database-backed persistence.
- Presentation may read real state and submit intent, but it must not become a second game-state authority.
- Follow current architecture instead of introducing parallel patterns.
- Use existing service, controller, engine, prompt, UI, and panel contracts unless the task explicitly changes them.
- Do not modify migrations, Edge Functions, AI Director logic, or core engine logic without explicit approval.
- Add or update tests for user-facing behavior changes.
- Do not push directly to `main`; use one feature branch per phase and keep unrelated phases separate.
- No secrets in code, docs, commits, or bundles.

## Verification

- `npx tsc --noEmit`: Required before completion; not run in this documentation-only handoff update.
- `npx vitest run`: Required before completion; not run in this documentation-only handoff update.
- `npm run build:check`: Required before completion; not run in this documentation-only handoff update.
- Browser verification: Required for overworld/presentation changes, including desktop and mobile-sized viewports.
- Reduced-motion check: Required for animations, transitions, ambient effects, and overworld motion.
- Clean git status: Required before PR; currently not clean because overworld preview files are present.

## Session Handoff

- Completed: Inspected repository structure, current branch, git status, roadmap/docs, architecture docs, current overworld integration, and recent commit history; created this handoff document only.
- Remaining: Finish Overworld 9/9, remove temporary preview route/page, run verification, update docs if shipping behavior changed, commit, push, and open PR.
- Current git status: `src/app/routes/index.tsx` modified; `src/app/pages/__LayoutPreviewPage.tsx` untracked; `docs/PROJECT_STATE.md` newly added.
- Temporary files: `src/app/pages/__LayoutPreviewPage.tsx` appears temporary; `src/app/routes/index.tsx` contains a dev-only `/__preview/adventure` route marked for removal before commit.
- Next recommended task: Complete the final playable-overworld verification/removal pass, then run `npx tsc --noEmit`, `npx vitest run`, `npm run build:check`, browser verification, reduced-motion verification, and confirm a clean intended diff.
