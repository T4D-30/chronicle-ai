# Chronicle AI

An AI-powered solo tabletop RPG web application. The player explores a narrative-driven adventure where every action is resolved through real D&D 5e-adjacent dice mechanics and AI-generated narration. The AI acts as a structured Game Director — not a chatbot, but a narrative engine with memory, consistency, and dramatic intent.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript 5 + Vite 5 + Tailwind 3 |
| Backend / Auth / DB | Supabase (PostgreSQL + Row Level Security) |
| AI Narration | OpenAI via Supabase Edge Function |
| Testing | Vitest + React Testing Library |
| Deployment | Vercel (frontend) + Supabase (backend) |

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20.x+ |
| npm | 10.x+ |
| Supabase CLI | latest — `npm i -g supabase` |

### Local development

```bash
# 1. Clone and install
git clone <your-repo-url>
cd chronicle-ai
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start local Supabase (Docker required) and apply migrations
supabase start
supabase db push

# 4. Set OpenAI API key for AI narration (Edge Function secret — never in .env)
supabase secrets set OPENAI_API_KEY=sk-...

# 5. Start dev server
npm run dev
# → http://localhost:5173
```

No Docker? See [docs/SETUP.md](docs/SETUP.md) for the bare-Postgres fallback for local dev.

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + production bundle |
| `npm run build:check` | Production build with all feature flags explicitly set to production values |
| `npm test` | Unit tests (Vitest, 1995 tests) |
| `npm run test:integration` | Integration tests against real PostgreSQL |
| `npm run db:test:setup` | Create and migrate local test database |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## Project Structure

```
chronicle-ai/
├── .github/workflows/ci.yml   # CI: TypeScript → tests → build → bundle scan
├── docs/
│   ├── CHRONICLE_CONSTITUTION.md  # Design principles and constraints
│   ├── CHRONICLE_GAME_LOOP.md     # Phase implementation tracking
│   ├── DEPLOYMENT.md              # Full deployment guide
│   ├── RELEASE_CHECKLIST.md       # Pre-launch verification checklist
│   ├── ROADMAP.md                 # Phase history and MVP status
│   ├── SETUP.md                   # Detailed local setup guide
│   ├── SOAK_TEST_8_2A.md          # Production soak test plan
│   └── STYLE_GUIDE.md             # UI/UX design system reference
├── src/
│   ├── app/
│   │   ├── pages/             # Route-level page components
│   │   └── routes/            # React Router config (lazy-loaded)
│   ├── components/
│   │   ├── adventure/         # AdventureHub, overworld (StoryHud, ActionStrip), panels
│   │   ├── auth/              # Auth forms
│   │   ├── campaign/          # Campaign wizard steps
│   │   ├── character/         # Character wizard + sheet tabs
│   │   ├── layout/            # AppShell, ErrorBoundary, ProtectedRoute
│   │   ├── pixel/             # Retro pixel UI: PixelPanel, PixelBar, audio settings
│   │   └── ui/                # Button, Input, Skeleton, LoadingSpinner…
│   ├── lib/
│   │   ├── ai/                # Prompt builder, narrator, director
│   │   ├── audio/             # Manifest-driven audio framework (music/ambience/sfx)
│   │   ├── engine/            # Resolution engine (dice, checks, combat, XP)
│   │   └── supabase/          # Client + service layer (campaigns, sessions…)
│   └── types/                 # Domain types + supabase-generated.ts
├── public/
│   ├── audio/                 # Audio assets (ships empty — see README inside)
│   └── assets/sprites/        # Pixel art assets (ships empty — see README inside)
├── supabase/
│   ├── functions/narrate/     # Edge Function — OpenAI streaming narration
│   └── migrations/            # 0001–0005 SQL migrations
├── tests/
│   ├── unit/                  # 87 test files, 1995 tests
│   └── integration/           # Real-PostgreSQL service layer tests
├── vercel.json                # SPA routing + security headers + asset caching
└── .env.example               # Environment variable reference
```

---

## Environment Variables

**Client-side** (set in Vercel / hosting provider):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| `VITE_APP_ENV` | `development` or `production` |
| `VITE_ENABLE_DEBUG_PANEL` | `false` in production |
| `VITE_ENABLE_DEV_TOOLS` | `false` in production (reserved) |
| `VITE_ENABLE_MOCK_AI` | `false` in production |

