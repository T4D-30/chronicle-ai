# ChronAI UI Vision

> **If a screenshot of ChronAI can be mistaken for a website, the design
> has failed. If a screenshot can be mistaken for a premium indie pixel
> RPG, the design has succeeded.**

That sentence is the north star for every future UI decision. This
document is the canonical design reference for all ChronAI UI work.
Every new component is evaluated against this vision before
implementation. It sits alongside — and defers to — the two governing
documents: [CHRONICLE_CONSTITUTION.md](CHRONICLE_CONSTITUTION.md)
(what may never be violated) and [STYLE_GUIDE.md](STYLE_GUIDE.md)
(tokens, primitives, and code patterns).

---

## Vision

ChronAI is a fully immersive pixel-art RPG interface powered by an AI
Dungeon Master. The player should forget they're using a browser. They
should feel like they launched a game — and remember the world, the
story, the characters, and the adventure, never the technology.

**Primary inspirations**: Sea of Stars, Octopath Traveler, Pokémon
Mystery Dungeon, Darkest Dungeon (UI), Children of Morta, Eastward,
Hyper Light Drifter, Chrono Trigger, SNES JRPG menus.

**Core philosophy**: the world is the primary focus. The UI exists to
frame the world — never the opposite. If a screen looks like a
dashboard or admin panel, redesign it.

**The Sea of Stars test**: every menu must answer *"would this look
natural inside Sea of Stars?"* If the answer is no, redesign it.

---

## Core Concepts

### 1. The UI State Machine

Screens are **game states with explicit transitions**, not routes that
swap instantly. Title → menu → world → dialogue → combat are states in
a machine; every transition between them is designed (fade, slide,
reveal) rather than an instant DOM replacement.

Implementation: `src/stores/uiSceneStore.ts` — a Zustand store (the
Constitution designates Zustand for UI state) holding the current
presentation phase and a `transition()` action that enforces the legal
transition table. It models *presentation* state only: which camera is
live, which phase of a reveal sequence is showing. It never holds or
mutates game state. New screens add their states to this machine
instead of inventing ad hoc `useState` reveal flags.

### 2. Cameras, not Pages

Each screen is a **camera looking at the world**:

| Screen | Camera |
|---|---|
| Title | a distant vista at night — the world before the story |
| Main menu | the traveler's camp — the world at rest |
| Adventure | the player's window into the world (the Scene panel) |
| Combat | the battle framing (Constitution Law 5) |
| Character/Journal/Inventory | close-ups on the traveler's belongings |

Navigation is the camera moving, not a page loading. Route changes
still exist mechanically (React Router is unchanged), but the *player-
facing* experience of each screen starts from "where is the camera
pointed" — never from "what buttons does this page need."

### 3. The World Renderer

One reusable surface draws the world behind every screen:
`src/components/pixel/WorldRenderer.tsx`. Procedural layered scenery
today (SVG silhouette bands + parallax drift + palette tints); real
pixel art or AI-generated art tomorrow, dropped into the asset slots
without code changes. Screens never hand-roll their own backgrounds —
they mount the renderer with a scene name and overlay their UI.

### 4. Think "Game Engine"

The presentation layer is organized like an engine, not a website:

- **Scenes** — named world views (`night-camp`, `dusk-vale`,
  `dawn-ridge`, and future biomes), owned by the World Renderer.
- **Layers** — strict z-order everywhere: world (back) → atmosphere
  (particles/fog/glow) → UI chrome (panels/menus, front).
- **Ticker** — all motion runs on CSS animation timing (`steps()` for
  pixel feel); there is no JS animation loop, and nothing should need
  one at this stage.
- **Asset slots** — every visual/audio surface has a documented slot
  where real assets land (see Asset Slots below), with a procedural or
  silent fallback until then.

### 5. Make Everything Feel Alive

Nothing on screen should be fully static: parallax drift, fog, torch
flicker, ember particles, cursor pulse, menu reveals. But atmosphere
serves the world — it must be **subtle, slow, and never distracting**.
Rules:

- Ambient motion is slow (whole-scene drifts measured in tens of
  seconds) and low-contrast.
- Interactive feedback is fast and stepped (`steps()` timing, ≤200ms).
- Everything respects `prefers-reduced-motion` — every animation is in
  the kill-lists in `pixel.css`/`globals.css`, no exceptions. A
  reduced-motion player gets a beautiful still painting, not a broken
  screen.

### 6. One Guiding Principle

The north star at the top of this document. When two design options
conflict, pick the one whose screenshot looks more like a premium indie
pixel RPG. Every future component is evaluated against it before
implementation.

### 7. The Presentation Layer Rule

