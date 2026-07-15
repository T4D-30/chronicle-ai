# Chronicle AI — Public Alpha Checklist

This is the go/no-go checklist for calling Chronicle AI ready for its
first public solo alpha test. It does **not** repeat deployment steps —
see [PUBLIC_TEST_PLAY.md](PUBLIC_TEST_PLAY.md) for the linear deploy path
and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the full production
readiness reference. This doc answers a narrower question: *is the game
itself ready for a stranger to play solo and have a good time?*

---

## 1. Core Loop — Must All Be True

- [x] Character creation completes end-to-end (9-step wizard)
- [x] Character creation is resilient — autosaves, offers resume on return, confirms before discarding unsaved progress (Phase 10.1)
- [x] Character import pipeline (upload → review → save) completes end-to-end using the manual-entry fallback provider — no OCR/Vision extraction yet, by design (Phase 10.1)
- [x] Campaign import pipeline (upload → review → save) completes end-to-end using the same manual-entry pattern — a campaign still requires a character assignment, which import cannot pre-fill (Phase 10.2)
- [x] Director Document Upload — campaign reference documents (DM guides, campaign bibles, homebrew rules, world lore) upload, extract real text (TXT/Markdown/PDF/DOCX, all client-side), index, and are retrieved by the Director via real Postgres full-text search during play (Phase 10.3 storage/retrieval/UI, Phase 10.4 real extraction)
- [x] Google Sign-In — OAuth flow, session persistence, automatic profile provisioning (no duplicates, verified against real Postgres), logout, and error handling are all code-complete and tested (Phase 10.5). The live round-trip through a real Google consent screen has not been run in this environment — see `docs/DEPLOYMENT.md`'s "Google OAuth Setup" section for the manual Google Cloud + Supabase dashboard configuration a real deploy needs before this is user-facing.
- [x] Campaign creation completes end-to-end (8-step wizard)
- [x] AI Director narrates real streaming responses (OpenAI, server-side only)
- [x] Combat is fully playable: initiative, attack, damage, death saves, XP, loot
- [x] Session persists correctly across pause/resume/refresh/browser close
- [x] Level-up is a real, completable action (not just a banner) — now with a celebration beat (Phase 10.1)
- [x] Quest Log shows real Director-tracked content, not placeholders
- [x] Codex shows real NPC memory, not placeholders
- [x] Exploration actions that call for a real skill check roll one deterministically before the Director narrates — full dice transparency, not just combat, and now visible to the player as a real popup (Phase 10.1)
- [x] Adventure Hub is the unified Adventure Screen: the playable world (World Layer) is the always-mounted primary surface, `StoryHud` docks story/dialogue over it, `ActionStrip` offers contextual actions (Talk/Inspect/Collect/Enter, Rest, Menu), and Character/Dice/Journal/Quests/Atlas/Codex/Settings open as pause-overlay panels from the bottom tab nav or Esc — every behavior (submit action, suggested actions, dice-backed resolution, combat entry and exact-position return, panel access) verified across desktop and 390×844 (originally the Phase 11 dashboard, recomposed by the Unified Adventure Screen milestone)

## 2. Test Coverage

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm test` — all unit tests pass
- [x] `npm run build` — clean production build
- [x] `npm run test:integration` — run and passing (70/70), re-verified as of Phase 9.3

> **Phase 9.2 note:** This phase added a field to `WorldState`
> (`currentLocationId`) and extended `worldStateUpdates`/
> `directorConfigUpdates` shapes, plus fixed a real bug in `updateCharacter`
> where a level-only patch didn't recalculate derived stats. These are
> additive JSONB changes with no migration required — `world_state` and
> `director_config` are unconstrained `jsonb` columns (see
> `supabase/migrations/0003_campaign_data.sql`). Because real persistence
> code paths changed (new `updateWorldState`/`updateDirectorConfig` call
> sites in the main turn flow, plus the `updateCharacter` fix), the full
> integration suite was run against a real local Postgres this phase rather
> than skipped — all 70 tests passed.

## 3. Pre-Launch Verification (run these yourself before opening access)

```bash
npx tsc --noEmit
npm test
npm run build
npm run test:integration   # sanity check — see note above
```

All four should be clean. If `test:integration` fails, do not launch —
investigate first; it means something in the live database path broke.

## 4. Infrastructure (see PUBLIC_TEST_PLAY.md for exact commands)

- [ ] Supabase production project created
- [ ] Database migrations pushed (`supabase db push`)
- [ ] `narrate` Edge Function deployed
- [ ] `OPENAI_API_KEY` set as a Supabase secret — **never** in Vercel
- [ ] Frontend deployed with all `VITE_*` variables set, debug flags `false`
- [ ] Supabase Auth redirect URLs configured for your actual deploy URL

## 5. Manual Playtest (do this yourself before inviting testers)

Play one full session, start to finish:

- [ ] Sign up, create a character, create a campaign
- [ ] Take 5+ exploration turns — confirm narration is coherent and matches your chosen tone
- [ ] Try an action that clearly calls for a skill check (e.g. "I try to sneak past the guards" or "I force the door open") — confirm the narration reflects an actual roll/outcome, not a vague non-committal result. Try a plain narration action too (e.g. "I greet the innkeeper") — confirm it does NOT trigger a mechanical roll.
- [ ] Trigger at least one combat encounter — confirm damage numbers, HP bars, and the victory screen all work
- [ ] Level up if you have the XP — confirm the before/after stats shown match reality after confirming
- [ ] Check the Quest Log and Codex — confirm they reflect what actually happened, not generic content
- [ ] Pause, refresh the browser, resume — confirm nothing was lost
- [ ] Check the world status sidebar — confirm turn count, tone, difficulty, and (if the Director set one) your current location are all accurate

## 6. Known Gaps — Communicate These, Don't Hide Them

Before inviting testers, make sure they see
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) or an equivalent summary.
Testers who know the AI's memory window and the current Inventory/Equipment
limitations going in give much more useful feedback than testers who
discover them as "bugs."

## 7. Feedback Loop

Decide before launch:

- [ ] Where does feedback go? (Discord, form, email, GitHub issues)
- [ ] Who's checking Supabase Edge Function logs for narration errors?
- [ ] What's the rollback plan if something breaks mid-alpha? (see `RELEASE_CHECKLIST.md` → Rollback Plan)

---

## Alpha Launch Sign-off

Only launch when sections 1–5 above are all checked. Section 6 and 7 are
process, not code — but skipping them turns a useful alpha into confused
bug reports.

---

*Last updated: Phase 11 — Adventure Hub UI Redesign*