**Server-side** (Supabase Edge Function secrets — **never** in hosting provider):

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — `supabase secrets set OPENAI_API_KEY=...` |
| `AI_MAX_TOKENS` | Max tokens per call (default: 4096) |
| `AI_MAX_REQUESTS_PER_USER_PER_MINUTE` | Rate limit (default: 10) |

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide. Quick path:

```bash
# 1. Create Supabase production project and apply migrations
supabase link --project-ref <ref>
supabase db push
supabase functions deploy narrate
supabase secrets set OPENAI_API_KEY=sk-...

# 2. Deploy to Vercel
vercel --prod
```

Full pre-launch checklist: [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)

---

## Architecture Notes

**Engine is deterministic.** The `src/lib/engine/` layer resolves all dice rolls, skill checks, combat rounds, XP, and HP changes. The AI receives outcomes, not inputs — it narrates what happened, never decides it.

**Full dice transparency (Phase 9.3).** Exploration actions that call for a real skill (sneaking, forcing something open, persuading, investigating, etc.) roll a real, deterministic check via `resolveCharacterAction` — the same 8-stage modifier pipeline combat uses — before the Director ever narrates. Pure narration, dialogue, and movement don't roll; only actions `classifyAction` recognizes as a real category do. The Director receives the exact resolved result in its prompt and is instructed to narrate it faithfully — never invent a different outcome, never re-roll, never soften a failure.

**AI narration is streaming.** The `narrate` Supabase Edge Function calls OpenAI's API with streaming enabled. Text tokens arrive in the browser via a `ReadableStream` and render progressively.

**The Story HUD and Action Strip own player input.** On the unified Adventure screen, `StoryHud` handles typed free-form actions, the Director's suggested-action chips, and NPC dialogue responses, while `ActionStrip` offers contextual verbs for whatever the player faces (Talk/Inspect/Collect/Enter) plus Rest and Menu. Every path calls `submitAction(text)` — one grounding contract; combat has its own action menu inside `CombatPanel`.

**Retro pixel presentation layer (Phase 9.0 → 9.1).** Pixel fonts (Press Start 2P / VT323), GBA-style pixel borders and buttons, animated HP bars, floating damage numbers, ambient particles (fireflies/rain/snow/fog), and a manifest-driven audio framework with music/ambience/sfx channels. Phase 9.1 wired this toolkit into the actual gameplay screens: the Adventure Hub gained a third "world status" column and a mounted `AudioManager`; combat now spawns real damage popups and a crit-flash from the engine's own `AttackResult`; Character Sheet, cards, Atlas, Journal, and the Landing Page all carry the pixel treatment. All presentation-only — engine, schema, and AI narration are untouched. Ships with zero copyrighted assets — drop royalty-free files into `public/audio/` and `public/assets/sprites/` to activate. Fully suppressed under `prefers-reduced-motion`.

**World status shows only real data — and that real data keeps growing.** The UI only ever renders real `WorldState` fields: locations, NPCs, factions, Director-set `worldTime`, and (as of Phase 9.2) the player's actual current location, resolved against known locations and never guessed. It still does not show weather, day/night, or NPC relationships/reputation scores — those aren't in the data model yet. See `docs/ROADMAP.md` Phase 9.2/9.3 for what's real now, and Phase 10 for the remaining data model work.

**Quest Log and Codex are real, not stubs (Phase 9.2).** Both render live `DirectorConfig` fields (`activeThreads`, `npcMemory`) that existed on the schema since Phase 2.2 but were never populated until this phase. Empty until the Director actually records something — no placeholder content.

**Character import is a real pipeline with an honest, extraction-free provider (Phase 10.1).** `src/lib/import/` defines a `CharacterImportProvider` interface any future OCR/Vision backend can implement; the only shipped provider (`ManualEntryProvider`) validates the file and returns an empty result, asking the player to fill in every field themselves on the review screen. The upload page hands its result straight into the **existing** `CharacterWizard` (via new optional `initialDraft`/`initialStep` props), landing on Review — there is no second, parallel review UI. Swapping in a real provider later requires changing exactly one function (`getActiveImportProvider()`); nothing else in the app changes.