The presentation layer — `uiSceneStore`, everything under
`src/components/pixel/`, scene/camera code — **may read game state but
never mutates it**. And every *in-game* visual must derive from real
state: real HP, real weather fields (when Phase 10 adds them), real
locations. Decoration is allowed **only on menus and the title screen**
(a firefly on the title screen claims nothing about the game world; a
rain effect during play does). This codifies the rule the codebase
already lives by — see AdventureHub's deliberate `ambienceKind = 'none'`
and the Constitution's Law 2/Law 3.

### 8. After UI 3.0: No More "Web Pages"

Future UI work is framed as **game features**, not pages:

| Feature | Direction (one line) |
|---|---|
| Character Screen | guild records — an official ledger of the hero |
| Journal | an ancient tome, pages that turn |
| Inventory | a leather backpack laid open |
| Atlas | a folded paper map, hand-inked |
| Quest Log | parchment notes pinned to a board |
| Combat HUD | the battle camera's diegetic overlay (Law 5) |
| Dialogue System | portrait + name + typed text, JRPG dialogue boxes |
| Camp Screen | the fire, the party, the night — rest and reflection |
| Dice | a wooden dice tray |
| Settings | an old mechanical console |

Each of these is a later phase. None of them may land without passing
the Sea of Stars test and the checklist at the end of this document.

---

## Layout Principles

1. **Every screen begins with the world.** The first thing the player
   notices is scenery — a vista, a camp, a dungeon — never buttons.
   The World Renderer fills the screen; UI overlays it.
2. **Scene-first hierarchy.** In the Adventure Hub, the Scene panel is
   the centerpiece — large, wide, minimal chrome, warm frame, subtle
   vignette (already built in UI 2.0). Sidebars and bars are secondary.
3. **Reading width.** Narrative text lives in a centered column capped
   at a comfortable reading width (`max-w-3xl` today). Extra screen
   width becomes breathing room, never longer lines.
4. **≤3 columns, always.** The Phase 14.1 rule stands at any
   breakpoint.
5. **Menus are always reachable** (Constitution Law 1) — no cinematic
   flourish may ever strand the player without a visible action.

## Material Language

Documented now; implemented feature-by-feature in later phases (see
Concept 8). Panels are materials, not rectangles: carved oak and worn
stone surfaces (the UI 2.0 `panel` tokens + grain), heavy bronze frames,
parchment reading surfaces, leather for carried things, iron and wood
for physical controls. Never flat colors, never glassmorphism, never
modern SaaS chrome. The shared torchlit-panel recipe lives once in
`.chr-panel` / `.pixel-border*` — components must not hand-roll it.

## Color Philosophy

The UI 2.0 palette is the palette (see STYLE_GUIDE.md for tokens and
semantic rules). Push it further, change nothing structurally. The
player should feel lit by campfires, torches, lanterns, sunsets,
candles, fireplaces — everything carries warm reflections. Ratio target
for any screen: **~55% dark charcoal/black · ~20% warm walnut · ~15%
bronze/gold · ~7% ember · ~3% status accents** (heal/harm/spirit/
mystic). Cool colors are status signals, never mood.

## Typography

The four tiers from UI 2.0 (STYLE_GUIDE.md "Text Hierarchy" +
`Typography.tsx` primitives): **headers gold** (`SectionHeader`),
**subheaders copper** (`SubHeader`), **body warm parchment**
(`StoryText`/`Dialogue`), **numbers bright ivory** (`StatNumber`).
Pixel faces (`font-pixel-display`/`font-pixel-body`) for game chrome,
serif lore face for narration. No arbitrary font sizes — the scale in
`tailwind.config.ts` is the scale.

## Animation Rules

Game animations only — never modern UI animations. The approved
vocabulary: button depress, torch flicker, cursor pulse, dialogue
typing, screen fade, pixel particles, smoke, fog, page flip, menu
slide. The banned vocabulary: springy overshoot, bouncy scale-ins,
skeleton shimmer, parallax-on-scroll, hover lifts with soft shadows.
Mechanics: `steps()` timing for anything pixel-adjacent; existing
keyframes in `pixel.css` are reused before new ones are invented; every
new keyframe is added to the reduced-motion kill-list in the same
commit.

## Spacing

The 4px grid (STYLE_GUIDE.md): tight 2–4px, default 8–16px, section
24–32px, page 48–64px. GBA UIs were pixel-precise; ours is equally
deliberate. No arbitrary values.

## Atmosphere & Camera Rules

- Every environment breathes: forest = leaves/birds/fireflies/sun
  shafts; village = smoke/banners/forge sparks; dungeon = torches/dust/
  drips; camp = fire flicker/smoke/stars. (Only the camp/vista set
  exists procedurally today; the rest arrive with their features.)
