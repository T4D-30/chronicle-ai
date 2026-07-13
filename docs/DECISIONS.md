# Chronicle AI Decisions

This append-only log records why major architectural decisions were made. It prevents future sessions from reintroducing rejected approaches or parallel systems. Do not rewrite history; if a decision becomes obsolete, mark it superseded and reference the replacing decision.

# Decision
Date: 2026-07-13
Status: Active
Area: Core architecture
Decision: Chronicle AI follows the rule: AI proposes; rules engine resolves; database remembers.
Reasoning: The project needs rich narration without letting probabilistic prose become the authority for gameplay, state, or persistence.
Alternatives Considered: Letting the AI act as the complete game master; letting frontend state decide outcomes; storing only prose transcripts.
Consequences: Every feature must identify which subsystem proposes, resolves, and remembers before implementation begins.
Related Files: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATE.md`

# Decision
Date: 2026-07-13
Status: Active
Area: Persistence
Decision: Supabase is the single source of truth for durable game state.
Reasoning: Campaign continuity requires authoritative storage for characters, campaigns, sessions, turns, world state, Director config, and documents.
Alternatives Considered: Browser-only saves; AI memory as source of truth; duplicated local stores that later sync to the database.
Consequences: Durable state changes must flow through service/controller paths and be recoverable after refresh, login, or a new session.
Related Files: `docs/ARCHITECTURE.md`, `src/lib/supabase/*`, `src/types/campaign.ts`

# Decision
Date: 2026-07-13
Status: Active
Area: Rules and AI boundaries
Decision: AI never determines mechanical outcomes.
Reasoning: Trustworthy tabletop play depends on auditable dice, modifiers, conditions, combat, HP, XP, and rewards.
Alternatives Considered: Asking the AI to decide success/failure; parsing AI narration for mechanics; allowing AI to override a poor mechanical result for drama.
Consequences: AI output may describe resolved facts, but mechanical changes must come from deterministic rules and approved persistence flows.
Related Files: `docs/ARCHITECTURE.md`, `src/lib/engine/*`, `src/lib/ai/*`

# Decision
Date: 2026-07-13
Status: Active
Area: Presentation boundaries
Decision: Presentation may read state but never owns or mutates authoritative game state directly.
Reasoning: UI needs temporary interaction state, but gameplay facts must not split into competing truths between components and persistence.
Alternatives Considered: Letting screens write directly to Supabase; keeping shadow gameplay state in component state; treating animation state as gameplay state.
Consequences: Components submit intent through existing actions/services; local state is limited to presentation concerns such as camera, menus, dialogue windows, and transitions.
Related Files: `docs/ARCHITECTURE.md`, `docs/UI_VISION.md`, `src/components/adventure/*`

# Decision
Date: 2026-07-13
Status: Active
Area: World presentation
Decision: WorldRenderer exists to separate presentation from gameplay.
Reasoning: ChronAI needs a consistent world-first visual layer without each screen inventing its own scenery or implying untracked game facts.
Alternatives Considered: Hand-rolling backgrounds per page; using decorative world effects in gameplay without state support; coupling scene rendering to rules logic.
Consequences: World visuals should be reusable, state-aware when needed, and neutral when no real state exists.
Related Files: `docs/UI_VISION.md`, `docs/ARCHITECTURE.md`, `src/components/pixel/WorldRenderer.tsx`

# Decision
Date: 2026-07-13
Status: Active
Area: Overworld
Decision: Overworld movement is presentation-only until committed through existing controller actions.
Reasoning: Tile position helps the player navigate the scene, but persistent campaign changes should happen only through meaningful interactions, exits, or encounters.
Alternatives Considered: Persisting every tile step; giving overworld maps direct database writes; creating a separate overworld state machine for gameplay outcomes.
Consequences: Movement, camera, and collision stay local; interact/exit intents call `submitAction`; encounter intents call `startCombat`.
Related Files: `docs/ARCHITECTURE.md`, `src/components/adventure/overworld/*`

# Decision
Date: 2026-07-13
Status: Active
Area: Adventure orchestration
Decision: Adventure Controller orchestrates but does not contain business logic.
Reasoning: Keeping orchestration separate from rules, narration, persistence, and presentation prevents a single layer from becoming an untestable authority.
Alternatives Considered: Putting rules in the controller; letting the AI Director orchestrate state; letting UI components sequence persistence and narration themselves.
Consequences: The controller determines order and handoff, while rules, AI, persistence, and UI remain independently owned.
Related Files: `docs/ARCHITECTURE.md`, `docs/architecture/adventure-controller.md`, `src/components/adventure/useAdventureSession.ts`

# Decision
Date: 2026-07-13
Status: Active
Area: Determinism
Decision: Deterministic engine behavior always takes priority over AI narration.
Reasoning: If narration and mechanics disagree, the player must be able to trust the mechanical record.
Alternatives Considered: Allowing AI to soften failures, reinterpret rolls, or retroactively change outcomes for story flow.
Consequences: Bugs where prose contradicts resolved mechanics should be fixed by constraining prompts, parsing, or presentation, not by weakening the engine.
Related Files: `docs/ARCHITECTURE.md`, `src/lib/engine/*`, `supabase/functions/narrate/index.ts`

# Decision
Date: 2026-07-13
Status: Active
Area: Maintainability
Decision: Existing architecture is extended instead of creating parallel systems.
Reasoning: Long-lived development requires recognizable ownership boundaries and reusable patterns across phases.
Alternatives Considered: Building feature-specific controllers, duplicate review flows, separate combat systems, or one-off UI frameworks for each milestone.
Consequences: New work must first look for the existing owner, helper, service, component, or contract to extend; parallel systems require explicit approval.
Related Files: `AGENTS.md`, `CODEX.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`
