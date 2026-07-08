# Chronicle AI — Known Limitations

Honest accounting of what works, what's partial, and what's not built.
Written for public alpha testers and anyone evaluating the codebase.
Nothing here is aspirational — every claim is checked against the actual
code, kept current through Phase 11.

---

## Fully working

- Character creation (9-step wizard), campaign creation (8-step wizard)
- **Character creation autosave/resume/cancel-confirm (Phase 10.1)**: the wizard autosaves to localStorage once meaningful content is entered, offers to resume an in-progress draft on return, and confirms before discarding unsaved work. Scoped per user, cleared automatically on successful save.
- **Character import pipeline architecture (Phase 10.1)**: upload a PDF/PNG/JPG → parses via a swappable `CharacterImportProvider` → confidence/notes summary → lands directly on the same Review step manual creation uses, prefilled → player corrects and confirms → saves through the exact same `createCharacter` path. The only shipped provider is a manual-entry fallback (extracts nothing, honest about it) — see the OCR/Vision limitation below.
- **Campaign import pipeline architecture (Phase 10.2)**: identical shape, applied to campaigns. Upload a PDF/DOCX/TXT/Markdown/JSON → `CampaignImportProvider` → lands on `CampaignWizard`'s Review step, prefilled → player corrects (including selecting a character, which import cannot pre-fill) → saves through `createCampaign`. Same manual-entry-only provider, same honesty about extracting nothing yet.
- **Director Document Upload (Phase 10.3, real text extraction added Phase 10.4)**: genuinely different from the two import pipelines above — not a one-time parse-to-draft, but persistent reference material (DM guides, campaign bibles, homebrew rules, world lore) the Director retrieves from on every future turn. Upload via `DirectorDocumentsPanel` on the campaign detail page → `TextExtractionParser` extracts real text (TXT/Markdown via `FileReader`, PDF via `pdfjs-dist`, DOCX via `mammoth`, all client-side, no external API) → stored in a private Supabase Storage bucket + `director_documents` table, with `is_indexed: true` set only after extraction genuinely succeeds → retrieved via real Postgres full-text search (`ts_rank`/`ts_headline`, verified against a real local database) → injected into the Director's prompt as background knowledge. The modular `DocumentRetriever` interface means a future embeddings-based retriever can replace full-text search without touching anything else. Extraction failure (a scanned/image-only PDF, a corrupt file) degrades gracefully — the document is still saved, just not searchable yet, and the player sees an honest warning rather than a silent failure or a crash. The original extraction-free `ManualDocumentParser` remains in the codebase as a documented fallback.
  - **A note on this feature's own test coverage**: one DOCX extraction scenario (the "happy path" — a well-formed DOCX successfully producing real text) could not be verified end-to-end inside this project's Vitest suite specifically, due to a jsdom/Node module-resolution quirk in a third-party library (`mammoth`'s CommonJS `require()` doesn't pick up its own browser-specific code path the way a real bundler does) — confirmed to be a test-tooling limitation, not a defect in the shipped parser, via direct verification of every step of the real extraction mechanism in isolation, and via a successful real production build. The TXT, Markdown, and PDF extraction paths, and the DOCX error-handling path, are all fully verified end-to-end. The full technical account is in `tests/unit/textExtractionParser.test.ts`'s own comments.
- Exploration turns with real streaming AI narration (OpenAI, server-side only)
- **Exploration dice checks**: actions that call for a real skill (sneaking, forcing something open, persuading, investigating, etc.) roll a real, deterministic check via the engine — the same modifier pipeline combat uses — before the Director ever narrates. Pure narration/dialogue/movement doesn't roll. The Director receives the exact result and is instructed to narrate it faithfully, never invent or override it.
- Combat: initiative, attack/damage rolls, death saves, XP, loot — all engine-resolved, AI narrates outcomes only
- Session persistence: pause/resume/refresh restore state correctly
- **Level-up**: real workflow — banner → modal with before/after stat preview computed from the actual engine functions → confirm → character updates. Not a stub.
- **Quest Log**: renders real Director-tracked plot threads (`DirectorConfig.activeThreads`). Empty until the Director actually records something — no placeholder quests.
- **Codex**: renders real NPC memory (`DirectorConfig.npcMemory`) — disposition, known facts, alive/deceased. Empty until an NPC is actually met.
- **Current location indicator**: shown in the world status sidebar when the Director has set a real `currentLocationId` that resolves against known locations. Never guessed.
- Atlas: location list/search/hierarchy (data-driven, not a rendered map — see below)
- Pixel UI: fonts, borders, animated HP/XP bars, damage numbers, crit flash, ambient particles, audio framework (music/ambience/sfx with context-aware track selection)

---

## Partial / real but limited

