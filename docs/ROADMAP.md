# Chronicle AI — Development Roadmap

---

## Phase 0 — Technical Foundation ✅
*Goal: A deployable, auth-ready app shell with zero game logic debt.*

- [x] Vite + React + TypeScript + Tailwind project scaffold
- [x] Full folder architecture (src/app, components, lib, types, supabase)
- [x] Supabase client configured with typed Database interface
- [x] Auth service (signIn, signUp, signOut, session listener)
- [x] Zustand auth store with initialize() on boot
- [x] React Router v6 with ProtectedRoute + PublicRoute guards
- [x] Landing, Login, Signup, Dashboard, 404 pages
- [x] AppShell layout component
- [x] Design system tokens (colors, typography, spacing, shadows)
- [x] Button, Input, LoadingSpinner UI components
- [x] Supabase initial migration (profiles, campaigns, sessions, turns + RLS)
- [x] Edge Function stub (narrate)
- [x] Vitest setup + unit tests
- [x] .env.example with all required variables
- [x] ESLint + Prettier configuration
- [x] All 5 required docs created

---

## Phase 1 — Resolution Engine ✅
*Goal: A fully tested, deterministic game logic core. No AI yet. No backend calls.*

### Phase 1.1 — Dice + Resolver ✅
- [x] `src/lib/engine/dice.ts` — all 7 die types, notation parser, seeded RNG, advantage/disadvantage
- [x] `src/lib/engine/outcome.ts` — 5-tier Outcome enum, margin evaluator, critical override logic
- [x] `src/lib/engine/intent.ts` — action text → ActionIntent, keyword classifier, stat modifier
- [x] `src/lib/engine/resolveAction.ts` — full pipeline orchestrator
- [x] 56 dice tests, 34 outcome tests, 64 intent tests, 33 resolver tests — 201 total

### Phase 1.2 — Character Engine ✅
- [x] `src/lib/engine/character.ts` — CharacterSheet type, HP formula, factory, serialisation
- [x] `getAbilityModifier`, `getProficiencyBonus`, `calculateMaxHp`, `buildCharacter`, `summarizeCharacter`
- [x] Levels 1–20, ability scores 1–20, proficiency bonus table, hit die by archetype
- [x] Comprehensive unit tests (character.test.ts)

### Phase 1.3 — Conditions + Campaign Data ✅
- [x] `src/lib/engine/conditions.ts` — 15 condition types, modifier table, apply/remove/stack/expire/concentration
- [x] `src/types/campaign.ts` — DirectorConfig, WorldState, NPC/faction/event domain types
- [x] `supabase/migrations/0002_characters.sql` — characters table, FK to profiles, full stat block, RLS
- [x] `supabase/migrations/0003_campaign_data.sql` — director_config + world_state JSONB on campaigns, mode tracking on sessions/turns

### Phase 1.4 — Supabase Service Layer ✅
- [x] `src/lib/supabase/characters.ts` — full CRUD, engine-validated writes, safe condition parsing
- [x] `src/lib/supabase/campaigns.ts` — full CRUD, merge-semantics world state and director config updates
- [x] `src/lib/supabase/sessions.ts` — session lifecycle, turn append/fetch in chronological order
- [x] `src/lib/supabase/errors.ts` — typed `ServiceError` with Postgres error code mapping
- [x] 95 service-layer unit tests with per-file Supabase mocks

### Phase 1.5 — Generated Types + Integration Testing ✅
- [x] Migrations 0001–0003 applied and verified idempotent against real local PostgreSQL
- [x] `src/types/supabase-generated.ts` — Database types reflecting the genuine, migrated schema
- [x] `src/lib/supabase/client.ts` updated to the generated `Database` type
- [x] `tests/integration/supabase.integration.test.ts` — 14 tests against real Postgres, including RLS ownership enforcement
- [x] `npm run test:integration`, `npm run db:test:setup`, `npm run db:types` scripts

**Exit criteria for Phase 1**: ✅ Met. Player can build a character, create a campaign, open a session, type an action, and see a deterministic dice roll result with correct character modifiers applied — and the entire data layer is verified against a real, migrated PostgreSQL database with RLS enforced.

---

## Phase 1.6 — Gameplay Engine Completion ✅
*Goal: Close the loop between character data and the dice resolver — future systems only provide the character and intent.*

- [x] `src/lib/engine/skills.ts` — standard 18-skill table, skill → ability mapping
- [x] `src/lib/engine/equipment.ts` — flat-bonus equipment contract (attack/armor/skill/save/passive), magical effects out of scope
- [x] `src/lib/engine/pipeline.ts` — 8-stage deterministic modifier pipeline, every stage independently exported and tested
- [x] `src/lib/engine/actionValidation.ts` — `canPerformAction()` pure gate (dead/unconscious/paralyzed/petrified/stunned/incapacitated + resource-gate hooks)
- [x] `CharacterSheet` extended additively: `skillProficiencies`, `savingThrowProficiencies`, `equipment`, `conditions` — zero breaking changes to existing callers
- [x] `resolveCharacterAction()` in `resolveAction.ts` — the full automatic-derivation entry point; `resolveAction()`/`resolveCheck()` unchanged
- [x] `formatBreakdown()` — human-readable transparency output for future Debug Panels
- [x] 308 new tests (skills, equipment, pipeline, actionValidation, resolveCharacterAction) — 702 total, up from 542
- [x] Conditions automatically wired into the resolver — no caller manually applies condition effects (closes the Phase 1.6 roadmap item from the previous entry)

**Exit criteria**: ✅ Met. `resolveCharacterAction({ character, skill, intent, dc })` derives every modifier automatically — ability, proficiency, equipment, conditions, advantage/disadvantage — with zero manual calculation by the caller, and exposes a full transparent breakdown of every contributing stage.

---

## Phase 1.7 — Persistence Cleanup ✅
*Goal: Close the persistence gaps surfaced during Phase 1.6.*

- [x] `supabase/migrations/0004_proficiencies_equipment.sql` — adds `skill_proficiencies`, `saving_throw_proficiencies`, `equipment` JSONB columns to `characters`, idempotent, verified against real Postgres (fresh DB + re-run)
- [x] `src/lib/supabase/characters.ts` — full read/write wiring for the three new columns, with defensive parse helpers (`parseSkillProficienciesFromDb`, `parseSavingThrowProficienciesFromDb`, `parseEquipmentFromDb`) mirroring `parseConditionsFromDb`'s drop-malformed-entries philosophy
- [x] `deathSaveSuccesses`/`deathSaveFailures` promoted onto `CharacterSheet` directly, validated in `buildCharacter()` (0–3 range), hydrated from the DB in `rowToCharacterRecord()`
- [x] `actionValidation.ts`'s `isDead()` extended additively — 3 death save failures now also triggers death, alongside the existing HP-threshold check, matching the documented rule in `CHRONICLE_GAME_LOOP.md`
- [x] `src/types/supabase-generated.ts` and `src/types/database.ts` updated to match the live schema exactly (verified field-by-field via `information_schema`)
- [x] 60 new tests: 17 character engine (death save validation/defaults), 4 action validation (death-via-saves), 39 service-layer (12 unit-mock persistence + 8 real-Postgres integration, plus updated fixtures) — 742 unit tests total, up from 702; 22 integration tests, up from 14

**Bonus fix found during this phase**: `sheetToInsertRow()` was writing `conditions: toJson([])` unconditionally on character creation — a latent bug where any starting conditions passed via `buildCharacter()`'s `conditions` input were silently dropped before ever reaching the database. Fixed to write `sheet.conditions` directly.