**Campaign import (Phase 10.2) is the same architecture, applied to campaigns.** `src/lib/campaignImport/` mirrors `src/lib/import/` field-for-field — `CampaignImportProvider`, `ManualCampaignEntryProvider`, `getActiveCampaignImportProvider()`. Accepts PDF, DOCX, TXT, Markdown, and JSON (with a MIME-sniffing fallback for `.md` files browsers commonly misreport). Hands off into the existing `CampaignWizard` the same way. A campaign import still requires a character to be assigned before saving — the same real validation every campaign has always had; import cannot pre-fill this since it has no character context.

**Director Document Upload is a real, complete pipeline (Phase 10.3, real text extraction added Phase 10.4) — upload, storage, extraction, retrieval, and Director integration.** Players upload reference documents (DM guides, campaign bibles, homebrew rules, world lore) via `DirectorDocumentsPanel` on the campaign detail page; files are stored in a private Supabase Storage bucket with metadata in `director_documents` (migration 0006). `TextExtractionParser` (`src/lib/directorDocuments/textExtractionParser.ts`) now extracts real text client-side: TXT/Markdown via `FileReader`, PDF via Mozilla's `pdfjs-dist`, DOCX via `mammoth` — no external API call, no OpenAI Vision. A document is only marked `is_indexed: true` once real text was actually extracted; extraction failures (a scanned/image-only PDF, a corrupt file) degrade gracefully to an honest "not indexed yet" state, surfaced to the player as a distinct warning rather than an error. Every exploration turn retrieves relevant excerpts via a swappable `DocumentRetriever` — the shipped `FullTextRetriever` uses real Postgres full-text search (`ts_rank`/`ts_headline`, verified against a real local database, unchanged by the extraction work) — and injects them into the Director's prompt as background knowledge it can draw on naturally, never quote verbatim. The original extraction-free `ManualDocumentParser` remains in the codebase as a documented fallback/reference implementation. See `docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md`.

