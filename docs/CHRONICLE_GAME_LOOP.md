# Chronicle AI — Game Loop Specification

*This document defines the authoritative game loop architecture. Implementation phases are tracked here.*

---

## Top-Level Loop

```
Player Opens App
  → Authenticate
  → Select/Create Campaign
    → Campaign has: World Seed, Director Config, Character, Atlas (maps)
  → Start Session
    → Session Loop:
        1. Player inputs action (text or action menu selection)
        2. Engine resolves action (dice + rules — deterministic)
        3. Director AI generates narration (Edge Function — streaming)
        4. State persists to Supabase
        5. UI updates (turn complete — panel state driven, not just prose)
        6. If combat triggered → enter Combat Mode
        7. Repeat until session ends
  → Session Summary
  → Return to Campaign Dashboard
```

---

## Game Modes

The session loop runs in one of three modes at any time. Mode transitions are engine-driven, not AI-driven.

| Mode | Trigger | UI Shell |
|------|---------|----------|
| **Exploration** | Default session state | Narration panel + input + mini-map |
| **Combat** | Initiative rolled (enemy encounter detected by Director) | Battle screen + action menu + initiative tracker |
| **Map** | Player opens atlas or fast-travels | Map canvas + token layer + fog of war |

Modes are mutually exclusive for the primary view but panels from other modes remain accessible (e.g., character sheet is always reachable from any mode).

---

## Exploration Mode — Detailed

### Step 1: Player Input
- Free text input OR selection from Director-suggested actions
- Input validation: non-empty, max 500 chars
- Submitted to Resolution Engine

### Step 2: Resolution Engine
The engine is deterministic and runs client-side (no AI involved):

```
parseAction(input) → ActionIntent
  → determineCheck(intent, character) → CheckConfig { stat, dc, modifiers }
  → rollDice(d20) → RawRoll
  → applyModifiers(rawRoll, checkConfig) → FinalRoll
  → evaluateOutcome(finalRoll, checkConfig.dc) → Outcome
    CRITICAL_SUCCESS | FULL_SUCCESS | SUCCESS_WITH_COST |
    FAILURE_WITH_OPPORTUNITY | COMPLICATION
```

The Outcome is final. The AI narrates it — it does not change it.

### Step 3: Director AI (Supabase Edge Function)
The `narrate` Edge Function receives:
```json
{
  "sessionId": "uuid",
  "mode": "exploration",
  "playerInput": "I try to pick the lock on the ancient vault",
  "outcome": {
    "degree": "SUCCESS_WITH_COST",
    "roll": { "faces": [13], "modifier": 2, "total": 15, "dc": 15 }
  },
  "context": {
    "recentTurns": 5,
    "worldState": { "...": "..." },
    "activeNPCs": [],
    "currentLocation": "The Vault Antechamber",
    "character": { "...summarizeCharacter() output..." }
  }
}
```

Returns:
```json
{
  "narration": "The lock gives — but the click echoes further than you'd like.",
  "worldStateUpdates": { "vault_door": "open", "alert_level": "elevated" },
  "suggestedActions": ["Slip inside quickly", "Listen before entering", "Check for guards"],
  "combatTriggered": false,
  "mapUpdate": null
}
```

### Step 4: Persistence
```
narrative_turns INSERT {
  session_id, turn_number, player_input, ai_narration, dice_rolls, mode
}
game_sessions UPDATE { turn_number++, world_state }
```

### Step 5: UI Update
- Narration panel: append AI text (streaming as it arrives, font-lore italic)
- Dice result panel: show roll breakdown (faces, modifier, total, DC, outcome tier)
- Character bar: update HP / conditions if changed
- Suggested actions: replace previous suggestions
- World state changes trigger map/location panel updates silently

---

## Combat Mode — Detailed

Combat is triggered when the Director sets `combatTriggered: true` in a narration response. The engine then takes full control of sequencing.

### Entry Sequence
```
Director signals combat
  → Engine rolls initiative for all participants (d20 + DEX mod)
  → Initiative order established (sorted descending)
  → UI transitions to Battle Screen
  → Combat Mode begins
```

### Battle Screen Layout
```
┌─────────────────────────────────────┐
│  Initiative Tracker (turn order)     │
├──────────────────┬──────────────────┤
│  Enemy Area      │  Player Area     │
│  (sprite/token + │  (sprite/token + │
│  enemy HP bars)  │  player HP/AC)   │
├──────────────────┴──────────────────┤
│  AI Narration (1–2 sentences max)   │
├─────────────────────────────────────┤
│  Action Menu: Attack | Spell | Item │
│               Defend | Flee         │
├─────────────────────────────────────┤
│  Combat Log ▾ (expandable)          │
└─────────────────────────────────────┘
```

