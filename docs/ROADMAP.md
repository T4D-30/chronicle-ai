# Vision

Chronicle AI becomes a long-lived solo and shared tabletop RPG platform where players can create or import characters, build campaigns, explore a living pixel-art world, resolve every meaningful action through deterministic tabletop mechanics, and receive rich AI Director narration that never overrides rules or persisted state. The final product should feel less like a website and more like a premium indie RPG: overworld exploration, cinematic dialogue, tactical combat, persistent world memory, creator tooling, shareable worlds, and a release path from public alpha to launch.

This file is the master build order for future implementation. `docs/PROJECT_STATE.md` tracks current progress, and `docs/CHANGELOG.md` records completed history. Never delete completed milestones; mark them complete and keep moving forward.

# Major Milestones

## Presentation

### UI Foundation

- Goal: Establish the app shell, routing, shared UI primitives, accessibility baseline, and core responsive layout.
- Dependencies: Technical foundation, auth, routing, design tokens.
- Status: Complete.
- Estimated complexity: Medium.
- Acceptance criteria: App shell, protected/public routes, shared primitives, error boundaries, loading states, and baseline accessibility are in place.

### Pixel RPG UI

- Goal: Replace generic web styling with the ChronAI dark-fantasy pixel RPG presentation language.
- Dependencies: UI Foundation, `docs/UI_VISION.md`, `docs/STYLE_GUIDE.md`.
- Status: Complete.
- Estimated complexity: Medium.
- Acceptance criteria: Pixel fonts, panel treatments, buttons, bars, combat feedback, ambient presentation hooks, and major screens follow the RPG UI language.

### World Presence

- Goal: Make the world visually present behind gameplay through reusable scene rendering and environment-aware presentation.
- Dependencies: Pixel RPG UI, World Renderer.
- Status: Complete.
- Estimated complexity: Medium.
- Acceptance criteria: WorldRenderer and scene layers provide reusable visual presence without inventing game state.

### Character Presence

- Goal: Represent the active character visually and mechanically in the adventure presentation.
- Dependencies: Character engine, character persistence, World Presence.
- Status: Complete.
- Estimated complexity: Medium.
- Acceptance criteria: Player sprite/appearance derives deterministically from real character data and does not create new character state.

### Playable Overworld

- Goal: Add top-down movement, collision, interaction, exits, pause overlay, dialogue handoff, and encounter handoff as a presentation layer over existing adventure actions.
- Dependencies: World Presence, Character Presence, Adventure Controller, Combat.
- Status: Complete.
- Estimated complexity: High.
- Acceptance criteria: Overworld interactions use existing `submitAction`/`startCombat`, tile position stays presentation-only, temporary preview artifacts are removed, and full verification passes.

### Dialogue Cinematics

- Goal: Upgrade dialogue from functional windows to cinematic RPG conversations with portraits, pacing, transitions, and accessible controls.
- Dependencies: Playable Overworld, AI Director narration contract, UI Vision.
- Status: Planned.
- Estimated complexity: Medium.
- Acceptance criteria: Dialogue presents real Director output, supports choices/free input, preserves escape routes, respects reduced motion, and never creates facts outside the action pipeline.

### Combat Presentation

- Goal: Present deterministic combat as a readable, tactile RPG battle experience.
- Dependencies: Combat engine, Pixel RPG UI, ActionBar.
- Status: Complete.
- Estimated complexity: High.
- Acceptance criteria: Initiative, targeting, action menu, HP bars, damage feedback, combat log, victory/failure summaries, XP, and loot are visible and engine-driven.

### Audio Polish

- Goal: Turn the existing audio framework into a polished, content-backed soundscape.
- Dependencies: Audio framework, real or royalty-free assets, settings UI.
- Status: Partial.
- Estimated complexity: Medium.
- Acceptance criteria: Music/ambience/SFX assets are wired, context selection uses real state, settings persist, and absence/failure remains silent and non-blocking.

## Gameplay

### Director Intelligence

- Goal: Make the AI Director better at creative actions, location-weighted narration, failure-as-complication, and between-scene voice while preserving mechanical boundaries.
- Dependencies: Current AI narration pipeline, Director prompt contract, deterministic exploration checks.
- Status: Planned.
- Estimated complexity: Medium.
- Acceptance criteria: Prompt rules handle creative actions without flat refusal, narrate failures faithfully, and remain incapable of deciding mechanics.

### Living World

- Goal: Add structured world time and scheduled events so the world can change coherently over in-fiction time.
- Dependencies: WorldState model, world dispatcher, Director Intelligence preferred but not required.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: World clock, scheduled event checks, persistence, prompt integration, and tests exist without relying on real-world elapsed time.

### NPC Memory

- Goal: Strengthen durable NPC memory so relationships, facts, and recurring characters survive across long campaigns.
- Dependencies: DirectorConfig memory fields, Codex, Persistence.
- Status: Partial.
- Estimated complexity: Medium.
- Acceptance criteria: NPC memories are created, updated, displayed, and consumed by the Director from persisted state, not prior chat context.

### Reputation

- Goal: Track player reputation with factions, settlements, and important NPCs.
- Dependencies: Living World, NPC Memory, faction model.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: Reputation changes are rules/data-backed, visible where useful, and influence Director context without replacing mechanical resolution.

