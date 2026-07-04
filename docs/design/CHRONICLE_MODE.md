# Chronicle AI — Chronicle Mode Specification

*Elaborates [`DIRECTOR_BIBLE.md`](DIRECTOR_BIBLE.md) §10. This is the mode the product is named after — the ambitious long-term vision. Status: 📐 entirely unimplemented; has real dependencies on other unimplemented systems.*

---

## What Chronicle Mode Is

No fixed campaign boundary, no `hiddenArc` that resolves and ends. The character's entire life is the campaign. The world persists across *years* of in-game time (via the `WorldClock` structured time model specified in `LIVING_WORLD.md`). The player pursues long-horizon goals that don't fit inside a bounded adventure premise: business ownership, guild membership or founding, home ownership, involvement in kingdom-level politics, training/mastery arcs toward genuine expertise, marriage and family, taking on apprentices, building reputation deliberately over time, cultivating or resolving rivalries, and leaving a legacy that outlasts any single "quest."

This is explicitly the opposite design shape from Campaign Mode (`CAMPAIGN_MODE.md`): Campaign Mode is bounded and concludes; Chronicle Mode is open-ended and, by design, may never conclude — it ends when the player decides to stop, not when a plot resolves.

---

## Hard Dependency Chain

Chronicle Mode is not implementable as a standalone feature. It is the *combination* of every other 📐 system in this document set, applied without a boundary:

```
LIVING_WORLD.md (WorldClock, scheduled events, off-screen evolution)
        ↓ required for
REPUTATION_SYSTEM.md (reputation persisting/spreading over years, not sessions)
        ↓ required for
NPC_SYSTEM.md Legacy system (NPCs whose arcs span years — a rescued child
        growing up is a Chronicle Mode example specifically because it
        needs multi-year off-screen development)
        ↓ combined, required for
CHRONICLE_MODE.md (this document) — the mode that actually exercises all
        three at once, over an unbounded timeframe
```

**Practical implication for sequencing:** do not attempt to build Chronicle Mode before Living World, Reputation, and Legacy are real. Attempting it earlier would mean either faking the underlying systems (which this project's established discipline explicitly forbids — see every "no fake data" note throughout Phase 9.2/9.3) or building a shallow version that would need to be rebuilt once the real systems exist. See `PUBLIC_ALPHA_ROADMAP.md` for the phase ordering this implies.

---

## What's Different From Campaign Mode, Concretely

| Aspect | Campaign Mode | Chronicle Mode |
|---|---|---|
| `hiddenArc` | Defines the campaign's secret plot; resolves by campaign end | Not a single arc — the Director may run multiple concurrent, independent threads (a business venture, a rivalry, a family matter) with no expectation any of them "conclude the campaign" |
| Location scope | Bounded to what the premise implies | Effectively unbounded — the character's whole life may span many settlements over years |
| Time scale | A session, a short arc — days to weeks of in-game time typically | Years of in-game time; `WorldClock.day` genuinely matters and gets large |
| NPC relationships | Support the campaign's story | Can be primary content — a Chronicle Mode player might spend real sessions purely on relationship/reputation/business play with no "adventure" framing at all |
| Ending | Expected, Director steers toward it | Not expected; player-initiated only |

---

## Long-Term Goal Categories (📐 design reference for the Director, not a rigid checklist)

These aren't separate subsystems each needing their own spec — they're all expressions of the same underlying machinery (Living World scheduled events + Reputation + Legacy + ordinary Director narration), described here so a future Director prompt has concrete, varied examples to draw from rather than only abstract instructions:

- **Business/trade** — ownership tracked as a `properties` flag on a `LocationState` (already-existing field, e.g. `{ ownedBy: characterId }`), success/failure narrated via ordinary Director judgment informed by reputation and player choices, no new economic simulation required (see `LIVING_WORLD.md`'s explicit "not modeled" section)
- **Guilds/factions** — uses existing `FactionState`, extended by Reputation System's dynamic standing updates; founding a *new* faction is a larger, currently unspecified case — flagged here as an open question for whoever implements this, not resolved in this pass
- **Property/home** — same `properties`-flag mechanism as business ownership
- **Political involvement** — primarily a Legacy/Reputation expression (political rivals and allies are exactly what `NPC_SYSTEM.md`'s Legacy system already models)
- **Training/mastery** — character level progression already exists (Phase 9.2 level-up); a Chronicle Mode training arc is Director-narrated flavor around the same existing XP/level mechanism, not a new progression system
- **Marriage/family/apprentices** — new NPC relationship types, modeled as an extension of `NpcMemoryEntry`/Legacy rather than a wholly new system — likely just new `LegacyRelationship` values (`'spouse'`, `'apprentice'`, `'child'`) added to the enum already specified in `NPC_SYSTEM.md`

---

## Explicitly Out of Scope for This Document

- Any mechanical XP/leveling changes — Chronicle Mode uses the existing progression system unmodified
- A "generate a whole life story on campaign creation" feature — Chronicle Mode is meant to be played and discovered turn by turn, same as Campaign Mode, not pre-authored
- Multiplayer or shared-world Chronicle Mode — this project remains explicitly single-player (see `KNOWN_LIMITATIONS.md`)

---

## Implementation Checklist (Phase 10.3 — see `PUBLIC_ALPHA_ROADMAP.md`; sequenced after 10.1/10.2)

- [ ] Confirm `LIVING_WORLD.md` and `REPUTATION_SYSTEM.md` are implemented first — this phase has no independent value without them
- [ ] Add `'chronicle'` as a valid `WorldMode` value (type already specified in `CAMPAIGN_MODE.md`)
- [ ] Extend Edge Function prompt: branch on `worldMode === 'chronicle'` — remove the Campaign Mode boundary instructions, add long-horizon pacing guidance
- [ ] Extend `LegacyRelationship` enum with family/apprentice-style values if the marriage/apprentice goal category is prioritized
- [ ] Campaign creation wizard: Chronicle Mode likely skips or reframes `PremiseStep` (no fixed premise needed) — UI decision for implementation time
- [ ] No new persistence pattern needed — everything Chronicle Mode touches (`WorldState`, `DirectorConfig`) already has the additive JSONB storage pattern established since Phase 3

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