### Turn Resolution
```
Active combatant's turn:
  → If player: present Action Menu
      Attack selected → choose target → roll d20 + ATK mod vs enemy AC
        Hit → roll damage dice → apply to enemy HP
        Miss → log "MISS", AI narrates
      Spell → choose spell + target → resolve per spell rules
      Item → choose item → apply effect
      Defend → add +2 AC until next turn
      Flee → contested DEX check vs enemy (DC set by Director)
  → If enemy: Director AI selects action
      Engine executes roll → apply result → AI narrates
```

### D&D Mechanics Underneath
- Attack roll: d20 + proficiency (if proficient) + STR or DEX mod vs target AC
- Critical hit: natural 20 → double damage dice
- Critical miss: natural 1 → automatic miss, possible complication
- Saving throws: d20 + relevant mod vs spell/effect DC
- Conditions: applied to character sheet, modify rolls per rules (poisoned = disadvantage on attack rolls, etc.)
- Spell slots: tracked on character sheet, depleted on cast
- Concentration: broken on taking damage if CON save fails (DC 10 or half damage, whichever is higher)
- Death: 0 HP → death saving throws (3 successes = stable, 3 failures = dead)

### Combat Log
Always accessible via expand control. Contains every action, every roll, every modifier, every outcome — in order. The player can always audit why something happened.

### Exit Sequence
```
All enemies defeated OR player flees successfully OR TPK:
  → Combat summary displayed (XP earned, loot, casualties)
  → AI Director narrates aftermath
  → UI transitions back to Exploration Mode
  → World state updated (enemies dead, room cleared, etc.)
```

---

## Map Mode — Detailed

### Map Hierarchy
```
World Atlas
  └── Regions (named zones, biomes, political areas)
       └── Towns / Dungeons / Locations
            └── Buildings / Areas
                 └── Floors / Levels
                      └── Encounter Zones (individual rooms/areas)
```

### Map Canvas Capabilities (Phase 6)
- **Upload**: DM uploads image (any format) → engine tiles it
- **Tokens**: drag-and-drop tokens for players, NPCs, monsters
- **Layers**:
  - *DM Layer*: traps, hidden doors, secret notes — never rendered to player
  - *Player Layer*: discovered rooms, known NPC positions, explored fog
- **Fog of War**: unexplored areas masked; revealed on player movement
- **Token data**: each token links to a character sheet or NPC stat block

### Map Permanence Rule
The AI Director cannot modify, delete, or redraw map data. It can:
- Signal that a new area has been discovered (triggers fog reveal)
- Update NPC token positions
- Mark an area as "cleared" or "dangerous"

Map data belongs to the campaign. It persists between sessions.

---

## Director System Architecture

### Director Config (per campaign)
```typescript
interface DirectorConfig {
  tone: 'grim' | 'heroic' | 'mysterious' | 'comedic'
  difficulty: 'easy' | 'standard' | 'brutal'
  hiddenArc: string        // The secret campaign narrative arc
  worldSeed: string        // Deterministic world generation seed
  npcMemory: NPCMemory[]   // Director's memory of NPC states
  activeThreads: Thread[]  // Ongoing plot threads
  currentMode: 'exploration' | 'combat' | 'map'
}
```

### Living World Dispatcher (Phase 3)
Even when the player is not taking actions, the world moves:
- NPCs pursue their own agendas
- Factions shift power
- Events trigger on timers
- The Director flags these changes for integration into the next narration
- Map state updates silently (an NPC moves positions, a door is found open)

---

## Character System

### Stats
| Stat | Abbrev | Controls |
|------|--------|----------|
| Strength | STR | Melee attacks, carrying capacity, physical feats |
| Dexterity | DEX | Ranged attacks, initiative, stealth, lockpicking |
| Constitution | CON | HP, endurance, resisting poison/disease |
| Intelligence | INT | Arcane magic, knowledge checks, investigation |
| Wisdom | WIS | Divine magic, perception, insight, survival |
| Charisma | CHA | Persuasion, deception, intimidation, social checks |

### Modifier Formula
```
modifier = Math.floor((stat - 10) / 2)
```

### HP Formula
```
maxHP = 10 + CON_modifier + (level × (hitDie_average + CON_modifier))
```

Hit die averages (floored): d6→3, d8→4, d10→5, d12→6

### Level Progression
Levels **1–20**. XP awarded per session based on: challenges overcome + narrative milestones + Director-assigned discoveries. The earlier "1–10 cap" was a placeholder; the engine supports 1–20.

### Proficiency Bonus by Level
| Levels | Bonus |
|--------|-------|
| 1–4    | +2    |
| 5–8    | +3    |
| 9–12   | +4    |
| 13–16  | +5    |
| 17–20  | +6    |

---

## Dice System