| Feature | What's real | What's missing |
|---|---|---|
| AI memory | Durable digests (active quests, known NPCs) now persist across the whole campaign, not just recent turns | Full turn-by-turn recall beyond ~8 turns is still not possible — the Director doesn't re-read old narration, only the compact digests |
| Inventory / Equipment | Real data, weight tracking, equip/unequip, pixel-skinned cards | Still list/form-based — no spatial grid or paper-doll layout |
| Save/load UX | Explicit "Progress saved" confirmation on pause | No autosave-in-progress indicator during normal play; relies on the same persistence as every other turn |
| Atlas | Real location data, search, hierarchy, breadcrumbs | No canvas rendering, no fog-of-war graphic, no map imagery — a location list, not a map |
| Ambient audio/particles | Framework wired into `AdventureHub`; combat/town/dungeon music selection is real, driven by actual `currentLocationId` and location `type` | Most `LocationType` values (region, building, floor, room, outdoor) have no exact audio-manifest match and fall back to the menu theme; weather-driven particles (rain/snow) don't trigger yet — no weather data exists |
| Exploration dice checks | The roll itself, the modifier pipeline, and the Director's obligation to narrate the exact result are all real and enforced | Which actions warrant a check is decided by keyword matching (`classifyAction` in `intent.ts`), not by the AI understanding intent — a cleverly-phrased action might dodge a check it should trigger, or an innocuous phrase might trigger one it shouldn't. This is a Phase 1.1-era heuristic, unchanged by this phase; only its *wiring* into exploration turns is new |
| Director Document retrieval | Real Postgres full-text search (`ts_rank`/`ts_headline`), verified end-to-end including RLS across users. Fails open — a retrieval error never blocks a turn. Documents ARE genuinely indexed now (Phase 10.4 real extraction). | Full-text search is keyword-based, not semantic — a query that doesn't share vocabulary with a relevant document won't find it even if the concepts are related. A document only becomes searchable if extraction actually succeeds — a scanned/image-only PDF or a corrupt file stays unindexed, surfaced to the player as an honest warning, not a silent failure. |
| Google Sign-In | Fully code-complete and tested (Phase 10.5): OAuth button, callback handling, session restoration, automatic profile provisioning (verified against real Postgres — no duplicate profiles across repeated logins, RLS applies identically to email/password and Google-provisioned profiles), logout, and error handling (cancellation, network failure, expired/stalled session) | The live round-trip through an actual Google OAuth consent screen has never been run — this environment has no Google Cloud project or Supabase dashboard access to create one. Every piece of code up to that boundary is built and tested against mocks/a real local database; only the final live handshake is unverified. See `docs/DEPLOYMENT.md`'s "Google OAuth Setup" section for the exact manual configuration a real deploy needs. |
| Adventure Hub (3-column redesign) | Left nav, center scene panel, and party status panel are real, additive UI reusing genuine data (real objectives, real world state, real XP/HP, real turn history) — verified not to touch any engine/Director/persistence logic (Phase 11) | Scene art is an honest placeholder (a location's real description text, or a generic message) — there is no image-generation system. Settings is a disabled placeholder — no settings page exists anywhere in the app yet. "Party" reflects Chronicle AI's actual single-character design; there is no multiplayer roster to display. |

---

## Not started this phase (explicitly deferred)

These were named in the Phase 9.2 request and intentionally left out to
avoid shipping eight shallow features instead of a few real ones:


- **Real text extraction for Character Import and Campaign Import** — both still ship exactly one honest, extraction-free provider each: `ManualEntryProvider` (Phase 10.1) and `ManualCampaignEntryProvider` (Phase 10.2). No file content is actually read by either yet. Each has its own documented swap point (`getActiveImportProvider()`, `getActiveCampaignImportProvider()`) so a real OCR/Vision provider can be dropped in later without touching UI, review flow, or the save path. Deferred to a future pass with real credentials, per explicit instruction.
- **Portrait auto-resize/compress/crop pipeline** — current upload is unprocessed; no client- or server-side image pipeline yet
- **Full visual pass** — Landing Page, Dashboard, and Campaign/Character Library got pixel treatment in Phase 9.1; Auth screens did not

---

## Architectural / long-standing

- **No multiplayer** — single-player only, by design for this alpha
- **No native mobile app** — responsive web only
- **World weather, day/night cycle, NPC relationships/reputation scores** — no data model exists yet. As of Phase 10.0 this has a full implementation-ready spec (`docs/design/LIVING_WORLD.md`, `docs/design/REPUTATION_SYSTEM.md`, `docs/design/NPC_SYSTEM.md`, `docs/specs/PHASE_11_LIVING_WORLD.md`) — specified, not built. Still a real limitation today.
- **No fog of war, map canvas, or token system** — Atlas is intentionally data-only

---

## A note on "AI memory"

This is the most commonly misunderstood limitation, so it's worth being
precise. Two different things are true at once:

1. **Long-campaign facts now persist correctly.** If the Director records a
   quest or meets an NPC, that fact is durable — it survives for the entire
   campaign, not just a few turns, because it's read from
   `DirectorConfig.activeThreads`/`npcMemory` on every single request,
   regardless of how long ago it was established.
2. **Narrative prose from old turns is still not re-read.** The Director
   sees the last ~4-8 turns of actual narration verbatim. A scene described
   30 turns ago is gone from its context — only the compact facts extracted
   into quests/NPC memory survive that far back. A full narrative-history
   memory system (embeddings, retrieval, summarization of prose) is future
   work, not part of this phase.

## A note on a benign test warning

Running the test suite prints two "Unhandled Rejection" console warnings
during the DOCX extraction tests
(`tests/unit/textExtractionParser.test.ts`). These do not affect the test
suite's pass/fail result — `npm test` exits successfully with every
assertion passing. The warning comes from a real, understood test-tooling
constraint (Vitest's CJS interop does not intercept an internal
`require()` call inside the `mammoth` package the way it intercepts ESM
imports) that only affects this specific test runner, not the actual
application — the real production build (`npm run build`) resolves
`mammoth` correctly via Vite's standard bundler-level "browser" field
handling. See `docs/ROADMAP.md`'s Phase 10.4 entry for the full
investigation and why this was left as documented, verified-safe test
noise rather than patched around.

---

*Last updated: Phase 11 — Adventure Hub UI Redesign*