**Deferred** (named in the original Phase 1.7 roadmap entry, not in this prompt's scope): concentration-breaking on damage (CON save vs DC 10 or half damage) — depends on a damage-resolution path that doesn't exist until Phase 5's combat engine. Spell slots and ammunition tracking remain validator hooks only (`actionValidation.ts` conservatively blocks leveled spellcasting and ammo-dependent ranged attacks until real resource data exists) — these are genuinely Volume II / Phase 5 scope, not gaps in Volume I's foundation.

**Exit criteria**: ✅ Met. A character's skill proficiencies, saving throw proficiencies, equipment, and death save state now survive a full create → store → fetch round trip against real PostgreSQL, with RLS enforced and CHECK constraints verified.

---

## Phase 2.1 — Character Creator UI ✅
*Goal: A complete character management experience on top of the deterministic engine and persistence layer.*

**Note on numbering**: this milestone was introduced mid-stream as "Volume II — Phase 2.1," ahead of the AI Narration work originally slated as "Phase 2" below. The two don't conflict in scope — this phase is UI/persistence only, no AI — but the numbering now runs Phase 2.1 before Phase 2. Left as-is rather than silently renumbered, since the original "Phase 2 — AI Narration" section still accurately describes unstarted work. Future phases should treat "Phase 2.1" as this UI milestone and "Phase 2" as AI Narration, whichever is tackled next.

- [x] `src/components/character/` — full character domain: wizard, sheet, library, 9 wizard steps, 10 sheet tabs
- [x] Character Library (`/characters`) — list, live search, duplicate, delete-with-confirm, create-new
- [x] Character Creation Wizard (`/characters/new`) — Identity → Species → Class → Background → Ability Scores → Skills → Equipment → Portrait → Review, with live engine-derived stat previews at every step
- [x] Character Sheet (`/characters/:id`) — Roll20-style 10-tab layout (Overview, Abilities, Skills, Saves, Inventory, Equipment, Spells, Features, Conditions, Notes), full ARIA tablist + keyboard nav, debounced autosave
- [x] `src/lib/supabase/characters.ts` — `duplicateCharacter()` added; `conditions` made patchable via `updateCharacter()` (previously create-only — no way to apply/remove a condition after character creation)
- [x] `supabase/migrations/0005_portrait_bio.sql` — `portrait_url` and `bio` columns, idempotent, verified against real Postgres
- [x] New UI primitives: `Select`, `Textarea`, `Badge`, `Tabs`/`TabPanel` (full ARIA pattern), `ConfirmDialog`
- [x] Zero duplicated validation — every wizard/sheet check calls an engine validator directly (`isValidAbilityScore`, `validateAbilityScores`, `isValidSkillId`, `validateEquipmentItem`, `buildCharacter()`)
- [x] 105 new unit tests (UI primitives, `useCharacterDraft` hook, wizard navigation/submission, library list/search/delete/duplicate) + 7 new integration tests against real Postgres

**Bug fixed during this phase**: `updateCharacter()` previously merged a *partial* ability-score patch against hardcoded defaults (10/10/10/10/10/10, level 1, archetype 'adventurer') instead of the character's actual current values — meaning any single-stat edit silently corrupted the other five scores, level, and class. Fixed by fetching the current record before recalculating; verified by deliberately reverting the fix, confirming the integration test fails exactly as predicted, then restoring it. A second gap — `conditions` had no update path at all after character creation — was also closed.

**Exit criteria**: ✅ Met. Create, edit, duplicate, delete, and view characters all work end-to-end; every engine-derived stat (modifiers, HP, AC, skill/save totals) updates live by calling the engine directly; build passes; 862 unit + 29 integration tests pass; no AI or combat functionality introduced.

---

## Phase 2.2 — Campaign Creator UI ✅
*Goal: Campaign library, 8-step creation wizard, detail page, and session lifecycle management.*

- [x] `src/components/campaign/` — campaign domain: 8-step wizard, card, step shell, content constants
- [x] Campaign Library (`/campaigns`) — list, search by title/tone/difficulty, delete-with-confirm, create-new entry point
- [x] Campaign Creation Wizard (`/campaigns/new`) — Title → Premise → Tone → Difficulty → Rules Style → Character → Director → Review; submits via `createCampaign()`
- [x] Campaign Detail (`/campaigns/:id`) — campaign summary, inline title/description editing, character link, session CTA
- [x] Session Loop Foundation (`/campaigns/:id/session`) — full state machine (loading → ready\_to\_start → active → paused/ended); start, pause, resume, end session; turn history placeholder; session state preserved via `getResumableSession()` server-side on refresh
- [x] `src/lib/supabase/sessions.ts` — `pauseSession()`, `resumeSession()`, `getResumableSession()` added (previously only `startSession`/`endSession` existed; paused sessions were unreachable)
- [x] `src/types/campaign.ts` — `RulesStyle` type + `DirectorConfig.rulesStyle` field added (presentational only, never affects engine mechanics)
- [x] `src/store/campaignStore.ts` — new Zustand store mirroring `characterStore` pattern
- [x] 55 new unit tests across 4 new test files; 0 regressions against 928 existing tests

**Known gaps deferred to Phase 2.3**: character reassignment UI on the Campaign Detail page (the service-layer `updateCampaign({ characterId })` call already supports this; the UI doesn't expose it yet); session integration tests against real Postgres; chunk-size code splitting.

**Exit criteria**: ✅ Met. Create campaign, assign character, open detail, start/resume/end session, refresh preserves session state; 976 unit tests pass; build passes; no AI functionality.

---

## Phase 2.3 — Adventure Hub Shell ✅
*Goal: Permanent in-game UI shell that all future gameplay features plug into.*

- [x] `/adventure/:campaignId` — dedicated route with no AppShell wrapper; game shell IS the UI chrome
- [x] `useAdventureSession` hook — load campaign + character + session, pause/resume/end actions, state machine (`loading | ready | no_character | error`)
- [x] `AdventureHub` — fixed full-viewport layout: status bar, panel area, always-visible character sidebar (desktop), always-visible tab nav (Law 1)
- [x] `CharacterSidebar` — engine-derived values only: HP bar with colour-coded ratio, all 6 ability modifiers, proficiency bonus, passive Perception/Investigation/Insight, active conditions, equipped items, link to full sheet
- [x] `DicePanel` — real dice engine (`rollDie`, `rollD20`, `ALL_DICE`); mode (normal/advantage/disadvantage), flat modifier, DC quick-set buttons, roll history (20 entries) with outcome tier display
- [x] `StoryPanel` — explicit Phase 2 AI narration placeholder + turn history renderer (ready for streamed narration)
- [x] `DebugPanel` — live JSON dump of all game state (campaign, session, character sheet, recent turns, load status); purpose-built for Phase 2.4 AI integration
- [x] `JournalPanel`, `QuestsPanel`, `AtlasPanel`, `CodexPanel` — placeholder panels with honest phase attribution; layout slots reserved
- [x] Campaign Detail "Begin/Continue/Resume Adventure" routes to `/adventure/:id`
- [x] Session state preserved on refresh via `getResumableSession()` — no client-side store dependency
- [x] 77 new unit tests across 4 new test files (AdventureHub, CharacterSidebar, DicePanel, AdventurePage); 0 regressions

**Exit criteria**: ✅ Met. Adventure Hub renders with live engine-derived stats; dice panel uses real engine; session loads, persists across refresh, and supports pause/resume/end; 1053 unit tests pass; 59 integration tests pass; build passes; no AI functionality.

---

## Phase 2.4 — AI Narration Foundation ✅
*Goal: Full turn loop with real Anthropic streaming narration — player action → dice → Director narration → persisted to DB.*

- [x] `src/lib/ai/promptBuilder.ts` — `buildNarrateRequest()` constructs typed `NarrateRequest` from session/campaign/character/turns; `summarizeCharacter()` used for compact character payload
- [x] `src/lib/ai/director.ts` — `parseDirectorResponse()` sanitizes narration (4000 char cap), actions (4 max, 120 char each), coerces `combatTriggered` signal (logged, deferred to Phase 5), logs `mapUpdate` signal (deferred to Phase 6); `buildFallbackNarration()` for graceful error display
- [x] `src/lib/ai/narrator.ts` — `callNarrate()` (non-streaming) and `callNarrateStreaming()` (SSE with `AbortController`); handles both streaming and JSON fallback responses; JWT auth via `supabase.auth.getSession()`
- [x] `supabase/functions/narrate/index.ts` — full Edge Function: JWT validation, session/campaign ownership check, system + user prompt builder, `claude-sonnet-4-6` streaming call, turn persistence to `narrative_turns`, session `turn_number` increment, both streaming (SSE) and non-streaming response modes, rate-limit and error handling
- [x] `useAdventureSession` — `submitAction(input)` wires full turn loop; `narrationStatus`, `streamingText`, `suggestedActions`, `lastDirectorResult` added to state; `cancelStream()` aborts in-flight SSE stream
- [x] `StoryPanel` — action input bar (Enter/Shift+Enter), streaming text display with cursor animation, loading dots, suggested action chips, cancel-stream control; session status gates input
- [x] 54 new unit tests across 3 new test files (promptBuilder: 14, director: 18, StoryPanel: 22); 0 regressions

**Phase constraints honored**: No combat transition (signal logged). No map updates (signal logged). `combatTriggered: true` is parsed and surfaced but the battle screen doesn't exist yet — Phase 5 wires the transition.

**Exit criteria**: ✅ Met. Full AI narration loop implemented; streaming works end-to-end; turns persist to DB; 1107 unit tests pass; 59 integration tests pass; build passes.

---

## Phase 3 — Campaign Loop (Partial) ✅
*Completed items: Living World dispatcher, Session Summary panel. Remaining: campaign dashboard (already in Phase 2.2), session post-summary route (Phase 7 polish).*

- [x] `src/lib/engine/worldDispatcher.ts` — `applyWorldStateUpdate()` applies Director `worldStateUpdates` to `WorldState` purely/functionally (locations, NPCs, world time); `hasWorldStateChanges()` guards unnecessary DB writes
- [x] `SessionSummaryPanel` (`src/components/adventure/panels/SessionSummaryPanel.tsx`) — turn count, session duration, recent story beats, XP earned display
- [x] `JournalPanel` updated to render `SessionSummaryPanel` when session data is available
- [x] 10 worldDispatcher unit tests

**Remaining Phase 3 items** (deferred): Full Living World dispatcher wired to DB persistence on every turn; campaign-level NPC tracking; scheduled world events; post-session summary route.

---

## Phase 5 — Combat Presentation ✅
*Goal: JRPG battle screen over D&D mechanics.*

- [x] `src/lib/engine/combat.ts` — initiative roller (`rollInitiative`, `buildInitiativeOrder`), attack resolution (`resolvePlayerAttack`, `resolveEnemyAttack`), death saves (`rollDeathSave`), concentration saves (`rollConcentrationSave`), combat state machine (`initCombat`, `advanceTurn`, `allEnemiesDefeated`, `calculateXp`)
- [x] Combat exports added to engine barrel `index.ts`
- [x] `CombatPanel` (`src/components/adventure/panels/CombatPanel.tsx`) — full Battle Screen: initiative tracker with round counter, enemy cards with HP bars + targeting, player HP/AC display, action menu (Attack/Defend/Flee), death save tracker (3 success/failure pips), expandable combat log, victory/escape/fallen summary
- [x] `AdventureHub` — `CombatPanel` replaces panel area when `combatState` is non-null; tabs remain visible; `combatTriggered` from Director auto-enters combat
- [x] `useAdventureSession` — `combatState`, `startCombat()`, `endCombat()` added; Director `combatTriggered` signal auto-initialises combat state
- [x] 27 combat engine unit tests (`combat.test.ts`); 15 `CombatPanel` component tests

**Phase 5 stretch items deferred**: Spell slots, weapon proficiency per weapon, Flee contested roll, condition application from combat hits, post-combat XP award persistence to DB.

**Exit criteria**: ✅ Met. Full combat encounter playable — initiative to resolution — with D&D mechanics underneath; 1159 unit tests pass; 59 integration tests pass; build clean.

---

## Phase 5.1 — Combat Persistence & Rewards ✅
*Goal: Close the combat loop — outcomes persist, XP and loot land on the character, world state reflects the battle.*

- [x] `XP_THRESHOLDS` (20-level table), `getXpForNextLevel`, `isReadyToLevel` added to `combat.ts`
- [x] `LootItem` type + `parseLootFromDirector` — safe parse from Director `worldStateUpdates.loot`; caps, sanitises, dedupes
- [x] `parseEnemiesFromDirector` — replaces placeholder empty array; safe parse with per-field fallbacks (invalid `damageDie` → d6, HP/attack clamping, 8-enemy cap)
- [x] `CombatOutcome` type (`'victory' | 'defeat' | 'fled'`), `CombatResult` interface, `buildCombatResult`, `summariseCombatResult` — pure, testable outcome assembly
- [x] `commitCombatResult` in `useAdventureSession` — parallel persistence: `updateCharacter` (XP + post-combat HP + loot appended to inventory), `appendTurn` (mode `'combat'` summary turn), `updateWorldState` (defeated enemies marked `isAlive: false` via worldDispatcher), in-memory state sync
- [x] `CombatPanel` — `onCombatEnd` now receives typed `CombatResult`; loot displayed in summary screen; `worldStateUpdates` prop for loot extraction
- [x] `AdventureHub` — level-up banner when `readyToLevel` is set; passes `worldStateUpdates` to `CombatPanel`; calls `commitCombatResult`
- [x] `SessionSummaryPanel` — shows last combat result (outcome, enemies defeated, XP, loot) and level-up notice
- [x] 46 new unit tests (`combatPersistence.test.ts`); 11 new integration tests (`combatPersistence.integration.test.ts`)

**Exit criteria**: ✅ Met. 1205 unit tests pass; 70 integration tests pass; build clean; TypeScript 0 errors.

---


## ~~Phase 2 — Phase 5 (original outline)~~ → Superseded

> **Note — roadmap reconciliation (Phase 8)**: The sections below were the original Phase 2–5 outlines written at project inception. All items have since been delivered under the numbered phases above (2.1–2.4, 3, 5, 5.1, 6). The original outlines are removed here to avoid confusion. See the ✅-marked phases above for the actual delivery records.


## Phase 6 — Living Atlas / Token Map System
*Goal: A persistent, player-evolving map that the AI cannot redraw.*

- [x] `AtlasPanel` — full location list/detail UI driven by `WorldState.locations`
- [x] Hierarchical location tree (parentId ancestry, breadcrumb nav, child location list)
- [x] Search: filters by name, description, or type label; case-insensitive; clear button
- [x] Type filters: pill group (region, outdoor, town, dungeon, building, floor, room) with composable search
- [x] Breadcrumb navigation: `<nav aria-label="Location breadcrumb">` with `aria-current=page` on current; ancestor crumbs are keyboard-navigable buttons
- [x] Detail panel: heading, description, Director property chips, NPC list with alive/deceased, sub-locations
- [x] Empty state: flavour text; hints at undiscovered count if locations exist but none discovered
- [x] Responsive layout: all panels `flex flex-col h-full overflow-hidden`; scrollable body; sticky header
- [x] Keyboard accessibility: every interactive element is a `<button>` or `<input>`; filter pills use `aria-pressed`; ARIA region/section/navigation/list landmarks throughout; child locations are navigable buttons; detail heading auto-focuses on navigation
- [x] 71 unit tests covering all of the above

**Not implemented (explicitly out of scope for this phase)**: fog of war, canvas rendering, map tile grid, pan/zoom, image upload, token system, DM/player layers, Director ↔ map API beyond existing `worldDispatcher`.

**Exit criteria**: ✅ Met. 1276 unit tests pass; TypeScript 0 errors; build clean; no new persistence or architecture.

---

## Phase 7 — Polish & Launch ✅
*Goal: Production-ready. Performant. Accessible. Beautiful.*

- [x] **Accessibility (WCAG 2.1 AA)**
  - Skip link (`<a href="#main-content" class="skip-link">`) in `AppShell` — WCAG 2.4.1 bypass block
  - `id="main-content"` on the main content wrapper — skip link target
  - Global `@media (prefers-reduced-motion: reduce)` block in `globals.css` — zero-duration animations for all elements — WCAG 2.3.3
  - `LoadingSpinner` reduced-motion fallback: spinning SVG hidden via `motion-reduce:hidden`; static dot shown via `motion-reduce:block`
  - `ConfirmDialog` full focus trap: Tab/Shift+Tab cycle within dialog; body scroll locked while open; `role=alertdialog aria-modal=true` — WCAG 2.1.2
  - Touch targets: AdventureHub tab nav `min-h-[44px]`; CombatPanel action buttons `min-h-[44px]` — WCAG 2.5.5
  - Safe-area bottom padding on AdventureHub tab nav (iOS notch)
  - `AriaHidden` separators and decorative elements throughout

- [x] **Performance — route code splitting**
  - All page-level routes converted to `React.lazy()` + `Suspense` in `routes/index.tsx`
  - `lazyPage()` helper wraps each lazy import with `ErrorBoundary` + `Suspense`
  - Each route is now an independent Vite dynamic chunk

- [x] **Error handling**
  - `ErrorBoundary` class component (`src/components/layout/ErrorBoundary.tsx`) — `getDerivedStateFromError`, `componentDidCatch`, retry via `handleRetry`, optional `context` prop and custom `fallback` prop
  - Every lazy-loaded route wrapped in `ErrorBoundary`
  - Recovery UI: "Try Again" button + "Go Home" link with Chronicle design system styling

- [x] **Loading skeletons**
  - `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonGrid` components in `src/components/ui/Skeleton.tsx`
  - `CampaignLibraryPage` and `CharacterLibraryPage` use `SkeletonGrid` instead of full-screen spinner
  - `SkeletonGrid` has `role=status aria-busy=true` and SR-only "Loading…" text

- [x] **Onboarding**
  - `LandingPage` updated: "Phase 0 Foundation Build" label removed; feature value props added (D&D Mechanics, AI Director, Solo Adventure)
  - `aria-hidden` on decorative separators

- [x] **Shared utilities**
  - `src/lib/cn.ts` — shared `cn()` (clsx + tailwind-merge) instead of per-file copies

- [x] **Global CSS improvements**
  - iOS safe-area inset on `html` element (`env(safe-area-inset-*`)
  - `overscroll-behavior: none` on body (prevents iOS rubber-band white flash)
  - `.skip-link`, `.touch-target`, `.safe-area-bottom` utility classes
  - Focus ring spec updated with `ring-offset-void-950`

- [x] **Tests added**: 49 test files, 1323 unit tests total (+47 new Phase 7 tests across 5 new files)

**Exit criteria**: ✅ 1323 unit tests pass; 70 integration tests pass; TypeScript 0 errors; production build clean.

---

## Phase 8 — Roadmap Consolidation & Production Readiness ✅
*Goal: Documentation reflects reality. Launch readiness defined. No code changes.*

- [x] ROADMAP.md reconciled — duplicate Phase 2–5 original-outline sections removed; historical note added
- [x] `docs/RELEASE_CHECKLIST.md` created — 10-section pre-launch verification checklist (code quality, env vars, Supabase config, security, performance, accessibility, monitoring, legal, smoke test, rollback)
- [x] `docs/DEPLOYMENT.md` created — full deployment guide (Supabase setup, Vercel/Netlify/Cloudflare Pages, env variable reference, migration reference, monitoring, CI/CD skeleton)
- [x] MVP checklist defined (see below)
- [x] CHRONICLE_GAME_LOOP.md phase tracking table verified against actual codebase

**Exit criteria**: ✅ All docs created; 1323 unit tests pass; 70 integration tests pass; TypeScript 0 errors; build clean.

---

## Phase 8.1 — Production Deployment Verification ✅
*Goal: CI pipeline, Vercel config, and env-flag gating verified correct. No gameplay changes.*

- [x] `VITE_ENABLE_DEBUG_PANEL` gate **code-enforced** in `AdventureHub.tsx` — tab absent from DOM and component content absent from production bundle when flag ≠ `'true'`. Verified by bundle scan: `"DEBUG PANEL"` and all DebugPanel section headers absent from `dist/` output.
- [x] `VITE_ENABLE_DEV_TOOLS` clarified as reserved (unused until a future performance-overlay feature reads it). JSDoc comment added to `src/vite-env.d.ts`.
- [x] `vercel.json` created — SPA rewrites, security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`), immutable asset caching on `/assets/*`.
- [x] `.github/workflows/ci.yml` created — TypeScript → unit tests (with production flags) → build → `grep -r "sk-ant-" dist/` bundle key scan. Triggers on push to `main`/`develop` and on pull requests.
- [x] `package.json` `build:check` script added — runs `npm run build` with all production feature flags set explicitly.
- [x] `.env.example` updated — explicit production-value guidance, `ANTHROPIC_API_KEY` placement warning.
- [x] `RELEASE_CHECKLIST.md` updated — CI-verified items marked `[x]`; debug panel gate item marked `[x]` with note that it is code-enforced.
- [x] `DEPLOYMENT.md` updated — references actual `vercel.json` and `ci.yml` files.

**Verification results:**

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm test` | ✅ 1323 / 1323 (49 files) |
| `npm run build` | ✅ Clean |
| `npm run build:check` | ✅ Clean (production flags enforced) |
| `grep -r "sk-ant-" dist/` | ✅ No API keys in bundle |
| DebugPanel content in bundle | ✅ Absent when `VITE_ENABLE_DEBUG_PANEL` ≠ `'true'` |
| Docs vs codebase alignment | ✅ All env vars, migrations, and file references verified |

**Remaining blockers — production infrastructure only (zero code changes required):**
1. Supabase production project created and configured
2. `narrate` Edge Function deployed: `supabase functions deploy narrate`
3. `ANTHROPIC_API_KEY` set as Supabase Edge Function secret
4. Hosting provider configured with production env vars
5. `RELEASE_CHECKLIST.md` completed against live production environment

**Exit criteria**: ✅ Met. 1323/1323 tests; 0 TypeScript errors; production build and `build:check` clean; no API keys in bundle; all deployment configs verified correct.

---

## MVP — Public Alpha Checklist

### Must-have for public alpha launch

These items block the alpha. Nothing ships without them.

- [x] Full exploration session playable: create campaign → create character → play turns → AI narrates → world state persists
- [x] Combat: initiative, attack/damage, death saves, XP, loot persist
- [x] Living Atlas: discovered locations display with hierarchy/search
- [x] Session persistence: pause/resume/refresh all restore game state
- [x] Authentication: sign up, log in, log out, session expiry
- [x] Error boundaries: no white-screen crashes
- [x] Accessibility: WCAG AA skip link, focus management, reduced motion, touch targets
- [x] Route code splitting: fast initial load
- [x] All 1323 unit tests pass; 70 integration tests pass; 0 TypeScript errors
- [x] `VITE_ENABLE_DEBUG_PANEL=false` confirmed in production env — gate is **code-enforced** in `AdventureHub.tsx`; tab and component content are absent from the production bundle when the flag is not `'true'`
- [ ] Supabase production project created (distinct from local dev)
- [ ] All 5 DB migrations applied to production Supabase
- [ ] `narrate` Edge Function deployed to production Supabase
- [ ] `OPENAI_API_KEY` set as Edge Function secret (not in client bundle)
- [ ] Hosting provider configured (Vercel recommended)
- [ ] Custom domain (optional but professional)
- [ ] `RELEASE_CHECKLIST.md` completed top-to-bottom

### Nice-to-have after alpha (before GA)

These improve quality but do not block alpha users.

- [ ] Sentry error tracking wired in
- [ ] Uptime monitoring configured
- [ ] Email confirmation enabled on Supabase auth
- [ ] Privacy policy + Terms of Service pages published
- [ ] GDPR account deletion flow
- [x] CI/CD pipeline (GitHub Actions) — `.github/workflows/ci.yml` created; TypeScript, unit tests, build, bundle key scan on every push and PR
- [ ] Automated down-migration scripts
- [ ] Lighthouse CI in build pipeline
- [ ] Rate limit UI feedback (show user when AI calls are throttled)
- [ ] Session post-summary route (dedicated end-of-session page)
- [ ] Campaign NPC tracking via Living World dispatcher

### Future roadmap (post-alpha)

Features that require new architecture or significant scope.

- [ ] **Phase 4 remainder**: GBA/DS aesthetic reskin of combat screen and character sheet chrome
- [ ] **Phase 6 remainder**: Fog of war, map canvas, token system, DM/player layers
- [ ] **Phase 8 Voice**: Speech-to-text input, TTS narration, NPC voice profiles
- [ ] Multiplayer campaigns (shared sessions)
- [ ] Campaign marketplace (share and play community campaigns)
- [ ] Native mobile app (React Native or Capacitor)
- [ ] Character sheet import (D&D Beyond / Roll20 JSON format)
- [ ] Custom world builder (visual map editor, faction builder)

---

## Voice Layer *(Post-Launch — was Phase 8)*
*Goal: Chronicle AI becomes an immersive audio experience.*

Voice is deferred until the core engine is stable. The text pipeline is the foundation; voice is a presentation layer on top.

- [ ] Speech-to-text for player action input
- [ ] Text-to-speech for Director narration (configurable narrator voice)
- [ ] NPC voice profiles (persistent voice identity per NPC, TTS model hints)
- [ ] Ambient sound integration (location-based soundscapes)
- [ ] Architecture: voice layer wraps existing text pipeline — engine never changes

---

## Deferred / Post-Launch

- Multiplayer campaigns (multiple players, shared session)
- Custom world builder (visual map editor, faction builder)
- Campaign marketplace (share and play community campaigns)
- Native mobile app (React Native or Capacitor)
- Character sheet import from D&D Beyond / Roll20 format

---

## Phase 8.3 — Interactive DM Interface ✅
*Goal: Adventure Hub feels like a tabletop RPG run by an AI DM — menus and buttons alongside typed input.*

- [x] `ActionBar` component (`src/components/adventure/ActionBar.tsx`) — all player input consolidated here
  - **Explore mode**: 8 quick-action shortcut buttons (Look, Inventory, Character, Atlas, Journal, Quests, Rest, Dice) + typed textarea + Send/Cancel
  - **Combat mode**: JRPG action menu (Attack/Spell/Item/Defend/Move/Flee) with sub-menus
- [x] **Attack submenu**: lists all `slot: 'weapon', equipped: true` items; falls back to Unarmed Strike
- [x] **Spell submenu**: lists `character.spells.prepared[]`; empty state with cantrip fallback
- [x] **Item submenu**: lists `character.inventory[]`; empty state when no items
- [x] All buttons call `onSubmitAction(text)` — same pipeline as typed input
- [x] `StoryPanel` refactored to pure narrative display; input section removed
- [x] Keyboard accessibility: all interactive elements have `aria-label`; groups have `role="group"`; focus moves to first button on submenu open
- [x] Mobile-friendly: touch targets `min-h-[56px]` on combat buttons; quick-actions wrap on narrow screens
- [x] 50 new tests (`ActionBar.test.tsx`) + 10 updated `StoryPanel.test.tsx` tests

**Exit criteria**: ✅ 1363/1363 unit tests; 0 TypeScript errors; build clean.

---

## Phase 9.0 — Retro Pixel UI & Immersion ✅ (Foundation)
*Goal: GBA/NDS retro-RPG presentation layer. Additive only — engine, AI, persistence, schema untouched.*

**Delivered:**
- [x] **Pixel fonts**: `@fontsource/press-start-2p` (display) + `@fontsource/vt323` (body); crisp rendering via `-webkit-font-smoothing: none`; Tailwind families `font-pixel-display` / `font-pixel-body`
- [x] **Pixel design layer** (`src/styles/pixel.css`): GBA-style pixel borders (4 semantic variants), raised pixel buttons with hard drop shadows, torch flicker, pixel HP-bar fills with `steps()` transitions, floating damage numbers, crit flash, blinking menu cursor, menu transitions, typing indicator, optional scanlines — all suppressed under `prefers-reduced-motion`
- [x] **Pixel component library** (`src/components/pixel/`): `PixelPanel`, `PixelButton` (with selection cursor), `PixelBar` (HP color rules from STYLE_GUIDE: heal→arcane→harm by fraction; XP/MP variants; full ARIA progressbar), `PixelCard` (handheld-RPG card with header/body/footer strips), `DamageNumber` (damage/heal/crit/miss with accessible labels)
- [x] **AmbientOverlay**: deterministic particle system — fireflies, rain, snow, fog — aria-hidden, pointer-events-none, clamped to 60 particles, reduced-motion aware
- [x] **Audio framework** (`src/lib/audio/audioManager.ts`): manifest-driven, three channels (music/ambience/sfx) with independent volumes + master mute; context-driven track selection (combat > boss > location kind > menu); crossfading; graceful silent failure when assets absent; `useAudio` hook + `AudioSettingsPanel` with sliders and mute toggle
- [x] **Asset structure**: `public/audio/{music,ambience}/` + `public/assets/sprites/{portraits,enemies,environments,items,ui}/` with README manifests documenting expected files, formats, and royalty-free sources — ships empty by design, zero copyrighted assets
- [x] **Applied styling**: AdventureHub tab nav (pixel display font, torch flicker on active tab), ActionBar combat buttons and quick-actions (pixel-btn treatment, pixel body font)
- [x] 49 new tests (PixelUI: 30, AudioSystem: 19)

**Deferred to Phase 9.1+ (documented, not started):**
- Full three-column Adventure Hub redesign (left character sidebar / center scene / right world panel)
- Character sheet paper-doll equipment layout and inventory grid
- Pixel combat scene with sprite positioning and spell animations
- Journal handwritten-notebook aesthetic
- Atlas pixel world map with fog of war and travel history
- Pixel-art image assets (portraits, environments, enemies) — framework is asset-ready
- World time and weather display (requires Director world-state extensions)

**Exit criteria**: ✅ 1412/1412 unit tests; 0 TypeScript errors; build clean; zero engine/schema/AI changes.

---

## Phase 9.1 — Retro RPG Integration ✅
*Goal: Wire the Phase 9.0 pixel toolkit into the actual gameplay screens. Additive only — zero engine, schema, or AI changes.*

**Adventure Hub:**
- [x] Third column added — `WorldStatusSidebar` on `xl+` screens, alongside the existing character sidebar. Shows only real WorldState fields (turn, tone, difficulty, combat status, discovered location count, known NPC count, faction standings, Director-set `worldTime` when present). Deliberately does **not** show weather, day/night, or NPC relationships — those fields don't exist in WorldState yet (Phase 10 scope) and fabricating them would violate Constitution Law 3.
- [x] `AudioManager` mounted — `useAudio().setContext()` called on combat state change via `useEffect`. `inCombat`/`isBoss` are real, derived from `combatState`. `locationKind` is deliberately `null` (→ menu theme) because WorldState has no "current location" pointer to read honestly — see inline comment in `AdventureHub.tsx`.
- [x] `AmbientOverlay` mounted in the main panel area — currently renders `kind="none"` outside combat, since no real weather/location signal exists yet to justify fireflies/rain/snow. The mount point is wired; the trigger condition is honest about what data doesn't exist yet.
- [x] `CharacterSidebar` pixel-skinned — `PixelPanel` for stat pills, pixel HP bar track/fill, pixel fonts. Exact text/aria contract preserved (`"22 / 30"`, `aria-label="Hit points"`) so no behavior changed, only presentation.

**Combat:**
- [x] `DamageNumber` wired into real hit resolution — `playerAttack()` and `doEnemyTurn()` read the existing `AttackResult` (`hit`, `critical`, `totalDamage`) that the engine already returns and spawn a popup. Zero new engine calls; popups are pure UI state (`useState`) that read combat outcomes, never influence them.
- [x] Critical-hit flash — full-panel `arcane-400/10` flash for 200ms on any natural-20, per STYLE_GUIDE battle-screen rules. Same read-only relationship to combat state as damage numbers.
- [x] `HpBar` (both player and enemy) converted to `pixel-bar-track`/`pixel-bar-fill` with `steps()` transitions.
- [x] Initiative tracker entries, enemy cards, and the victory/summary screen converted to `pixel-border` / `PixelPanel`.
- [x] **Bug found and fixed during this phase**: `AudioManager.playMusic/playVictory/startAmbience` called `.play().catch()` unconditionally. `HTMLMediaElement.play()` is not guaranteed to return a Promise in every environment (confirmed via jsdom, which returns `undefined`) — a real crash the moment audio was actually wired into a live component. Added a `safePlay()` helper that guards both the Promise and non-Promise/throw cases. All three call sites fixed.

**Character Sheet:**
- [x] `OverviewTab` — added a **real XP progress bar** sourced from the engine's own `XP_THRESHOLDS`/`getXpForNextLevel()` (previously XP was a raw number input with no visual progress at all). Handles max-level (20) without divide-by-zero. Portrait frame, HP card, derived-stat cards, and ability-score grid converted to pixel borders/fonts.
- [x] `CharacterSheet` shell — error state and main panel converted to `PixelPanel`.
- [x] `EquipmentTab` / `InventoryTab` — summary stat cards and add-item form panels pixel-skinned. The underlying interaction model (dropdown slot selector + flat list, not a spatial paper-doll/grid) was **not** redesigned — that is a functional UI redesign, out of scope for a presentation-only phase. Documented here rather than silently left out.

**Cards & Landing Page:**
- [x] `CampaignCard` — save-slot appearance: pixel border, glow + arcane variant for the active campaign, pixel fonts. Same props/behavior.
- [x] `CharacterCard` — party-select appearance: pixel border, portrait frame, `PixelBar` for HP.
- [x] `LandingPage` — title-screen treatment: pixel display font on the game title, ambient fireflies, pixel-bordered menu card around the CTA buttons. Same content, roles, and links.
- [x] `AtlasPanel`'s `LocationCard` — pixel border on the card wrapper. Internal structure, `data-testid`s, and `aria-label`s unchanged (71-test suite passed unmodified).
- [x] `SessionSummaryPanel` (Journal) — header, stat cards, combat summary, and story-beat cards converted to `PixelPanel`. Exact `"SESSION JOURNAL"` text preserved (existing `AdventureHub` test depends on it).

**Tests added this phase:** 87 new tests across 8 files (`OverviewTab`, `CharacterSheet`, `EquipmentTab`, `InventoryTab` had zero prior coverage; `AdventureHub`, `CombatPanel`, `CharacterCard` extended).

**Verification:** 1459/1459 unit tests · 0 TypeScript errors · production build clean · no `sk-ant-` in bundle · Debug Panel gate still holds.

**What was deliberately NOT done (documented, not silently skipped):**
- Equipment paper-doll / spatial inventory grid — would be a functional redesign, not presentation
- Weather, day/night cycle, NPC relationships in the world sidebar — no real data exists yet (Phase 10 Living World foundation)
- Ambient ammbience/particles during actual exploration — no location-kind signal exists to trigger them honestly
- Level-up action button — flagged in the Phase 9.0 audit as a functional gap, out of scope for a presentation-only phase
- Quests/Codex panel content — still documented stubs, unchanged

---

## Infrastructure — AI Provider Migration (Anthropic → OpenAI)
*Presentation/infrastructure change only. Director philosophy, response contract, and streaming behavior unchanged.*

- [x] `supabase/functions/narrate/index.ts` — Anthropic SDK (`@anthropic-ai/sdk`) replaced with OpenAI SDK (`openai`); `claude-sonnet-4-6` → `gpt-4o`; `messages.stream()` → `chat.completions.create({ stream: true })`; `response_format: { type: 'json_object' }` used for structured output (the system prompt's existing "Respond ONLY with valid JSON" instruction satisfies OpenAI's requirement that the word "JSON" appear in the prompt)
- [x] SSE event contract preserved exactly: `data: <token>`, `data: {...NarrateResponse}`, `data: [DONE]`, `data: [ERROR] <message>` — the client (`src/lib/ai/narrator.ts`) required zero changes
- [x] Auth, session-ownership verification, turn persistence, and error handling in the Edge Function are byte-for-byte unchanged — only the model call itself was swapped
- [x] `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` in `.env.example`, `docs/DEPLOYMENT.md`, `docs/SETUP.md`, `docs/RELEASE_CHECKLIST.md`, `docs/CHRONICLE_CONSTITUTION.md` (architecture rule only — Director philosophy sections untouched)
- [x] `.github/workflows/ci.yml` bundle-secret-scan updated from Anthropic's `sk-ant-` prefix pattern to OpenAI's `sk-proj-`/`sk-` patterns
- [x] Historical phase records (Phase 2.4, Phase 8.1 delivery reports) left unmodified — they accurately describe what was built and shipped using Anthropic at the time. Rewriting history to say "OpenAI" would be inaccurate; this entry is the correct place to record the change.

**Verification:** 1459/1459 unit tests (unchanged — no test touches the Edge Function directly, as it runs in Deno, not Vitest) · 0 TypeScript errors · production build clean.

**No app code changes required.** `src/lib/ai/*` files only contain comments describing the architecture ("Anthropic API calls happen server-side") — those comments were updated to say "AI provider calls" generically; no logic changed because the client never touched the provider SDK.

---

## Infrastructure — Public Test Play Readiness
*Documentation only. No code changes — the app was already deployment-ready; this closes the gap between the detailed `DEPLOYMENT.md` reference and an actionable first-deploy path.*

- [x] `docs/PUBLIC_TEST_PLAY.md` created — single linear 8-step checklist from clean clone to a shareable playtest URL, cross-referencing `DEPLOYMENT.md` for detail rather than duplicating it
- [x] `docs/DEPLOYMENT.md` auth section fixed — previously assumed a custom domain existed; now covers the actual first-deploy case (bare `*.vercel.app` URL) and explicitly calls out Vercel Preview deployment URLs, which need a separate redirect-URL wildcard entry or auth fails on PR preview links
- [x] Documented the most common first-deploy bug explicitly: auth working locally but failing after deploy with a redirect mismatch — always traced to an incomplete Supabase Redirect URLs list
- [x] `README.md` doc index updated with a link to the new checklist

**Verification:** 1459/1459 unit tests (unchanged — documentation-only change) · 0 TypeScript errors · production build clean.

---

## Phase 9.2 — Public Alpha Readiness (Gameplay Focus) ✅
*Goal: close real gameplay gaps flagged by the Phase 9.0 UX audit — level-up, Quest Log, Codex, current location — using only real data. No fake content, no placeholder mechanics.*

- [x] **Level-up workflow** — `LevelUpModal` shows a real before/after stat comparison (new max HP, new proficiency bonus) computed from the same pure engine functions (`getProficiencyBonus`, `calculateMaxHp`) the rest of the app already trusts. Confirm calls `updateCharacter({ level, currentHp })`.
- [x] **Bug found and fixed**: `updateCharacter` only recalculated derived stats (`max_hp`, `armor_class`, `proficiency_bonus`) when `patch.scores` was present. A level-only patch (no score change) silently left those stats stale. Fixed by extending the recalculation gate to also fire on `patch.level !== undefined`. Two regression tests added.
- [x] **Quest Log MVP** — `QuestsPanel` now renders real `DirectorConfig.activeThreads` (a `PlotThread[]` field that existed on the schema since Phase 2.2 but was never populated or rendered). Grouped by status (active/resolved/abandoned), hidden threads never shown.
- [x] **Codex MVP** — `CodexPanel` now renders real `DirectorConfig.npcMemory`. Only NPCs the player has actually met are shown.
- [x] **Living World dispatcher extended** — `worldDispatcher.ts` gained `applyDirectorConfigUpdate`/`hasDirectorConfigChanges` (quest threads, NPC memory) alongside the existing `applyWorldStateUpdate`. `WorldState` gained a real `currentLocationId` field.
- [x] **Current location indicator** — shown in the Adventure Hub's world status sidebar, resolved honestly against `WorldState.locations`; never guessed or defaulted.
- [x] **Director prompt durable memory** — `activeQuestDigest`/`knownNpcDigest` added to the request payload, giving the Director facts that persist across the whole campaign rather than just the last 4-8 turns. System prompt reorganized into clearly labeled sections.
- [x] **Save/load UX** — explicit "Progress saved" confirmation shown after pausing.
- [x] `useAdventureSession`'s turn-completion callback restructured from synchronous to async so world-state and Director-config updates persist correctly before local state updates — direct hook test coverage added (previously untested).
- [x] `docs/PUBLIC_ALPHA_CHECKLIST.md`, `docs/FIRST_PLAY_GUIDE.md`, `docs/KNOWN_LIMITATIONS.md` created.

**Explicitly deferred this phase** (named in the original request, scoped out to avoid shallow coverage of 8 features): Google Sign-In, character import/OCR, portrait resize/compress pipeline, full visual pass beyond what these gameplay features touched.

**Verification:** 1542/1542 unit tests · 70/70 integration tests (run because real persistence call sites changed) · 0 TypeScript errors · production build clean.

---

## Phase 9.3 — Director Rules Lock-In & Full Dice Transparency ✅
*Goal: enforce the newly locked Director rules (second person, expand-not-invent, medium-length cinematic, hide-until-earned, escalating hints, full dice transparency) without changing the engine, schema, streaming protocol, or Director's core narrative philosophy.*

- [x] **Real gap found and closed**: exploration turns previously sent the player's raw text straight to the AI with **no dice roll at all** — only combat resolved dice. The engine already had an unwired resolver built exactly for this (`resolveCharacterAction`, `classifyAction`/`parseAction` — the latter's own doc comment called this "Phase 2 upgrade path" since Phase 1.1). This phase wired it into the exploration turn flow for the first time.
- [x] **Design decision** (explicitly confirmed): only actions that classify into a real skill category (FORCE/FINESSE/ENDURE/REASON/PERCEIVE/INFLUENCE) roll a check. Pure narration, dialogue, and movement (`classifyAction` → `UNKNOWN`) never roll — mechanizing every single line of play would work against the "Story-first, Player-first" half of the same locked rule set.
- [x] `summariseCharacterAction()` added alongside the existing `summariseResolution()` in `resolveAction.ts` — same `ResolutionSummary` output shape, adapted for `resolveCharacterAction`'s slightly different result structure. Not a duplicate: the two resolvers' inputs are intentionally distinct types.
- [x] `NarrateRequest` gained an optional `checkResult` field (omitted entirely for pure-narration turns, matching the codebase's established "omit when nothing to report" convention).
- [x] **Bug caught during implementation, before shipping**: an early version of the wiring called `resolveCharacterAction` twice per action (once to discover the DC, once "for real") — since the resolver rolls a die internally, this would have silently consumed two RNG draws per single player action. Fixed by calling the pure, dice-free `parseAction()` first to get `suggestedDc`, then calling `resolveCharacterAction` exactly once. Regression test asserts the exact roll total to catch any reintroduction of a double-roll.
- [x] `NarrativeTurn.diceRolls` (a field that already existed, typed `unknown[]` with a comment noting it was "typed as `ResolutionSummary[]` at call sites") is now actually populated for exploration turns, not just combat.
- [x] Edge Function system prompt rewritten: all newly locked Director rules added (second person, expand-not-invent, medium-length cinematic, hide-until-earned, escalating hints, full dice transparency) without removing any existing correct rule. A `THIS TURN'S CHECK` section is injected into the prompt only when a check was actually resolved, instructing the Director to narrate that exact result and never invent, re-roll, or soften it.
- [x] No schema migration required — `NarrativeTurn.diceRolls` persists to the existing unstructured `dice_rolls` JSONB column on `narrative_turns`, already provisioned since Phase 1.

**Verification:** 1557/1557 unit tests (15 new — 6 for `summariseCharacterAction`, 2 for `checkResult` in the request builder, 7 for the full exploration dice flow including a same-character-fixture deterministic roll-total assertion that proves no double-roll) · 70/70 integration tests · 0 TypeScript errors · production build clean.

**What was deliberately NOT done**: no automated test exists for the Edge Function's prompt string itself (it runs in Deno, outside the Vitest suite, and has never had direct test coverage — consistent since the original OpenAI migration). The prompt's template-string branches were manually verified to interpolate correctly for both the with-check and without-check cases.

---

---

## Phase 10.0 — Director Bible + World Modes Spec ✅
*Goal: formalize newly locked design decisions (living world, reputation, legacy, Campaign/Chronicle modes, creative-action handling) as permanent design documentation and implementation-ready specs — NOT implementation. Offline development pass; also includes a repository audit and documentation sync.*

**Design documentation created** (`docs/design/`):
- `DIRECTOR_BIBLE.md` — the authoritative Director behavior reference, organizing 12 locked design decisions (player identity, agency, narration length, failure, secrets, dice transparency, personality, living world, creative actions, world modes, time model, reputation/legacy). Every rule marked ✅ (implemented, Phase 9.3) or 📐 (specified, not built) — grounded in the actual live prompt, not aspirational.
- `GAME_DESIGN.md` — mechanical reference (classes, resolution system, DC ladder, combat, progression), grounded in real engine content (confirmed the 10-class `ARCHETYPE_HIT_DIE` table, confirmed ancestry/background are intentionally flavor-only per `characterContent.ts`'s own doc comments).
- `LIVING_WORLD.md` — field-level spec for structured time (`WorldClock`) and scheduled-event triggering. Confirmed `WorldEvent` already exists on `WorldState.scheduledEvents` and has been completely unused since it was typed — this spec is literally "wire up what's already there."
- `REPUTATION_SYSTEM.md` — four-scope reputation model (global/faction/settlement/NPC), severity-scaled deltas, spread mechanism depending on Living World's scheduled events.
- `NPC_SYSTEM.md` — documents the existing `NpcWorldState`/`NpcMemoryEntry` split (intentional, not duplication) and specs an original Legacy/Nemesis system for NPCs who evolve off-screen after meaningful player impact.
- `DIRECTOR_EXAMPLES.md` — worked narration examples for every Bible rule, each marked with the same ✅/📐 status as its governing rule.
- `CAMPAIGN_MODE.md` / `CHRONICLE_MODE.md` — the two world modes. Chronicle Mode's spec is explicit about its full dependency chain (Living World → Reputation → Legacy → Chronicle Mode) and does not propose any shortcut around it.
- `PUBLIC_ALPHA_ROADMAP.md` — sequencing for the above, reconciling a numbering difference between two source requests (resolved explicitly in the doc rather than silently picking one).

**Engineering specs created** (`docs/specs/`) — implementation-ready, not implemented:
- `PHASE_10_DIRECTOR_INTELLIGENCE.md` — exact prompt/type changes for the 4 remaining 📐 Bible rules
- `PHASE_11_LIVING_WORLD.md` — exact types, dispatcher functions, and test plan for `WorldClock` + scheduled events
- `PHASE_12_CREATOR_TOOLS.md` — structured campaign definition, explicitly scoped to exclude document-import (flagged as separate future work, not silently bundled in)
- `PHASE_13_RELEASE_CANDIDATE.md` — hardening/verification pass, not a feature phase

**Repository audit findings and fixes:**
- [x] **Real code duplication found and fixed**: `summariseResolution`/`summariseCharacterAction` (added Phase 9.3) had byte-for-byte identical bodies except one field-access path. Consolidated into a shared private `buildResolutionSummary` helper. Zero behavior change — all 76 existing tests for both functions pass unchanged.
- [x] **Two stale comments found and fixed** in `src/lib/ai/director.ts`: the file header claimed `combatTriggered` handling and `worldStateUpdates` application were "deferred to Phase 5/Phase 3" — both have been fully implemented since Phase 8.3/9.2. A misleading `console.info` log claiming "Phase 5 will handle transition" (Phase 5 already shipped) was also corrected. The `mapUpdate` deferred-work comment was checked and confirmed still accurate (Atlas genuinely has no map canvas) — left unchanged.
- [x] **~10 other "Phase X deferred" comments audited individually** across `character.ts`, `combat.ts`, `sessions.ts`, `actionValidation.ts`, `worldDispatcher.ts` — all confirmed still accurate on inspection, no changes needed. (Notably: spell slot tracking, ancestry/background mechanical effects, and the XP formula are all still genuinely unimplemented as their comments claim.)
- [x] **Two genuine missing-test gaps found and closed**: `ProtectedRoute`/`PublicRoute` (auth route guards) had zero test coverage despite being security-relevant. 10 new tests added. Every other apparent "missing test" from an initial filename-based scan turned out to be a false positive — components tested under a differently-named file (`AmbientOverlay`/`AudioSettings` → `PixelUI.test.tsx`/`AudioSystem.test.tsx`) or covered thoroughly through a parent component's tests (`SessionSummaryPanel`/`JournalPanel` → `AdventureHub.test.tsx`; both `WizardStepShell` components → their respective wizard test files).
- [x] **Accessibility audit**: checked all 42 raw `<button>` elements and all raw `<input>` elements outside the shared UI components for missing accessible names. Zero real gaps found — every apparent hit from an initial regex scan was a false positive (checkboxes correctly wrapped in `<label>`, inputs with `aria-label` the regex didn't match due to multi-line formatting). Documented as a genuine "checked, confirmed clean" finding rather than manufacturing a fix.
- [x] **One real inconsistency documented, not silently fixed**: `NpcMemoryEntry.disposition` uses a 4-value scale (`friendly|neutral|suspicious|hostile`) while `FactionState.standing` uses 5 values (`allied|friendly|neutral|unfriendly|hostile`). Fixing this touches live `CodexPanel.tsx` rendering and its tests — flagged in `NPC_SYSTEM.md` as a small, low-risk item to resolve as part of Phase 12 (Reputation/Legacy) rather than done ad hoc mid-audit.
- [x] No TODOs/FIXMEs/HACKs found anywhere in `src/`, `supabase/`, or `tests/` — confirmed via full-repository grep.

**Documentation sync:**
- [x] `README.md` — updated current test counts (1567), added `PUBLIC_ALPHA_CHECKLIST.md`/`KNOWN_LIMITATIONS.md`/`FIRST_PLAY_GUIDE.md` to the documentation index (pre-existing sync gap — these files existed and were referenced elsewhere in the README but were missing from the index table itself), added `docs/design/` and `docs/specs/` entries
- [x] Nothing in `docs/ROADMAP.md`'s history was edited — this entry is purely additive

**Verification:** 1567/1567 unit tests (10 new) · 0 TypeScript errors · production build clean. No persistence or service-layer behavior changed in a way that requires integration test re-verification (the one code change — `resolveAction.ts`'s deduplication — is a pure internal refactor with identical external behavior, confirmed by its existing test suite passing unchanged).

---

---

## Phase 10.1 — Public Alpha Completion ✅ (partial — scope explicitly narrowed mid-phase)
*Goal: bring Chronicle AI to first-playable public alpha. Google Sign-In, campaign document upload, and OCR/Vision extraction were explicitly deferred (either by design decision during scoping, or by direct instruction) to keep the shipped work real rather than shallow across every named priority.*

**Priority 6 — real dice/XP/level-up feedback, not filler:**
- [x] **Dice check popup**: exploration skill checks (wired in Phase 9.3 but never surfaced to the player) now render a real `CheckResultPopup` in the story panel — face, modifier, DC, total, outcome, all from the actual `resolveCharacterAction()` result already flowing to the Director. Auto-dismisses after 4.2s. Full accessible description for screen readers, not just a visual popup.
- [x] **XP-gain animation**: the existing, already-correct `combat.xpAwarded` display now animates in (`xp-gain-popup` keyframe) rather than appearing as static text. No new data — same real XP the combat summary always showed.
- [x] **Level-up celebration**: `LevelUpModal` gains a brief celebration beat after a successful confirm — real new-level number, radiating burst animation — before auto-closing. Persistence (`onConfirm`) is always awaited and completed *before* the celebration begins; the celebration never gates or delays the actual save.
- [x] All three respect `prefers-reduced-motion` via the same suppression block every other pixel animation in this app uses.

**Priority 1 — Character Creation completion:**
- [x] Back button confirmed already working on every step (Phase 2.1) — audited, not rebuilt.
- [x] **Cancel confirmation**: leaving the wizard on step 1 with any meaningful content entered now prompts via the existing `ConfirmDialog` primitive (reused, not duplicated). An untouched draft cancels immediately with no nag.
- [x] **Autosave**: `useCharacterDraft` persists the draft + step to `localStorage`, scoped per `userId`, once the draft has real content (an empty draft is never persisted). Failure to write/read localStorage (private browsing, quota) degrades silently — autosave is a convenience, never a wizard-blocking error.
- [x] **Resume**: on mount, a meaningful saved draft triggers a resume-or-discard prompt (same `ConfirmDialog` primitive again). Resuming restores both the draft content and the exact step the player left off on.
- [x] **Validation audited, not expanded**: every wizard step already validates through the real engine (`buildCharacter()`, `validateEquipmentItem()`) — this was already thorough going into this phase. No invented new rule (e.g. no skill-proficiency count cap) was added where the existing engine doesn't have one, consistent with this project's "don't invent game-balance rules that don't exist elsewhere" discipline.
- [x] **Pixel/GBA polish**: `WizardStepShell` and `CampaignWizardStepShell` (both character and campaign wizards) converted to `PixelPanel`, pixel fonts, pixel-bordered step pills with `torch-flicker` on the active step — matching the treatment established for `AdventureHub` in Phase 9.1.

**Priority 3 — Character Import pipeline architecture (no OCR):**
- [x] `src/lib/import/` — provider-agnostic `CharacterImportProvider` interface (`{ name, supportsExtraction, parse(file) }`), a `CharacterImportResult` type with per-field `ExtractedField<T>` confidence, and `importResultToDraft()` converting a result into a full `CharacterDraft` + confidence map.
- [x] `ManualEntryProvider` — the one real, shipped provider. Validates file type, returns an honest empty result (every field `needs-review`, a note explaining extraction isn't available yet). No file content is read.
- [x] `getActiveImportProvider()` — the single swap point. A future OCR/Vision provider implements the same interface and replaces this function's return value; no UI, review, or save code changes.
- [x] `CharacterImportUpload` — drag-and-drop + click-to-browse zone, accepts PDF/PNG/JPG, 8MB cap, client-side type/size validation before calling the provider.
- [x] `CharacterImportPage` (`/characters/import`) — hosts upload, then hands the converted draft straight into the **existing** `CharacterWizard`, landing on Review. No second review UI was built — this reuses `ReviewStep`, `goToStep` navigation, and `createCharacter()` exactly as manual creation does.
- [x] `CharacterWizard` extended with optional `initialDraft`/`initialStep` props (additive, backward-compatible) — the actual seam that lets import hand off into the manual flow without duplicating it.
- [x] Character Library gained "Import Character" (header) and "Import a Sheet" (empty state) entry points alongside the existing "+ Create New" / "Create Your First Character", both unchanged.
- [x] Route `/characters/import` added before `/characters/:id` in the router config — though React Router v6's `createBrowserRouter` scores static segments as more specific than dynamic ones regardless of array order, so this was a safe, conventional choice either way, not a required fix.

**Explicitly deferred this phase** (Priority 2, Priority 4, and further UI redesign beyond what Priorities 1/3/6 required):
- **Google Sign-In** — client-side OAuth flow is straightforward to build against Supabase, but requires an external Google Cloud project + credentials this environment cannot provision. Deferred by explicit decision during scoping rather than attempted and left half-working.
- **Campaign document upload** (Priority 4) — not started this pass; explicitly out of scope per direct instruction on the continuation of this phase.
- **OCR/Vision extraction** — the entire point of this phase's Priority 3 work was building the swappable architecture *without* implementing extraction; see `getActiveImportProvider()`'s doc comment for the exact swap point when this is prioritized.
- **Campaign Library card fields** (Priority 5: artwork, progress, archive) — not started this pass.

**Verification:** 1651/1651 unit tests (93 new across this phase — dice/XP/level-up animation tests, `useCharacterDraft` autosave/resume tests, `CharacterWizard` cancel-confirmation and `initialDraft`/`initialStep` tests, the full `src/lib/import/` test suite, `CharacterImportUpload` and `CharacterImportPage` tests, and `CharacterLibraryPage` import-entry-point tests) · 0 TypeScript errors · production build clean (`CharacterImportPage` correctly code-split into its own lazy-loaded chunk) · no API key of any provider in the bundle. Integration tests were not re-run this continuation — no file under `src/lib/supabase/` was modified; the import pipeline calls the existing `createCharacter()` service with the same input shape manual creation has always used.

**A note on test-writing accuracy this phase:** several new tests initially made wrong assumptions about component internals (e.g. assuming `ReviewStep` has an editable "Character Name" field, when the name is actually read-only text there with a link back to Identity for corrections; assuming `userEvent.upload()` bypasses the `accept` attribute, when it doesn't — drag-and-drop was needed to test the unsupported-file-type path realistically). Each was root-caused against the actual component/browser behavior and fixed in the test, not worked around in the component.

---

---

## Phase 10.2 — Campaign Import Foundation + Director Document Extension Point ✅ (highest priority complete, second item scoped honestly)
*Goal, per explicit session instruction: leave the repository in the strongest possible state with ~30% context remaining, prioritizing one complete feature over multiple half-finished ones.*

**Priority 1 — Campaign Import Foundation (complete):**
- [x] `src/lib/campaignImport/` — provider-agnostic architecture mirroring `src/lib/import/` (Character Import, Phase 10.1) exactly: `CampaignImportProvider` interface, `CampaignImportResult` with per-field `ExtractedField<T>` confidence, `campaignImportResultToDraft()` conversion, `ManualCampaignEntryProvider` (the one real, honest, extraction-free provider), `getActiveCampaignImportProvider()` swap point.
- [x] Supports PDF, DOCX, TXT, Markdown, and JSON — including a Markdown MIME-sniffing fallback (`isSupportedCampaignImportFile`) for the common browser quirk of reporting `.md` files as `text/plain` or an empty MIME type.
- [x] `CampaignImportUpload` — drag-and-drop + click-to-browse, 15MB cap, client-side validation, and a small real UX improvement over the character-import equivalent: an immediate "✓ file received" confirmation the instant a file passes validation, distinct from the generic "processing" state (Priority 3's "better upload progress," applied where it was cheap and real).
- [x] `CampaignImportPage` (`/campaigns/import`) — hands the converted draft into the **existing** `CampaignWizard`, landing on Review. No second review UI. `CampaignWizard` extended with optional `initialDraft`/`initialStep` props, mirroring `CharacterWizard`'s Phase 10.1 extension exactly (same `useEffect`-based one-time step jump, same reasoning documented inline).
- [x] Campaign Library gained "Import Campaign" (header) and "Import a Document" (empty state) entry points alongside the existing "+ New Campaign" / "Start Your First Campaign," both unchanged.
- [x] Route `/campaigns/import` added before `/campaigns/:id`, same reasoning as the character-import route from Phase 10.1.
- [x] **Real validation interaction discovered and correctly handled, not worked around**: a campaign still requires a character to be assigned — existing, unmodified `CampaignReviewStep` validation. Campaign import cannot pre-fill this (it has no character context), so an imported campaign genuinely lands on Review needing both a title and a character, exactly like a manual campaign missing those fields. Tests reflect this real flow rather than assuming it away.

**Priority 2 — Director Document Upload (types-only extension point, explicitly not a full feature this session):**
- [x] `src/lib/directorDocuments/types.ts` — `DirectorDocumentCategory`, `DirectorDocumentMetadata` (the shape a future `director_documents` table should materialize), `DirectorDocumentParser` (provider-style contract mirroring the two shipped import pipelines), `isSupportedDirectorDocument()` (tested).
- [x] `docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md` — full build-order spec for what's missing: migration, service layer, manual-entry-equivalent parser, upload/management UI, and — the genuinely hard, unsolved part — a Director retrieval strategy (full-text search recommended over embeddings as the first real step, with reasoning).
- [x] **Explicitly no service layer, no UI, no route, no Director prompt integration** — building UI against types with no backing persistence would produce a feature that looks functional but silently does nothing on submit, which is worse than not building it. This is the direct, honest application of this session's instruction: "if a feature cannot be completed this session, document the architecture and create extension points instead of partially implementing it."

**Priority 3 — Public Alpha Polish:** one real, cheap improvement shipped (the upload-acceptance confirmation on `CampaignImportUpload`, noted above). Broader polish (loading states, error messages, save feedback across existing screens) was not attempted this pass — budget went to finishing Priority 1 completely rather than spreading thin. Not regressed; simply not touched.

**Explicitly deferred, zero code written (per direct instruction):** OCR, OpenAI Vision extraction, Living World, Reputation, Nemesis, Chronicle Mode, multiplayer, companion app.

**Verification:** 1721/1721 unit tests (70 new this phase: 21 core campaign-import pipeline tests, 10 conversion tests, 10 `CampaignImportUpload` tests, 11 `CampaignImportPage` tests, 5 `CampaignLibraryPage` import-entry-point tests, 5 `CampaignWizard` `initialDraft`/`initialStep` tests, 8 director-documents extension-point tests) · 0 TypeScript errors · production build clean · no API key of any provider in the bundle. Integration tests not re-run — no file under `src/lib/supabase/` was modified; the campaign import pipeline calls the existing `createCampaign()` service with the same input shape manual creation has always used, and the director-documents module has no persistence layer at all yet.

**Two real test-writing lessons from this phase, same discipline as Phase 10.1:**
1. A drag-and-drop unsupported-file-type test needs a type genuinely unsupported by the *specific* pipeline under test — reusing "DOCX" (character-import's unsupported example) would have silently passed, since DOCX is a *supported* campaign-import type. Caught before it became a false-negative test.
2. `isSupportedCampaignImportFile`'s markdown-MIME-fallback logic was initially mis-tested as "text/plain should only be accepted for .md files" — the code was actually correct (text/plain is independently supported for real .txt files); the test's premise was wrong, not the implementation. Root-caused against the actual code before "fixing" anything.

---

---

## Phase 10.3 — Director Document Upload (complete, full-text retrieval) ✅
*Goal: complete the Director Document Upload extension point shipped as types-only in Phase 10.2 — full storage, retrieval, UI, and Director prompt integration, using a modular retrieval architecture rather than a hardcoded prompt.*

**Database (migration 0006_director_documents.sql):**
- [x] `director_documents` table — metadata + `extracted_text`, generated `tsvector` `search_vector` column (GIN-indexed), owner-only RLS
- [x] `director-documents` Storage bucket (private) — first Storage bucket this project uses; every prior upload (portraits) used a base64 column instead
- [x] `search_director_documents` SQL function — real `ts_rank`-ranked, `ts_headline`-excerpted full-text search, NOT `SECURITY DEFINER` so the existing RLS policy applies to every call automatically
- [x] **Verified against real local Postgres during development, not assumed**: inserted real multi-document fixtures, ran real queries, confirmed correct ranking, correct excerpt bolding, correct exclusion of unindexed documents, and correct zero-result behavior for non-matching queries — see the exact queries in this phase's development history
- [x] Local test infrastructure extended: `supabase/local-test-support/0001_storage_stub.sql` (a minimal `storage.buckets`/`storage.objects`/`storage.foldername()` stub, mirroring the existing `auth` stub's pattern), `scripts/setup-test-db.sh` updated to apply it and migration 0006
- [x] `tests/integration/support/pgAdapter.ts` extended with a REAL `.rpc()` (executes actual Postgres functions against the same pool) and a FAKE in-memory `.storage` (Supabase Storage is a separate HTTP service with no local equivalent in this environment — documented precisely, not silently approximated)

**Service layer (`src/lib/supabase/directorDocuments.ts`):**
- [x] `uploadDirectorDocument`, `listDirectorDocuments`, `getDirectorDocument`, `indexDirectorDocument`, `getDirectorDocumentSignedUrl`, `deleteDirectorDocument` — same `ServiceError` conventions as every other service module
- [x] Upload failure cleanup: if the metadata insert fails after a successful Storage write, the orphaned Storage object is removed (best-effort, never masks the real error)
- [x] Generated Supabase types (`src/types/supabase-generated.ts`) extended with the `director_documents` table and the `search_director_documents` function signature — this project's first use of the `Functions` block, previously `[_ in never]: never`

**Modular retrieval architecture (the actual design requirement):**
- [x] `DocumentRetriever` interface (`src/lib/directorDocuments/types.ts`) — the swappable contract
- [x] `FullTextRetriever` — the one shipped implementation, calls `search_director_documents` via `supabase.rpc()`
- [x] `getActiveDocumentRetriever()` — the single swap point; an embeddings-based retriever is a valid future implementation of the same interface, chosen not to be built this phase since full-text search required no new external dependency and was fully verifiable locally
- [x] `ManualDocumentParser` — the shipped `DirectorDocumentParser`, declines extraction honestly (same "no fake data" discipline as `ManualEntryProvider`/`ManualCampaignEntryProvider`)

**Upload/management UI:**
- [x] `DirectorDocumentsPanel` — category-tagged upload, indexed/not-indexed status list, delete with confirmation. Mounted on `CampaignDetailPage`, deliberately NOT built as an "upload → wizard review" flow like the two import pipelines — there's no draft here, just a persistent list a player adds to and removes from over a campaign's life.

**Director prompt integration:**
- [x] `submitAction` (`useAdventureSession.ts`) retrieves relevant excerpts before building the Director request — **fails open**: a retrieval error never blocks turn submission, degrading silently to "no document context this turn"
- [x] `NarrateRequest.documentContext` — optional, omitted (not sent as an empty array) when no documents are relevant, matching the established convention for every other optional context field
- [x] Edge Function `## REFERENCE DOCUMENTS` prompt section — only rendered when excerpts exist; explicit Director instruction to use retrieved material as natural background knowledge, never verbatim quotes, never claim knowledge beyond what was actually retrieved

**Real architectural finding, fixed correctly:** wiring in async document retrieval required restructuring `submitAction` from a purely synchronous `setState` updater into an async function using the same state-snapshot pattern already established for `commitCombatResult` (Phase 9.2) — `setState` updaters cannot `await`. All 19 pre-existing hook tests passed unchanged after the restructure, confirming no behavior regressed; 6 new tests cover the retrieval wiring itself, including the field-stripping behavior (`relevanceScore`/`documentId` never reach the Director) and the fail-open error path.

**Verification:** 1753/1753 unit tests (32 new this phase) · 85/85 integration tests (15 new — real Postgres, real RLS-across-users, real ranked search) · 0 TypeScript errors · production build clean · no API key of any provider in the bundle.

**Explicitly not started this phase, per direct instruction:** Google Auth, OpenAI Vision extraction for Character/Campaign Import, Living World, Reputation. Real text extraction for Director Documents remains deferred — see `docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md`'s "What's Genuinely Still Missing" section.

---

---

## Phase 10.4 — Director Document Text Extraction ✅
*Goal: replace the manual/no-op Director document parser with real client-side text extraction (TXT, Markdown, PDF, DOCX), preserving the existing FullTextRetriever, upload UI, and service layer unchanged.*

**`TextExtractionParser` (`src/lib/directorDocuments/textExtractionParser.ts`) — the new active parser:**
- [x] TXT/Markdown — read via `FileReader.readAsText()` (chosen over the newer `File.text()`/`Blob.text()` convenience methods specifically because `FileReader` has broader runtime support — a genuine implementation decision, not a workaround, confirmed by the fact this project's own test environment doesn't implement `File.prototype.text()` at all)
- [x] PDF — Mozilla's `pdfjs-dist`, real client-side parsing, no server call. The Vite-specific `?url` import pattern for bundling the required worker script was verified against a real production build before being trusted (`npm run build` produced a genuine, separate `pdf.worker-*.mjs` asset)
- [x] DOCX — `mammoth`, real client-side parsing, no server call
- [x] Every extraction path is wrapped so a corrupt/malformed file degrades to `{ text: null, confidence: 'unavailable' }` — the exact shape `ManualDocumentParser` always returned — rather than throwing and breaking the upload flow
- [x] `getActiveDocumentParser()` moved to this file (the real swap point now); `ManualDocumentParser` (`manualParser.ts`) preserved unchanged as a documented fallback/reference implementation, matching what its own Phase 10.3 comment said it would be used for
- [x] `DirectorDocumentsPanel` updated to import from the new location; a distinct, non-alarming "extraction warning" (role=status, not role=alert) now tells the player when a document was uploaded successfully but couldn't be indexed — clearly different from an upload failure

**`FullTextRetriever` — confirmed unchanged, as required.** No modification was needed or made; `is_indexed`'s existing logic (`extractedText !== null`, set in `src/lib/supabase/directorDocuments.ts`, itself unchanged) now receives real extracted text for well-formed TXT/MD/PDF/DOCX files instead of always `null`.

**New dependencies:** `pdfjs-dist@6.1.200`, `mammoth@1.12.0`. Both audited — zero new advisories introduced; the pre-existing `esbuild`/`vite`/`vitest` advisory chain (unrelated, present before this phase) was confirmed via `npm audit` and left untouched per explicit instruction not to run `audit fix --force` or upgrade Vite/esbuild outside scope.

**Real environment constraints found during test-writing, each investigated to its actual root cause rather than worked around blindly:**

1. **`DOMMatrix` is undefined in both plain Node and this project's jsdom test environment** — confirmed by direct experiment, not assumed. `pdfjs-dist`'s standard browser build requires it (real browsers provide it natively). Fix: **test-only** substitution of `pdfjs-dist` with its own `legacy` build via `vi.mock` — production code (`textExtractionParser.ts`) is completely unchanged and still imports the standard build, which is Mozilla's documented recommendation for real browser deployment. This is standard module-mocking for testability, not a runtime environment branch in application code, per explicit instruction.
2. **jsdom's `File`/`Blob` implementation in this project's dependency version does not implement `File.prototype.text()` or `File.prototype.arrayBuffer()`** — confirmed by direct experiment (both throw `is not a function`). `FileReader.readAsText()`/`readAsArrayBuffer()` are fully supported instead, and are a genuine, standard, still-current Web API (per current MDN documentation) — not a legacy shim. Production code was rewritten to use `FileReader` universally for this reason; this is a real, defensible implementation choice with identical behavior in every real browser, not a test-environment accommodation.
3. **A Node `Buffer`'s `.buffer` property fails `instanceof ArrayBuffer` inside jsdom** — a genuine cross-realm object-identity gap, confirmed by direct experiment. Not relevant to production code at all (browsers never produce Node `Buffer` objects); relevant only to how test fixtures are constructed. Resolved by reading fixtures through the same `FileReader`-based path production code uses, which produces a same-realm `ArrayBuffer` and works correctly.
4. **mammoth is a CommonJS package whose `lib/index.js` uses an internal, un-intercepted `require("./unzip")` call** — its `package.json` "browser" field (a bundler convention Vite/Webpack/Rollup all honor) correctly remaps this to a browser-compatible implementation in the real production build (confirmed: `npm run build` succeeds, and mammoth's own published TypeScript types confirm `{ arrayBuffer: ArrayBuffer }` is the correct, documented browser-usage shape `textExtractionParser.ts` uses). Vitest's `vi.mock()` reliably intercepts ESM-level imports but does not intercept this internal CJS `require()` — confirmed by testing multiple mock path variants, all of which still resolved to the real Node-only module. **This was investigated thoroughly rather than patched over**: the underlying extraction mechanism itself (a `FileReader`-produced `ArrayBuffer` opened via mammoth's real, unmocked `browser/unzip.js`, called directly) was verified to work correctly against the real fixture DOCX. Only the one CJS interop hop inside mammoth's own package structure is unverified inside this specific test runner — both sides of that hop are proven real. The DOCX test suite documents this precisely rather than silently passing or silently skipping.

**A note on the DOCX/jsdom test warning:** running `tests/unit/textExtractionParser.test.ts` (and the full suite) produces two benign "Unhandled Rejection" console warnings during the DOCX tests. These come from `mammoth.extractRawText()` internally rejecting (per constraint #4 above) on a promise that IS correctly caught by `extractDocxText()`'s own `try/catch` — confirmed by the test suite's actual exit code being `0` and every assertion passing. This is Vitest's rejection-timing detector firing before the `catch` handler completes its microtask, not a real test failure, not a real application bug, and not something that affects `npm test`'s pass/fail result. No production code was changed to silence it, per explicit instruction — the warning is real, informative signal about the CJS-interop constraint above, not something to suppress.

**Verification:** 1773/1773 unit tests (20 new this phase — 18 in `textExtractionParser.test.ts`, plus test-file fixups in `directorDocumentParserRetriever.test.ts` and `DirectorDocumentsPanel.test.tsx` to isolate them from the now-real extraction parser) · 85/85 integration tests (unchanged — no persistence/service-layer/indexing logic was modified this phase, only the client-side parser feeding the same, unchanged `indexDirectorDocument()` call) · 0 TypeScript errors · production build clean, including a genuine separate `pdf.worker-*.mjs` asset · no API key of any provider in the bundle.

**Explicitly not started this phase, per direct instruction:** Google Auth, OpenAI Vision (for any of the three upload pipelines), Living World, Reputation. `npm audit fix --force` / Vite or esbuild version upgrades were not run.

**Finalization pass (same phase, no new scope):** a follow-up review found and fixed two genuinely stale comments — `src/lib/directorDocuments/types.ts`'s file header still described real text extraction as "the one deliberately unimplemented piece" (written before this phase's own work landed) and `DirectorDocumentsPanel.tsx`'s header still said "Phase 10.3" with no mention of the extraction work it now depends on. Both fixed. Also improved the upload success message to distinguish two real outcomes instead of one generic confirmation: `"<file>" added and ready — the Director can search it now.` when extraction genuinely succeeded, versus a plain `"<file>" added.` when it didn't (paired with the existing, separate extraction-warning message) — this is a real, useful distinction for the player that the original single "added" message didn't make. 2 new tests added for this (1775/1775 unit tests total after this pass); all other verification re-run and confirmed clean (TypeScript, build, PDF worker bundling). No service/indexing/persistence code was touched, so integration tests were not re-run, per the stated condition.

---

---

## Phase 10.5 — Google Authentication ✅ (code-complete and fully tested; live OAuth handshake unverified — no Google Cloud credentials in this environment)
*Goal: complete Google Sign-In via Supabase Auth — OAuth flow, session persistence, automatic provisioning, logout, error handling — while preserving existing email/password auth and RLS unchanged.*

**What was already there, found on inspection rather than assumed absent:** `authService.signInWithGoogle()` (`src/lib/supabase/auth.ts`) already existed as a real, complete implementation before this phase started — a genuine prior-session foundation that had never been wired into any route or UI. This phase's real work was closing that gap, not building the wrapper from scratch.

**OAuth flow:**
- [x] `GoogleSignInButton` (`src/components/auth/GoogleSignInButton.tsx`) — shared component used on both `/login` and `/signup` (Google OAuth doesn't distinguish sign-in from sign-up; the same provisioning trigger handles both). Real loading state ("Redirecting to Google…"), button disabled during redirect to prevent duplicate clicks, friendly error messages distinguishing network failures from other errors, retry support (clears a previous error on the next click).
- [x] `AuthCallbackPage` (`/auth/callback`) — deliberately a **standalone top-level route**, not nested under `PublicRoute` or `ProtectedRoute`. Verified precisely why this matters: `PublicRoute` redirects any authenticated user to `/dashboard` the instant `isAuthenticated` flips true, which would fire mid-flow before this page could check for an OAuth error or show its own loading state.
- [x] **Session restoration timing verified by reading `@supabase/auth-js`'s own source, not assumed**: `getSession()`'s first line is `await this.initializePromise` — every call genuinely waits for the client's URL-based PKCE code exchange to finish first. Since `authStore.initialize()` (run once, awaited, before the router even renders — see `main.tsx`) calls `getSession()` as its first step, the session it receives on a callback page load is already the freshly-exchanged Google session, not dependent on catching a later event's timing.
- [x] **Error detection independently verified**: the client's own internal `AuthImplicitGrantRedirectError` (thrown inside `_initialize()` when it detects `error`/`error_description`/`error_code` in the URL) is swallowed internally and never propagates to application code — confirmed by reading the library source. `AuthCallbackPage` independently checks both the query string and hash fragment for these params, mapping the standard OAuth 2.0 `access_denied` code (RFC 6749 §4.1.2.1 — the real, standard code for "user cancelled on the provider's consent screen") to a friendly "Sign-in was cancelled" message, `server_error`/`temporarily_unavailable` to their own specific messages, and falling back to the raw `error_description` for anything unrecognized rather than hiding real information behind a generic message.
- [x] **15-second stall-detection timeout** — a real safety net for a session that never resolves (expired/already-consumed code, silent network failure). Found and fixed a genuine bug while writing its test: the timeout effect originally only cleared when `status` changed, never when authentication succeeded — relying entirely on component unmount (via `navigate()`) to implicitly clean it up. Fixed to explicitly depend on `isAuthenticated` too, removing the reliance on incidental unmount timing.

**Session persistence:** no changes needed — `client.ts`'s existing `persistSession`/`autoRefreshToken`/`detectSessionInUrl` configuration and `authStore`'s existing `onAuthStateChange` subscription already handle this correctly for both auth methods; verified, not assumed, via `authStore.test.ts`'s subscription tests (simulating exactly what a real `SIGNED_IN` event from a completed Google exchange produces).

**Automatic user provisioning (migration `0007_google_oauth_provisioning.sql`):**
- [x] The existing `handle_new_user()` trigger (migration 0001) already fired automatically for every new `auth.users` row regardless of sign-up method — no new trigger was needed for Google users to get a profile at all. This migration only **improved** what it populates: the original only ever read `raw_user_meta_data ->> 'display_name'`, which Google-authenticated users never have (confirmed against Supabase's documented metadata shape for Google — `full_name`/`name` and `avatar_url`/`picture` instead). Extended with `coalesce()` across all four keys; email/password's exact existing behavior is fully preserved (verified via regression tests).
- [x] **Verified against real local Postgres, not assumed**: inserted real Google-shaped and email/password-shaped rows directly into `auth.users`, confirmed correct `display_name`/`avatar_url` population for each, confirmed a second "login" (an `UPDATE`, not a re-`INSERT` — genuinely how a returning OAuth user's session refresh works) never creates a duplicate profile, confirmed the primary-key constraint on `auth.users.id` is the actual mechanism preventing duplicate users at the database level, and confirmed RLS applies identically to Google-provisioned profiles as to any other (owner-only read, verified from both the owner's and another user's session context).

**Logout:** no changes needed — `authStore.signOut()` already existed and already worked correctly for both auth methods (it doesn't need to know which provider a session came from). Verified thoroughly: calls the real service, clears all three pieces of cached state, and — a real edge case caught by testing — correctly does NOT clear state if the underlying `signOut()` call itself fails, since the user is still genuinely signed in at that point.

**UI polish (found while verifying, fixed as in-scope cleanup):** `DashboardPage.tsx` still displayed a "VOLUME II — PHASE 2.2" development-phase marker as user-facing copy, long since stale. Replaced with real, evergreen copy while writing this page's first-ever test file.

**Testing — the majority of this phase's real effort:**
- [x] `authService.test.ts` (new, 17 tests) — the real service against the mocked Supabase client, including the exact `redirectTo` URL construction for `signInWithGoogle()`.
- [x] `authStore.test.ts` (new, 21 tests, supersedes the old 3-test `auth.test.ts`) — `initialize()`'s session restoration (both the returning-user and no-session paths), its error handling, the `onAuthStateChange` subscription (simulating exactly what a real completed Google exchange produces), and `signOut()`'s full state-clearing behavior including the failure-doesn't-clear-state edge case.
- [x] `GoogleSignInButton.test.tsx` (new, 12 tests) — rendering, the loading state, error handling for generic/network/non-Error rejections, retry behavior. One real test-authoring mistake caught and fixed during development: the button's `aria-label` (fixed) takes precedence over its visible text (which changes to "Redirecting to Google…" mid-flow) for accessible-name computation — several early test assertions searched for the wrong thing and were corrected to search by the stable accessible name.
- [x] `AuthCallbackPage.test.tsx` (new, 15 tests) — processing/loading state, successful redirect, OAuth error handling (both query string and hash fragment, `access_denied`/`server_error`/unrecognized codes), the stall timeout (which surfaced the real bug described above).
- [x] `LoginPage.test.tsx` / `SignupPage.test.tsx` (new, 8 tests each — no test file existed for either page before this phase) — email/password flow regression coverage plus Google button integration, confirming the two entry points are genuinely independent (clicking Google never touches the email form's submit handler and vice versa).
- [x] `DashboardPage.test.tsx` (new, 4 tests — no test file existed before) — the real logout button, wired to the real store.
- [x] `googleAuthProvisioning.integration.test.ts` (new, 13 tests, real Postgres) — see provisioning section above.
- [x] `tests/setup.ts`'s global Supabase client mock extended with `signInWithOAuth` — a real, load-bearing gap found while writing `authService.test.ts`: no test could otherwise exercise the real `signInWithGoogle()` implementation at all.

**Verification:** 1857/1857 unit tests (84 new this phase) · 98/98 integration tests (+13, real Postgres, real RLS-across-auth-methods) · 0 TypeScript errors · production build clean, `LoginPage`/`SignupPage`/`AuthCallbackPage` all correctly code-split into their own lazy-loaded chunks · secret scan clean, including a specific check confirming no Google client secret is ever embedded client-side (it lives only in the Supabase dashboard, server-side).

**What remains genuinely unverified, and why:** the live round-trip through an actual Google OAuth consent screen. Every piece of code up to and including that boundary is built, wired, and tested — but this development environment has no Google Cloud project and cannot create one. `docs/DEPLOYMENT.md`'s new "Google OAuth Setup" section documents the exact manual steps (Google Cloud OAuth client creation, Supabase dashboard provider configuration) a deployer with real credentials needs to complete — no further code changes are required on that path.

**Explicitly not started this phase, per direct instruction:** Character OCR, Campaign OCR, OpenAI Vision, Tactical Maps, Living World, Reputation, Nemesis, Chronicle Mode. No dependency upgrades (Vite, esbuild) outside this phase's own scope.

---

*Last updated: Phase 10.5 — Google Authentication*