| Die | Use Case |
|-----|---------|
| d20 | All skill checks, attack rolls, saving throws, initiative |
| d12 | Barbarian hit die |
| d10 | Ranger/Fighter hit die |
| d8 | Cleric/Druid hit die, shortbow damage |
| d6 | Wizard/Rogue hit die, shortsword/dagger damage |
| d4 | Magic missile, minor damage |
| d100 | Percentile tables (wild magic surge, random loot) |

All rolls are seeded and logged. No roll can be suppressed or re-rolled by the AI. The Combat Log contains every die face shown.

---

## Voice Layer (Phase 8, Future)

Voice is planned but deferred until the core engine is stable:
- **Player input**: speech-to-text for action input
- **AI narration**: text-to-speech for Director narration with configurable narrator voice
- **NPCs**: each NPC can have a persistent voice profile (pitch, accent hints for TTS model)
- **Architecture**: voice is a presentation layer on top of existing text pipeline — the engine never changes

---

## Phase Implementation Tracking

| Feature | Phase | Status |
|---------|-------|--------|
| Auth + routing | 0 | ✅ Complete |
| Design system tokens | 0 | ✅ Complete |
| Supabase schema | 0 | ✅ Schema defined |
| Dice engine | 1.1 | ✅ Complete |
| Skill check resolver | 1.1 | ✅ Complete |
| Action intent parser | 1.1 | ✅ Complete |
| Character engine | 1.2 | ✅ Complete |
| Conditions engine | 1.3 | ✅ Complete |
| Campaign data schema | 1.3 | ✅ Complete |
| Supabase service layer | 1.4 | ✅ Complete |
| Generated types + integration tests | 1.5 | ✅ Complete |
| Automatic character resolution (skills/equipment/conditions pipeline) | 1.6 | ✅ Complete |
| Action validation (canPerformAction) | 1.6 | ✅ Complete |
| Equipment/proficiency DB persistence | 1.7 | ✅ Complete |
| Death saves promoted onto CharacterSheet | 1.7 | ✅ Complete |
| Concentration-breaking on damage | 1.7 → 5 | 🔲 Deferred to Combat Presentation |
| Character Library (list/search/duplicate/delete) | 2.1 | ✅ Complete |
| Character Creation Wizard (9 steps) | 2.1 | ✅ Complete |
| Roll20-style character sheet (10 tabs, autosave) | 2.1 | ✅ Complete |
| Campaign Library (list/search/delete/create) | 2.2 | ✅ Complete |
| Campaign Creation Wizard (8 steps) | 2.2 | ✅ Complete |
| Campaign Detail page (summary, inline edit) | 2.2 | ✅ Complete |
| Session lifecycle (start/pause/resume/end) | 2.2 | ✅ Complete |
| pauseSession / resumeSession / getResumableSession | 2.2 | ✅ Complete |
| Campaign loop / session flow | 2.2 → 3 | ✅ Foundation complete; turn loop requires AI narration |
| Adventure Hub Shell (`/adventure/:campaignId`) | 2.3 | ✅ Complete |
| Character Sidebar (engine-derived, live stats) | 2.3 | ✅ Complete |
| Dice Panel (real engine, mode/DC/history) | 2.3 | ✅ Complete |
| Story Panel (AI narration placeholder + turn history) | 2.3 | ✅ Shell ready |
| Debug Panel (live game state JSON dump) | 2.3 | ✅ Complete |
| UI Game Shell (panels, modes) | 2.3 → 4 | ✅ Exploration shell done; Combat/Map modes remain |
| Narrate edge function | 2.4 | ✅ Complete |
| Director system | 2.4 | ✅ Complete |
| Streaming AI | 2.4 | ✅ Complete |
| Story Panel (action input + streaming display) | 2.4 | ✅ Complete |
| Living World dispatcher | 3 | ✅ Core complete (applyWorldStateUpdate) |
| Session Summary panel | 3 | ✅ Complete |
| UI Game Shell (panels, modes) | 4 | 🔲 Pending (GBA/DS reskin) |
| Character sheet GBA/DS re-skin + nav shell wiring | 4 | 🔲 Pending |
| Combat engine (mechanics) | 5 | ✅ Complete |
| JRPG battle screen (UI) | 5 | ✅ Complete |
| XP persistence + level-up detection | 5.1 | ✅ Complete |
| Loot framework + inventory write | 5.1 | ✅ Complete |
| Director enemy parsing | 5.1 | ✅ Complete |
| Combat summary turn (appendTurn mode:combat) | 5.1 | ✅ Complete |
| Post-combat world state update | 5.1 | ✅ Complete |
| Living Atlas / token map | 6 | ✅ Location list/detail/search/filter/breadcrumb complete |
| Fog of war | 6 | 🔲 Pending (canvas layer) |
| Polish & launch | 7 | ✅ Accessibility, error boundaries, code splitting, skeletons, touch targets |
| Release checklist + deployment docs | 8 | ✅ Complete (RELEASE_CHECKLIST.md, DEPLOYMENT.md) |
| CI pipeline, vercel.json, debug panel gate, bundle scan | 8.1 | ✅ Complete — 1323/1323 tests, 0 TS errors, no sk-ant- in bundle |
| ActionBar, combat menus, quick-actions, weapon/spell/item submenus | 8.3 | ✅ Complete — 1363/1363 tests, 0 TS errors, build clean |
| Pixel UI foundation, audio framework, ambient particles | 9.0 | ✅ Complete — 1412/1412 tests, framework asset-ready |
| Hub 3-column layout, audio wiring, combat visual feedback, card/sheet pixel-skin | 9.1 | ✅ Complete — 1459/1459 tests, 87 new tests |
| Level-up workflow, Quest Log, Codex, current location, durable Director memory | 9.2 | ✅ Complete — 1542/1542 tests, 70/70 integration |
| Exploration-turn dice resolution wiring, full dice transparency, Director rules lock-in | 9.3 | ✅ Complete — 1557/1557 tests, 70/70 integration |
| Director Bible, world-mode specs, repository audit, doc sync | 10.0 | ✅ Complete — 1567/1567 tests (spec/audit pass, not implementation) |
| Character creation autosave/resume/cancel-confirm, character import pipeline architecture (manual-entry provider only), real dice/XP/level-up animations | 10.1 | ✅ Complete — 1651/1651 tests. Google Sign-In and campaign document upload explicitly deferred. |
| Campaign import pipeline architecture (manual-entry provider only), Director Document Upload extension point (types only, no UI/storage) | 10.2 | ✅ Complete — 1721/1721 tests. Director Document Upload's storage/service/UI/retrieval layers explicitly deferred — see `docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md`. |
| Director Document Upload completed: storage, service layer, modular full-text retrieval, upload/management UI, Director prompt integration | 10.3 | ✅ Complete — 1753/1753 unit tests, 85/85 integration tests (real Postgres, real ranked search). Only real text extraction remains deferred across all three upload pipelines — see `docs/KNOWN_LIMITATIONS.md`. |
| Director Document real text extraction: TXT/Markdown/PDF/DOCX, all client-side (pdfjs-dist, mammoth), FullTextRetriever/service layer/upload UI unchanged | 10.4 | ✅ Complete — 1773/1773 unit tests, 85/85 integration tests (unchanged, no persistence touched). Character/Campaign Import extraction remains deferred (needs real OCR/Vision credentials, separate future pass). |
| Google Authentication: OAuth flow, callback handling, session persistence, automatic profile provisioning, logout, error handling — code-complete and tested | 10.5 | ✅ Complete — 1857/1857 unit tests, 98/98 integration tests (real Postgres, real RLS). Live Google OAuth handshake not run — needs real Google Cloud + Supabase dashboard credentials this environment cannot provide; see `docs/DEPLOYMENT.md`. |
| Adventure Hub UI Redesign: 3-column pixel-art dashboard (left nav / center scene / right party status), additive over the unmodified engine/Director/session state | 11 | ✅ Complete — 1995/1995 unit tests (65 new). No persistence/schema/service code touched — UI layer only. Bottom tab nav (mobile/tablet) fully intact; every existing gameplay action verified unchanged. |
| Director Intelligence (remaining Bible rules: never-refuse, location-weight narration, between-scenes voice, structured complications) | 10 (spec'd) | 🔲 Planned — see `docs/specs/PHASE_10_DIRECTOR_INTELLIGENCE.md` |
| Living World (WorldClock, scheduled events) | 11 (spec'd) | 🔲 Planned — see `docs/specs/PHASE_11_LIVING_WORLD.md` |
| Creator Tools (structured campaign definition) | 12 (spec'd) | 🔲 Planned — see `docs/specs/PHASE_12_CREATOR_TOOLS.md` |
| Reputation + Legacy system | (spec'd, sequenced after Living World) | 🔲 Planned — see `docs/design/REPUTATION_SYSTEM.md`, `docs/design/NPC_SYSTEM.md` |
| Chronicle Mode | (spec'd, sequenced last) | 🔲 Planned — see `docs/design/CHRONICLE_MODE.md` |
| Release Candidate hardening pass | 13 (spec'd) | 🔲 Planned — see `docs/specs/PHASE_13_RELEASE_CANDIDATE.md` |
| Equipment paper-doll, world map canvas, weather/day-night display | — | 🔲 Planned (weather/day-night now covered by the Living World spec above; equipment paper-doll and map canvas remain unspec'd) |
| Voice layer | Post-launch | 🔲 Deferred |

---

*Last updated: Phase 11 — Adventure Hub UI Redesign*