- Avoid static scenes: slow parallax (mountains, clouds, fog), tree
  sway, grass, smoke — title-screen energy everywhere.
- Subtlety gate: if a first-time viewer's eye is drawn to the
  atmosphere instead of the content, it's too strong.
- In-game atmosphere must reflect real world state (Concept 7).
  Menu/title atmosphere may be purely decorative.

## Audio Philosophy

The framework exists and is the pattern (`src/lib/audio/audioManager.ts`,
`useAudio`): context-driven music with crossfade, three channels
(music/ambience/sfx), silent-fail when files are missing. Rules:

- Music follows context (`setContext`): menu theme on title/menu
  screens, biome themes in play, combat/boss/victory in battle.
- Ambience follows the environment: forest = birds/wind/river, village
  = forge/market/bells, dungeon = echo/drips, camp = fire/crickets/owl
  — switching automatically with the world, never manually per page.
- The UI never *requires* sound: everything must read fully silent.
- Assets land in `public/audio/{music,ambience}/*.ogg` per the manifest
  in `audioManager.ts`; the moment files exist, the wiring already
  built goes live.

## Asset Slots

The standing pattern for "procedural now, real art later":

| Slot | Location | Fallback today |
|---|---|---|
| Environment backdrops | `public/assets/sprites/environments/<scene>.png` | WorldRenderer's procedural SVG scenery |
| Portraits | `public/assets/sprites/portraits/` | emoji/initial placeholder (portrait phase not started) |
| Items / enemies / UI sprites | `public/assets/sprites/{items,enemies,ui}/` | emoji via `Icon` registry |
| Music | `public/audio/music/<key>.ogg` | silence (AudioManager silent-fail) |
| Ambience loops | `public/audio/ambience/<key>.ogg` | silence |

Rules: consumers check the slot first and fall back gracefully; sprite
consumers apply `.pixel-crisp`; adding a real asset must never require
a code change; no binary assets enter the repo without an explicit
licensing decision.

## Constitution Guardrails

Non-negotiable, restated from CHRONICLE_CONSTITUTION.md as they apply
to presentation work:

- **Law 1** — menus always reachable; no cinematic state may strand
  the player.
- **Law 2/3** — the UI communicates real state; prose never determines
  mechanics; nothing on an in-game screen fabricates world state.
- **Law 5** — combat keeps its own visual mode.
- **Law 6** — dice and modifiers stay visible; mystery in mechanics is
  a bug.
- Decorative ambience: menus/title only. In-game ambience waits for
  real weather/time fields (Phase 10 Living World).
- Accessibility floor: focus rings, ARIA labeling, reduced-motion,
  4.5:1 contrast for body text — atmosphere never trades against any
  of these.

## Deferred Roadmap

Not in UI 3.0; each is a later phase evaluated against this document:

- NPC/player portraits (pixel art, blink, idle breathing, emotion
  changes; player portrait reflecting equipment/damage) — blocked on
  real art assets.
- Party menu (people first: portrait, health, mood, relationship —
  numbers second).
- Per-feature material treatments (Concept 8 table).
- Real environment/sprite/audio assets (licensing decision required).
- Day/night cycle and weather-driven scenes (blocked on Phase 10
  Living World data — honesty rule).
- Dialogue system with speaker names, portraits, and typed reveal.
- Adventure story view will eventually transition to a dialogue system
  docked over a full-bleed world scene, following the Combat HUD and
  classic JRPG dialogue architecture. The world remains the primary
  visual focus while dialogue overlays it rather than consuming
  separate layout space. (The dialogue-readability pass prepared this:
  the scene viewport is content-aware and collapses when no artwork
  exists, so re-inflating it — or going full-bleed behind an overlay —
  needs no layout redesign.)
- `/menu` route alias (dedicated routing-cleanup phase; `/dashboard`
  path is unchanged by UI 3.0 by explicit decision).

## New-Component Checklist

Before implementing any UI component, confirm:

1. Does its screenshot pass the north star?
2. Does it pass the Sea of Stars test?
3. Does the world come first — does UI frame scenery, not replace it?
4. Does it use the World Renderer instead of a custom background?
5. Are its states in the UI state machine (not ad hoc reveal flags)?
6. Does it reuse tokens/primitives (no hand-rolled panels/glows)?
7. Is every animation from the approved vocabulary, `steps()`-timed
   where pixel-adjacent, and reduced-motion-safe?
8. Does it read game state without mutating it, and fabricate nothing
   in-game (Concept 7)?
9. Are its asset slots documented with graceful fallbacks?
10. Does it keep menus reachable and meet the accessibility floor?

---

*Created: UI 3.0 (Pixel RPG Experience). This document supersedes
page-thinking; it does not supersede the Constitution.*
