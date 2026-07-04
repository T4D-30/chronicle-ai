# Phase 13 — Release Candidate: Engineering Specification

*Status: 📐 Not implemented — this is a verification/hardening phase, not a feature phase, so "implementation" here means process and checklist work, not new code, except where gaps are found.*

**Prerequisite:** Phases 10–12 (or whichever subset actually shipped — see `docs/design/PUBLIC_ALPHA_ROADMAP.md`) complete. This phase's job is to confirm the *combination* of everything shipped since the original public alpha (Phase 9.2/9.3) still holds together, not to build anything new by default.

---

## Goal

Take Chronicle AI from "public alpha" to "release candidate" — the point where the feature set is considered stable enough for a wider audience, not just early testers who've been told what's rough. This is explicitly a different bar than `PUBLIC_ALPHA_CHECKLIST.md`, which governs "ready for a stranger to solo-test," not "ready for general availability."

---

## 1. Full Regression Against the Expanded Feature Set

Re-run `docs/PUBLIC_ALPHA_CHECKLIST.md` in full, but treat every item added by Phases 10–12 as equally load-bearing as the original Phase 9.2/9.3 items — the checklist itself should be extended, not just re-run against its current form:

- [ ] Add Director Intelligence items (Phase 10): creative actions get a real challenge/explanation, never a flat refusal; location-weight narration is observably different between a minor and major location in a real playtest
- [ ] Add Living World items (Phase 11): a scheduled event fires and is narrated coherently; the world clock only advances on in-fiction time passing, verified by leaving a session open in real time without triggering clock advancement
- [ ] Add Creator Tools items (Phase 12), if shipped: a structured campaign definition is respected by the Director across a multi-turn session
- [ ] Add Reputation/Legacy items (Phase "12" per dependency-order roadmap — see numbering note in `PHASE_12_CREATOR_TOOLS.md`), if shipped: a spared NPC's later return is coherent with what actually happened; reputation-driven dialogue changes are observable

## 2. Documentation Sync

Every doc touched by Phase 9.2 onward needs a final consistency pass — this is the same discipline already established (`README.md`, `docs/ROADMAP.md`, `docs/CHRONICLE_GAME_LOOP.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/FIRST_PLAY_GUIDE.md` all cross-reference each other and must not contradict). Specific checks:

- [ ] Every `📐` marker in `docs/design/*.md` that shipped during Phases 10-12 is flipped to `✅`
- [ ] `docs/KNOWN_LIMITATIONS.md` reflects genuinely current limitations — remove anything that shipped, add anything newly discovered
- [ ] Test counts in `README.md` match the actual current suite size
- [ ] `docs/ROADMAP.md`'s phase history is append-only through this point — verify no historical entry was edited (a quick `git log` review if version control is in use, or a manual diff against the Phase 9.3 baseline otherwise)

## 3. Release Notes

New artifact for this phase — `docs/RELEASE_NOTES.md` (doesn't exist yet as of Phase 10.0). Structure recommendation:

```markdown
# Chronicle AI — Release Notes

## v0.2.0 (Release Candidate) — [date]

### New since Public Alpha
- [feature list, player-facing language, not engineering language]

### Known Limitations
- [pointer to KNOWN_LIMITATIONS.md, don't duplicate the full list here]

### Upgrade Notes
- [anything a returning alpha tester should know — e.g. "your existing
  campaigns will show a world clock starting at Day 1 retroactively"]
```

This is a genuinely new document type for the project — everything else has been engineering-facing (`ROADMAP.md`) or player-facing-but-instructional (`FIRST_PLAY_GUIDE.md`). Release notes are player-facing-and-celebratory, a different register. Keep it short.

## 4. Feature Matrix

Also new — a single-page, scannable "what works, what's planned" reference distinct from `KNOWN_LIMITATIONS.md`'s prose format. Recommend a table:

```markdown
| Feature | Status | Since |
|---|---|---|
| Character creation | ✅ | Phase 2.1 |
| Combat | ✅ | Phase 5 |
| Quest Log | ✅ | Phase 9.2 |
| Living World (scheduled events) | ✅ | Phase 11 |
| Reputation | ✅ | Phase 12 |
| Chronicle Mode | 🔲 | Planned |
| ... | | |
```

Could live at the top of `KNOWN_LIMITATIONS.md` as a new section, or as its own `docs/FEATURE_MATRIX.md` — recommend folding into `KNOWN_LIMITATIONS.md` to avoid yet another doc to keep synchronized; that file already tracks exactly this information in prose form today, a table is just a denser presentation of the same source of truth.

## 5. Performance & Load Verification

Not covered by unit/integration tests today. Recommend, if not already covered by `docs/SOAK_TEST_8_2A.md`:
- [ ] A long-session soak test (re-run `SOAK_TEST_8_2A.md`'s protocol) specifically exercising a session long enough to trigger multiple scheduled world events, to catch any performance degradation from the new `checkScheduledEvents` per-turn check (Phase 11) at scale
- [ ] Confirm `estimateRequestTokens` (`src/lib/ai/promptBuilder.ts`) growth is acceptable — every phase in this spec set adds prompt content (campaign scope, triggered events, reputation digests); verify the cumulative prompt size hasn't degraded latency or cost unacceptably. This function already exists and already accounts for the full request object automatically (confirmed in Phase 9.2) — no new code needed, just a review of its output at this point in the project's growth.

---

## Explicit Non-Goals

- No new gameplay features — if something's missing, it belongs in a numbered phase before this one, not folded in here
- No architecture changes — this phase is verification and documentation, consistent with every "preserve architecture" instruction across this project's history
- Chronicle Mode itself is NOT required to ship as part of Release Candidate — see `docs/design/PUBLIC_ALPHA_ROADMAP.md`'s note that it may follow as its own release

---

## Verification Commands (run in full, no shortcuts, this is the hardening phase)

```bash
npx tsc --noEmit
npm test
npm run build
npm run test:integration
```

All four, every time, for this phase specifically — even if a given change in isolation wouldn't strictly require the integration run under the normal Phase 9.2 rule ("run integration tests when persistence changes"), Release Candidate is exactly the point where "we're pretty sure it's fine" isn't a good enough bar.

---

## Exit Criteria

- [ ] Extended `PUBLIC_ALPHA_CHECKLIST.md` fully re-run and passing
- [ ] All design-doc 📐 markers reconciled with actual shipped state
- [ ] `docs/RELEASE_NOTES.md` created
- [ ] Feature matrix added (to `KNOWN_LIMITATIONS.md` or standalone — implementer's choice, documented either way)
- [ ] Soak test re-run and passing at the new feature scope
- [ ] All four verification commands clean

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
