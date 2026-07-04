# Chronicle AI — Game Design Reference

*What the game actually is, mechanically, today — grounded in the real engine and content, not aspiration. For narration philosophy see [`DIRECTOR_BIBLE.md`](DIRECTOR_BIBLE.md); for the underlying resolution math see the [Constitution](../CHRONICLE_CONSTITUTION.md)'s "Game Mechanics — North Star" section, which this document elaborates without contradicting.*

---

## Character Creation

Nine steps (`src/components/character/steps/`): Identity → Species → Class → Background → Ability Scores → Skills → Equipment → Portrait → Review.

### Classes (Archetypes)

Ten curated classes, each mapping to a real hit die via `ARCHETYPE_HIT_DIE` (`src/lib/engine/character.ts`) — this table is the single source of truth; the wizard's dropdown is generated *from* it, not maintained separately:

| Hit die | Classes |
|---|---|
| d12 | Barbarian, Berserker |
| d10 | Fighter, Ranger, Paladin |
| d8 | Cleric, Druid, Bard, Rogue |
| d6 | Wizard, Sorcerer |

**Design decision, load-bearing:** `archetype` is a free string in the engine, not a closed enum. The wizard curates a dropdown of the ten known values, but a player can type a custom class name (e.g. "Artificer," "Blood Hunter") and the engine gracefully defaults to a d8 hit die rather than rejecting it. This is intentional — see `characterContent.ts`'s own doc comment: *"curation for a good wizard experience, not a validation rule."* Any future class-specific mechanics (spell lists, class features) should preserve this openness rather than hard-gating on the ten known values.

### Species (Ancestry) and Background

Ten curated species options (human, elf, dwarf, halfling, half-elf, half-orc, gnome, dragonborn, tiefling, orc) and twelve curated backgrounds (soldier, scholar, criminal, noble, sailor, hermit, folk hero, acolyte, guild artisan, wanderer, outlander, entertainer).

**Both are currently flavor-only** — the engine treats them as free lowercase strings with no mechanical effect. This is explicitly documented in `characterContent.ts` as deferred to "a later volume," i.e. not an oversight, a known and intentional scope boundary. If ancestry/background gain mechanical weight (racial bonuses, background skill grants) in a future phase, that's new engine work, not a documentation gap to close now.

### Ability Scores

Point-buy across the standard six: STR, DEX, CON, INT, WIS, CHA. Modifier formula: `floor((score - 10) / 2)` — identical to the Constitution's stated formula, deliberately familiar to any D&D-experienced player.

---

## The Resolution System

Every mechanical outcome in the game — combat and exploration alike — resolves through the same core formula, implemented once in `src/lib/engine/`:

```
d20 + stat modifier + situational modifiers  vs.  DC
```

This is not duplicated logic between combat and exploration — `resolveCharacterAction` (exploration checks, wired in Phase 9.3) and the combat attack resolver both ultimately run through the same modifier-pipeline architecture (`pipeline.ts`), just with different inputs. See `DIRECTOR_BIBLE.md` §6 for the transparency guarantee this produces.

### Action Categories (Exploration Checks)

Player text is classified into one of six categories, each mapped to a governing stat (`src/lib/engine/intent.ts`):

| Category | Stat | Example actions |
|---|---|---|
| FORCE | STR | Smash, break, lift, push |
| FINESSE | DEX | Sneak, dodge, pick locks, acrobatics |
| ENDURE | CON | Resist, survive, march on |
| REASON | INT | Investigate, recall lore, solve, decipher |
| PERCEIVE | WIS | Notice, sense, read the room, survive wilderness |
| INFLUENCE | CHA | Persuade, deceive, intimidate, charm |

A seventh classification, `UNKNOWN`, is the deliberate no-roll case — pure narration, dialogue, or movement that doesn't classify into any of the above never triggers a mechanical check (Phase 9.3 design decision, see `DIRECTOR_BIBLE.md` §6). This keeps ordinary roleplay fluid while still rolling for anything that's actually a skill-shaped attempt.

### DC Tiers

Constitution-defined ladder, unchanged: Trivial 5 / Easy 10 / Medium 15 / Hard 20 / Legendary 25+. `classifyAction`/`parseAction` derive a `suggestedDc` from keyword-detected difficulty hints in the player's phrasing (e.g. "carefully" or "desperately" can bump the tier) — this is a heuristic, not AI judgment; see `KNOWN_LIMITATIONS.md` for its documented limits.

### Critical Results

Natural 20: extra benefit beyond the intended outcome. Natural 1: a complication, not just a plain failure — this rule is implemented in the engine's outcome ladder and is the mechanical anchor for `DIRECTOR_BIBLE.md` §4's broader "most failures create complications" narrative philosophy.

---

## Combat

Turn-based, initiative = d20 + DEX modifier. Presented as a JRPG-style battle screen (Phase 5) over the same D&D-adjacent mechanics used everywhere else — the Constitution's "visually presented as Pokémon/JRPG, mechanically resolved as D&D" principle, unchanged.

Action menu: Attack (with weapon submenu reading real equipped gear), Spell (submenu reading prepared spells, with an honest empty state and cantrip fallback when none are prepared), Item, Defend, Move, Flee — all implemented in `ActionBar.tsx` (Phase 8.3), all resolve through the same engine, all narrated by the Director after the fact, never before.

Damage numbers, crit flash, and animated HP bars (Phase 9.1) are pure presentation layered over real `AttackResult` data returned by the engine — see `CombatPanel.tsx`. The Director never sees or influences a combat roll; combat resolution is client-side and complete before any AI call happens for that exchange.

---

## Progression

Levels 1–20. XP thresholds are a fixed table (`XP_THRESHOLDS` in `src/lib/engine/combat.ts`), not AI-assigned — combat awards XP based on defeated enemies' stat blocks, deterministically.

**Level-up (Phase 9.2)** is a real, player-initiated action: a modal shows an exact before/after comparison (new max HP via `calculateMaxHp`, new proficiency bonus via `getProficiencyBonus`) computed from the same pure functions the rest of the app trusts, before the player confirms. Not automatic, not AI-narrated into existence — a deliberate UI action backed by deterministic math.

---

## What This Document Does Not Cover

- Narration philosophy and Director behavior rules → `DIRECTOR_BIBLE.md`
- World state, NPCs, factions, quests → `LIVING_WORLD.md`, `NPC_SYSTEM.md`
- The two world modes (bounded campaign vs. open-ended life sandbox) → `CAMPAIGN_MODE.md`, `CHRONICLE_MODE.md`
- What's shipped vs. planned, phase by phase → `PUBLIC_ALPHA_ROADMAP.md`

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
