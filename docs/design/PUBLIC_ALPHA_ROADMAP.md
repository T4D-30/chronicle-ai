# Chronicle AI — Public Alpha Roadmap (Design-System Phases)

*Sequencing for the design-system work specified across this `docs/design/` set. This is distinct from [`docs/ROADMAP.md`](../ROADMAP.md) (the authoritative record of what's shipped) and [`docs/PUBLIC_ALPHA_CHECKLIST.md`](../PUBLIC_ALPHA_CHECKLIST.md) (the go/no-go launch checklist). This document answers: once alpha is live, in what order should the Director Bible's 📐 systems actually get built?*

**Nothing in this document is implemented.** It is a specification and sequencing plan only, produced during Phase 10.0. Full engineering specs for each phase below live in `docs/specs/` (see the Phase 10–13 spec documents).

---

## Why This Order

The dependency chain is real, not arbitrary — this is the same chain documented in `CHRONICLE_MODE.md`:

```
Living World (time model, scheduled events)
    ↓ enables
Reputation System (needs time to spread/decay meaningfully)
    ↓ combines with
Legacy/Nemesis (NPC_SYSTEM.md — needs both time AND reputation-like scoring)
    ↓ all three together enable
Chronicle Mode (the mode that actually exercises unbounded time + reputation + legacy)
```

Building any of these out of order means either faking a dependency (explicitly against this project's discipline) or building something that has to be substantially reworked once its real dependency exists. Sequence matters here more than usual.

---

## Phase 10 — Director Intelligence

*Full spec: `docs/specs/PHASE_10_DIRECTOR_INTELLIGENCE.md`*

Formalizing what the Director Bible locks in as actual prompt behavior, where it isn't already live. Phase 9.3 already shipped second-person narration, expand-not-invent, dice transparency, and hint escalation as real, tested prompt rules — Phase 10's job is the *remaining* Bible rules that are currently 📐 only:

- §9 "never flatly refuse" — creative-action handling as an explicit prompt rule
- §3 location-weight narration tiering (requires a `narrativeWeight` concept — see spec)
- §7 the narrow between-scenes DM voice (pause/end boundary only)
- §4 failure-as-complication as a more structured Director obligation (currently pure prose judgment)

This phase is prompt/spec work primarily, similar in shape to Phase 9.3 — low schema risk, most of the work is in `supabase/functions/narrate/index.ts` and its accompanying tests-by-manual-verification discipline (the Edge Function has no direct Vitest coverage; see `KNOWN_LIMITATIONS.md`).

---

## Phase 11 — Living World Foundation

*Full spec: `docs/specs/PHASE_11_LIVING_WORLD.md`, design doc: `LIVING_WORLD.md`*

The structured time model (`WorldClock`) and scheduled-event trigger mechanism. This is the actual prerequisite everything else in this roadmap depends on. Moderate schema risk (new additive fields, no migration required — same JSONB pattern as every Phase 9 addition) and moderate prompt-design risk (the "ambient drift must never contradict player-caused state" constraint flagged in `LIVING_WORLD.md` is the main open design question).

---

## Phase 12 — Reputation + Legacy System

*Full spec: `docs/specs/PHASE_12_REPUTATION_LEGACY.md`, design docs: `REPUTATION_SYSTEM.md`, `NPC_SYSTEM.md`*

Bundled into one phase because they share the same underlying mechanism (severity-scored events, off-screen development via Phase 11's scheduled events) and the same UI-surface open question (both likely extend the existing World Status sidebar / Codex pattern rather than needing new screens). Depends on Phase 11 being complete first.

Includes resolving the `NpcMemoryEntry.disposition` / `FactionState.standing` scale inconsistency flagged in `NPC_SYSTEM.md` — small, low-risk, but touches live Codex code and its tests, so it's sequenced as part of this phase rather than done ad hoc.

---

## Phase 13 — Creator Tools

*Full spec: `docs/specs/PHASE_13_CREATOR_TOOLS.md`*

Not previously named in any design doc up to this point — this is genuinely new scope, covering the Campaign Mode import/constraint system (`CAMPAIGN_MODE.md`'s "structured campaign definition" section) and any player-facing tools for authoring campaign content beyond the current freeform premise text. Depends on nothing above; could in principle run in parallel with Phase 11/12, sequenced last here because it's lower priority for the core Director-quality goals this roadmap is organized around.

---

## Phase 14 (unnamed, tentative) — Chronicle Mode

Not given its own numbered spec in this pass because it has no independent implementation content — see `CHRONICLE_MODE.md`'s dependency chain. Once Phases 11–12 are real, Chronicle Mode is primarily: add the `WorldMode` field (spec'd in `CAMPAIGN_MODE.md`), branch the Director prompt, and extend `LegacyRelationship` with family/apprentice-style values. Small phase, sequenced last because everything it needs must exist first.

---

## Release Candidate

*Full spec: `docs/specs/PHASE_13_RELEASE_CANDIDATE.md` — note: numbered as part of the Phase 13 spec set per the original request's phase list (Director Intelligence=10, Living World=11, Creator Tools=12, Release Candidate=13); this roadmap's Phase 12/13 numbering above reflects actual dependency order discovered during this design pass and intentionally differs from the request's nominal list — both orderings are reconciled in the spec documents themselves, see the note at the top of each.*

A hardening pass once the above systems are real: full regression of the Public Alpha Checklist against the expanded feature set, updated `KNOWN_LIMITATIONS.md`, and a decision point on whether Chronicle Mode ships in the same release or follows as its own.

---

## What Alpha Testers See in the Meantime

None of the above blocks the *current* public alpha. Everything specified in this `docs/design/` set is additive, future work — the alpha checklist (`PUBLIC_ALPHA_CHECKLIST.md`) governs what's required to launch *today's* feature set, unaffected by this roadmap.

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
