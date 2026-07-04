# Chronicle AI — Constitution
*The governing document. All design decisions, architecture choices, and game mechanics decisions must align with this.*

---

## Mission Statement

Chronicle AI is an AI-powered solo tabletop RPG web application. The player engages in a narrative-driven adventure where every action is resolved through a combination of dice mechanics, character stats, and AI-generated narration. The AI acts as Game Director — not a chatbot, but a structured narrative engine with memory, consistency, and dramatic intent.

The experience feels like a **premium Game Boy Advance / Nintendo DS fantasy RPG** — warm, immediate, visually structured — while resolving every action with **D&D 5e-adjacent mechanics**. The aesthetic is the surface. The rules are the bones. Both are non-negotiable.

---

## Core Pillars

### 1. Structure First, Magic Second
The game feels magical *because* it has ironclad structure underneath. Dice rolls are real. Skill checks follow deterministic rules. The AI narrates *consequences*, it does not override *outcomes*. A failed roll is a failed roll — the AI describes the failure dramatically, it never retcons it.

### 2. The Director System
The AI Director is not a free-form GPT wrapper. It:
- Maintains a Living World state (NPCs, locations, ongoing events)
- Tracks narrative consistency across turns
- Has a "secret agenda" per campaign (hidden arc, villain plan, world event)
- Delivers consequences on a delay — actions ripple forward

### 3. Player Agency is Sacred
The player's choices must matter. The Director can create tension and obstacles, but cannot:
- Force the player into a predetermined outcome
- Ignore player choices that succeed mechanically
- Override a natural 20

### 4. The UI Is a Game Interface, Not a Document Viewer
Chronicle AI is not a chat window with dice bolted on. It is a game. Menus must remain visible and useful. Story is visualized through structured game panels — initiative trackers, stat blocks, map tiles, action menus — not only prose. The player should always know what they can do and what the world looks like.

This pillar supersedes the earlier framing of "exploration over combat." Exploration, combat, and social encounters are all first-class modes. The UI adapts to the mode; the rules engine remains constant.

### 5. Familiar to Players Who Already Know D&D
A Roll20 user or D&D 2024 player should sit down, open a character sheet, and recognize everything within 60 seconds. Modifiers, AC, saving throws, spell slots, conditions — the vocabulary is intentionally standard. Chronicle AI earns its novelty through presentation and AI narration, not by reinventing mechanics.

### 6. Performance is a Feature
Slow AI responses break immersion. Target: first token in < 1.5s, full narration in < 8s. Streaming is non-negotiable.

---

## UX Design Laws

These laws govern every UI decision. They cannot be overridden by aesthetic preference.

### Law 1 — Menus Are Always Reachable
No UI state should strand the player without a clear action. In combat: the action menu is always visible. In exploration: the character sheet, map, and inventory are always one tap away. In dialogue: at minimum, there is always a "say something" input.

### Law 2 — Story Through Panels, Not Walls of Text
Narration is delivered inside structured game panels. HP changes appear as animated numbers. Initiative order lives in a persistent tracker. Location changes update a visible header. The AI's prose narrates the *drama*; the UI communicates the *state*.

### Law 3 — The Character Sheet Is the Source of Truth
The engine reads structured stats from the character sheet. Nothing is inferred from prose. If CON is 14, the HP formula runs on 14 — not on whatever the AI said last turn. The sheet is always editable and always accurate.

### Law 4 — The Map Is Persistent
The world does not reset between sessions. Maps persist. Discovered rooms stay discovered. NPC positions are remembered. The AI does not redraw the world — it evolves it. The Living Atlas is additive, never destructive.

### Law 5 — Combat Has Its Own Visual Mode
When initiative is rolled, the UI transitions to a battle screen. This is not a text box with extra context — it is a dedicated combat view with sprite/token positioning, an action menu, a turn order tracker, and a live combat log. The D&D mechanics run underneath; the GBA/JRPG aesthetic is on top.

### Law 6 — Transparency About the Rules
Dice rolls are always visible. Modifiers are always labeled. When an outcome is determined, the player can see exactly why. The AI narrates the fiction; the UI shows the math. Mystery in story is fine. Mystery in mechanics is a bug.

---

## Technical Principles

### Architecture
- **Separation of concerns**: game logic (engine), AI communication (ai lib), and data (supabase) are fully decoupled
- **Edge Functions for AI**: OpenAI API calls NEVER touch the client. All AI goes through Supabase Edge Functions
- **RLS everywhere**: Every table has Row Level Security. Users can only access their own data
- **Typed end-to-end**: No `any` types in production code. Types flow from DB → app layer → UI

### State Management
- **Zustand** for auth + UI state (active mode, panel visibility, combat state)
- **Supabase realtime** for session/turn state (Phase 2+)
- **No Redux** — complexity budget too high for this project size

### Testing Philosophy
- Unit tests for all engine logic (dice, resolution, conditions, character)
- Integration tests for auth flows and DB queries
- No snapshot tests — they are noise, not signal
- Target: 90%+ coverage on `src/lib/engine`

---

## Game Mechanics — North Star

### Resolution System
- All outcomes resolved by: `d20 + stat modifier + situational modifier vs DC`
- Critical success (nat 20): extra benefit beyond intended outcome
- Critical failure (nat 1): complication, not just failure
- DC ladder: Trivial 5 / Easy 10 / Medium 15 / Hard 20 / Legendary 25+

### Character Stats
Six stats following the D&D-adjacent model: STR, DEX, CON, INT, WIS, CHA
Modifiers: `floor((stat - 10) / 2)` — same formula, deliberately familiar

### Level Progression
Levels **1–20**. XP awarded per session based on: challenges overcome, narrative milestones, and Director-assigned discoveries. *(Note: the earlier "1–10 cap" in previous versions was a content balance placeholder, now superseded.)*

### Combat
Turn-based. Initiative = d20 + DEX modifier. HP, AC, damage, spell slots, and conditions all tracked per the character sheet. Visually presented as a Pokémon/JRPG battle screen. Mechanically resolved as D&D. The AI narrates combat descriptions — it does not determine hit or miss.

### Map System
Hierarchical: world → region → town → building → floor → encounter zone. Images are uploaded by the DM (player). Tokens represent characters, NPCs, and monsters. DM layer stores secrets; player layer shows discovered state. Fog of war is a first-class feature.

---

## Versioning

| Phase | Name | Focus |
|-------|------|-------|
| 0 | Foundation | Project scaffold, auth, routing, design system |
| 1 | Resolution Engine | Dice, skill checks, character creation |
| 2 | AI Narration | Director system, edge function, streaming |
| 3 | Campaign Loop | Full session flow, Living World, persistence |
| 4 | Game Shell | Full game UI: panels, modes, navigation, character sheet |
| 5 | Combat Presentation | JRPG battle screen, action menu, combat log |
| 6 | Living Atlas | Map system, tokens, fog of war, DM/player layers |
| 7 | Polish & Launch | Performance, accessibility, onboarding, mobile |
| 8 | Voice Layer | Speech input, AI narrator TTS, NPC voices |

---

*Last updated: Phase 1.2*