### Economy

- Goal: Add durable currency, shops, prices, rewards, and transaction rules.
- Dependencies: Inventory/equipment persistence, world locations, reputation optional.
- Status: Planned.
- Estimated complexity: Medium.
- Acceptance criteria: Purchases, sales, rewards, and costs persist and are validated outside AI prose.

### Crafting

- Goal: Let players convert materials into items through deterministic recipes or approved campaign rules.
- Dependencies: Economy, inventory, item model.
- Status: Planned.
- Estimated complexity: Medium.
- Acceptance criteria: Recipes, requirements, outputs, and failures are structured and persisted; AI can describe but not grant results.

### Survival

- Goal: Add optional travel pressure such as rest, supplies, weather, fatigue, and hazards.
- Dependencies: Living World, Economy, world/location data.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: Survival systems are opt-in or campaign-scoped, mechanically resolved, visible to players, and never inferred from ambience alone.

### Companion System

- Goal: Support persistent companion characters with state, memory, and controlled participation.
- Dependencies: NPC Memory, Reputation, Combat, Persistence.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: Companions have structured records, clear ownership boundaries, combat/exploration behavior, and no fabricated party state.

## Content

### Creator Tools

- Goal: Give creators structured ways to define campaign premises, constraints, reference material, and playable content.
- Dependencies: Campaign import, Director documents, Director Intelligence.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: Creator-authored structure is stored, validated, and honored by the Director without bypassing rules or persistence.

### World Builder

- Goal: Let creators build locations, regions, maps, factions, and discoverable world structure.
- Dependencies: Atlas, Living World, Creator Tools.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: World data is structured, editable, persisted, and rendered through existing Atlas/overworld patterns.

### Encounter Editor

- Goal: Let creators define enemies, triggers, rewards, and encounter conditions.
- Dependencies: Combat, World Builder, Creator Tools.
- Status: Planned.
- Estimated complexity: Medium.
- Acceptance criteria: Encounters produce structured combat inputs and rewards; AI narration cannot invent encounter mechanics.

### Quest Builder

- Goal: Let creators define quest arcs, objectives, dependencies, and completion conditions.
- Dependencies: DirectorConfig active threads, Creator Tools, Living World.
- Status: Planned.
- Estimated complexity: Medium.
- Acceptance criteria: Quests are structured, visible, update through approved flows, and remain distinct from freeform narration.

### Asset Pipeline

- Goal: Support safe ingestion and use of portraits, sprites, maps, audio, and environment assets.
- Dependencies: Pixel UI, World Renderer, Audio Polish, storage rules.
- Status: Partial.
- Estimated complexity: High.
- Acceptance criteria: Asset slots, validation, storage, attribution/licensing guidance, fallbacks, and runtime loading are documented and tested.

## Online

### Multiplayer

- Goal: Support multiple players in shared campaigns with clear turn/session authority.
- Dependencies: Cloud persistence, auth, rules engine, session model.
- Status: Planned.
- Estimated complexity: Very high.
- Acceptance criteria: Multi-user ownership, session participation, conflict handling, and shared state updates are secure and deterministic.

### Cloud Saves

- Goal: Make campaign continuity reliable across devices and sessions.
- Dependencies: Supabase persistence, auth, deployment.
- Status: Partial.
- Estimated complexity: Medium.
- Acceptance criteria: Saves are durable, resumable, clearly communicated, and recoverable after refresh/login/logout.

### Sharing

- Goal: Let users share characters, campaigns, worlds, or public play links safely.
- Dependencies: Auth, permissions, Creator Tools, Cloud Saves.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: Shared resources have explicit permissions, no secret leakage, and clean import/fork paths.

### Community Worlds

- Goal: Support browsing, publishing, and playing community-created worlds.
- Dependencies: Sharing, Creator Tools, World Builder, moderation strategy.
- Status: Planned.
- Estimated complexity: Very high.
- Acceptance criteria: Published worlds are versioned, attributable, safe to load, and separated from private campaign state.

## Release

### Public Alpha

- Goal: Ship a playable solo alpha for outside testers with honest limitations and safe production configuration.
- Dependencies: Core gameplay loop, combat, persistence, auth, pixel UI, deployment checklist.
- Status: In progress.
- Estimated complexity: High.
- Acceptance criteria: Public alpha checklist passes, production env is configured, known limitations are documented, and a fresh tester can complete a session.

### Beta

- Goal: Stabilize the expanded feature set for a broader audience.
- Dependencies: Public Alpha feedback, Living World or scoped equivalent, Creator Tools decision, monitoring.
- Status: Planned.
- Estimated complexity: High.
- Acceptance criteria: Regression suite passes, onboarding is clear, major data-loss risks are addressed, and feedback loops are operational.

### Launch

- Goal: Release Chronicle AI as a stable product with clear positioning, reliability, and support expectations.
- Dependencies: Beta, operational monitoring, legal/policy pages, release notes, rollback plan.
- Status: Planned.
- Estimated complexity: Very high.
- Acceptance criteria: Launch checklist passes, production metrics are monitored, support path exists, and the product can be maintained beyond launch week.