**Google Sign-In is fully implemented and tested, with one honest gap: it has never been run against a real Google consent screen (Phase 10.5).** `GoogleSignInButton` (used on both `/login` and `/signup`) calls `authService.signInWithGoogle()`, a thin, tested wrapper around `supabase-js`'s standard `signInWithOAuth()` — a redirect-based flow, not a popup. `AuthCallbackPage` (`/auth/callback`, deliberately a standalone route outside `PublicRoute`/`ProtectedRoute` so it controls its own redirect timing) handles the landing: it does not manually exchange the OAuth code — `detectSessionInUrl: true` (already configured in `client.ts`) means `supabase-js` does that automatically before `authStore`'s `getSession()` call ever resolves. The callback page independently checks the URL for `error`/`error_description` (both query string and hash fragment) since the client's own internal error handling doesn't propagate to application code, and has a 15-second stall-detection timeout as a safety net. First-time Google sign-in provisions a `profiles` row automatically via the same `handle_new_user()` trigger email/password sign-up already used (migration `0007_google_oauth_provisioning.sql` extended it to also read Google's `full_name`/`avatar_url` metadata keys) — verified against a real local Postgres database, including that repeated Google logins never create duplicate profiles and that RLS applies identically regardless of sign-up method. The one thing genuinely unverified: the live round-trip through Google's actual OAuth consent screen, which needs real Google Cloud + Supabase dashboard credentials this environment cannot provide — see `docs/DEPLOYMENT.md`'s "Google OAuth Setup" section for the exact manual steps.

**The Adventure Hub is one unified screen (Unified Adventure Screen), built entirely as a presentation layer over the existing, unmodified engine/AI Director/session state.** `OverworldMode` is the always-mounted primary surface (playable map, NPCs, exits, encounters); `StoryHud` docks story and dialogue over the world; `ActionStrip` offers contextual actions; and `PauseMenu` opens every panel — Character, Dice, Journal, Quests, Atlas, Codex, Settings, flagged Debug — as an overlay over the frozen world, reachable from both the bottom tab nav and Esc. `AdventureHub` coordinates the screen and the combat handoff (`CombatPanel` swaps in during combat and returns to the exact tile and facing). None of this touches game logic: every intent flows through the same `AdventureActions` (`submitAction`/`startCombat`) contract. The earlier 3-column dashboard (Phase 11) and its components were superseded and removed by the unified-screen cleanup.

**Debug panel is code-gated.** `VITE_ENABLE_DEBUG_PANEL=true` is required at build time to include the Debug tab in the Adventure Hub. When unset (the default), the tab is absent from the DOM and the component is tree-shaken from the production bundle.

---

## Known Limitations (Alpha)

See [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) for the full, current list with detail on what's real vs. deferred. Summary:

- **No multiplayer**: Single-player only
- **Pixel art & audio assets**: Framework ships asset-ready but empty (no copyrighted content); add royalty-free files to activate
- **Equipment paper-doll / inventory grid**: Equipment and Inventory tabs are pixel-skinned but still list/form-based, not a spatial layout — that's a functional redesign, deferred
- **World weather, day/night, NPC relationships/reputation**: Not shown anywhere yet — the underlying data model doesn't exist (Phase 10 Living World foundation)
- **Character import OCR/Vision extraction**: the full upload → review → save pipeline is real (Phase 10.1); only a manual-entry fallback provider ships — no file content is actually parsed yet. See `docs/KNOWN_LIMITATIONS.md` for the swap-point architecture.
- **Google Sign-In**: Fully implemented (Phase 10.5) — real OAuth flow, session persistence, automatic profile provisioning, error handling for cancellation/network/expired-session cases, all unit- and integration-tested. Live verification against a real Google OAuth consent screen requires manual Google Cloud + Supabase dashboard configuration this environment cannot provide — see `docs/DEPLOYMENT.md`'s "Google OAuth Setup" section.
- **Real text extraction for Character Import and Campaign Import**: both still ship exactly one honest, extraction-free provider each (Phase 10.1/10.2) — no file content is read yet for either. Director Document Upload's equivalent gap was closed in Phase 10.4 (see below); Character/Campaign Import's manual-entry-only providers are unchanged, deferred to their own future pass with real OCR/Vision credentials.
- **Real text extraction for Director Document Upload (Phase 10.4)**: closed. `TextExtractionParser` extracts real text for TXT/Markdown (`FileReader`), PDF (`pdfjs-dist`), and DOCX (`mammoth`) — entirely client-side, no external API, no OpenAI Vision. See `docs/KNOWN_LIMITATIONS.md` for one honest, narrow gap in this pass's own test coverage (a jsdom-only module-resolution quirk affecting one test scenario, not the shipped code).
- **Skill-check classification is keyword-based**: which exploration actions trigger a dice roll is decided by keyword matching, not AI-adjudicated intent — see `docs/KNOWN_LIMITATIONS.md`

---

## Documentation

| Document | Purpose |
|---|---|
| [CHRONICLE_CONSTITUTION.md](docs/CHRONICLE_CONSTITUTION.md) | Design principles — all decisions must align with this |
| [CHRONICLE_GAME_LOOP.md](docs/CHRONICLE_GAME_LOOP.md) | Phase implementation status tracking table |
| [ROADMAP.md](docs/ROADMAP.md) | Full phase history + MVP checklist |
| [SETUP.md](docs/SETUP.md) | Detailed local development setup |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [PUBLIC_TEST_PLAY.md](docs/PUBLIC_TEST_PLAY.md) | Linear go-live checklist for a first public playtest deploy |
| [PUBLIC_ALPHA_CHECKLIST.md](docs/PUBLIC_ALPHA_CHECKLIST.md) | Go/no-go checklist for the current public solo alpha |
| [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Honest current-state accounting of what's real vs. deferred |
| [FIRST_PLAY_GUIDE.md](docs/FIRST_PLAY_GUIDE.md) | Player-facing first-session walkthrough |
| [RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) | 10-section pre-launch verification checklist |
| [SOAK_TEST_8_2A.md](docs/SOAK_TEST_8_2A.md) | Annotated 2–4 hour production soak test plan |
| [STYLE_GUIDE.md](docs/STYLE_GUIDE.md) | UI/UX design system and component conventions |
| [docs/design/](docs/design/DIRECTOR_BIBLE.md) | Authoritative design references (Director Bible, Living World, Reputation, NPC/Legacy, Campaign/Chronicle Modes) — see `docs/design/DIRECTOR_BIBLE.md` for the index |
| [docs/specs/](docs/specs/PHASE_10_DIRECTOR_INTELLIGENCE.md) | Implementation-ready engineering specs for Phases 10–13 (not yet built — specification only) |
