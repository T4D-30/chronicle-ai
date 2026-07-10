# Chronicle AI — Style Guide

---

## Design Language

**Aesthetic reference (UI 2.0)**: Dark-fantasy pixel RPG HUD, not a GBA
palette anymore. Think Octopath Traveler, Pokémon Mystery Dungeon, Sea of
Stars, Darkest Dungeon's UI, Diablo II menus, old Zelda inventory screens.
Warm, heavy, torchlit. The interface should read as a leather-bound
adventure journal open by a campfire, never as a dashboard or productivity
app. High contrast between UI chrome and content. Every pixel has a job.

**Mechanical reference**: D&D 5e / Roll20. Character sheets, stat blocks, and dice results look familiar to anyone who has played at a digital table.

**Palette Philosophy**: `void` is the canvas — nearly-black navy/charcoal
backgrounds that make color pop. `panel` is carved oak and worn stone —
every game panel's surface, warmer and heavier than the background behind
it. `bronze` is the frame — heavy borders and glowing gold corners holding
each panel together. `arcane` is fire — action, reward, and warmth
(hover states, selected tabs, CTAs, XP), painted in ember/copper/fire-gold
rather than a cold amber. `spirit` is the system communicating. `mystic`
is a narrow blue accent reserved for spell/magic-specific UI only — it is
not a general highlight color. These colors carry semantic meaning; they
are never purely decorative.

Every panel should feel lit from a torch: an inner shadow for depth, an
outer shadow for separation, and a warm top highlight where the light
would fall. Soft glow effects reserved for magical events and selected/
active states — never neon, never flat color fields.

---

## Color System

| Token | Hex | Use |
|-------|-----|-----|
| `void-950` | `#0a0a0f` | Page background — nearly-black navy |
| `void-800` | `#141315` | Secondary background — charcoal stone |
| `void-700` | `#1b1a1e` | Dividers, dark slate |
| `void-400` | `#6b625a` | Muted text, disabled labels |
| `panel-900` | `#1f1814` | Panel background — carved oak |
| `panel-700` | `#2a201a` | Lifted/hover panel surface — worn stone |
| `bronze-800` | `#4a3423` | Dark bronze — panel border, pressed-state inset |
| `bronze-600` | `#7a5630` | Bronze — default panel/button border |
| `bronze-400` | `#c89443` | Gold — header text, active border, corner glow |
| `bronze-300` | `#e2b562` | Highlight — brightest corner glow, focus rings |
| `arcane-300` | `#e8a74a` | Fire gold — highlight tier, XP, subheader text |
| `arcane-400` | `#d77a26` | Ember — primary accent, CTA text, selected-tab glow |
| `arcane-600` | `#a86932` | Copper — CTA/button hover glow |
| `arcane-700` | `#b45a1a` | Burnt orange — deeper accent border/bg tint |
| `mystic-400` | `#5e83d7` | Spell/magic-specific accent only — never a general CTA color |
| `spirit-400` | `#3bcac0` | System feedback, secondary actions, MP/mana |
| `harm-400` | `#b33131` | Blood red — damage numbers, error states |
| `harm-600` | `#7a1e1e` | Dark crimson — deeper danger tone, danger-button bg |
| `heal-400` | `#5ea85b` | Nature green — healing numbers, success states, buffs |

**Semantic rules — do not break these:**
- `arcane-*` means "action available" or "important reward." Never decorative. (UI 2.0: painted in fire/ember/copper tones, not amber-gold — the role is unchanged, only the hue.)
- `bronze-*` is structural — panel/button borders, corner glow, header gold. Not a status or action signal.
- `panel-*` is the carved-wood/stone surface every game panel sits on. Distinct from `void`, which is the cooler background behind the panels.
- `mystic-*` is reserved for spell/magic-specific UI. Never a general highlight or CTA — use `arcane-*` for that.
- `spirit-*` means "the system is informing you." Never narrative prose.
- `harm-*` is exclusively for damage, errors, and negative conditions.
- `heal-*` is exclusively for healing, successes, and positive conditions.
- `warning-*` (`warning-400 #a86932` / `warning-600 #7a4a1f`) is exclusively
  for caution states that are not yet errors — a duller, darker register
  than `arcane-*`'s brighter ember/fire-gold CTA tones, so caution doesn't
  read identically to "action available" at a glance.
- Warm parchment/ivory text on dark backgrounds only. No light mode.

### Generic token names (Phase 15 design-system mapping)

The design system is sometimes described in generic terms (Background,
Surface, Panel, Border, Gold, Success, Danger, Muted, Highlight, Selected,
Disabled). These are **not new tokens** — they already exist under the
semantic names above. This table exists so nobody reinvents them:

| Generic name | Existing token |
|---|---|
| Background | `void-950` |
| Surface / Panel | `panel-900` |
| Border | `bronze-600` |
| Gold | `bronze-400` |
| Arcane | `arcane-*` |
| Success | `heal-400` |
| Danger | `harm-400` |
| Warning | `warning-400` |
| Muted | `void-400` |
| Highlight | `bronze-300` |
| Selected | `arcane-400` |
| Disabled | `bronze-800` (border) + reduced opacity, per component |

Because every component already reads these through Tailwind classes (not
hardcoded hex values), a future theme only requires swapping the palette in
`tailwind.config.ts` — no component changes needed. UI 2.0 is the first
real exercise of that promise: the `Window`/`Icon`/`Typography`/`Button`
component layer from Phase 15 needed zero API changes for this repaint.

### Battle Screen Color Additions

During combat mode, the following contextual colors activate:

| Context | Color Rule |
|---------|-----------|
| Player HP bar | `heal-400` → `arcane-400` → `harm-400` (full → half → critical) |
| Enemy HP bar | `spirit-400` depleting to `void-700` |
| Active turn indicator | `arcane-400` pulse ring around active token |
| Condition badges | Unique per condition — defined in conditions.ts |
| Critical hit flash | Full-screen `arcane-400/10` flash for 200ms |
| Miss indicator | `void-400` "MISS" text, no flash |

---

## Typography

| Role | Family | Weight | Use |
|------|--------|--------|-----|
| Display | Cinzel | 700–900 | Chapter headers, location titles, phase transitions |
| Body | Inter | 400–600 | UI text, labels, buttons, form elements |
| Lore | Crimson Text | 400 italic | AI narration, flavor text, spoken NPC dialogue |
| Mono | JetBrains Mono | 400–500 | Stat numbers, dice results, modifiers, HP, AC |

**Rules:**
- `font-display` only for H1–H3 and location/chapter headings. Never in stat blocks or buttons.
- `font-lore` for anything the AI "speaks." It must feel distinct from the UI chrome.
- `font-mono` for ALL numbers that are mechanically meaningful: HP, AC, modifiers, dice faces, XP, gold.
- Buttons: `font-body font-semibold`. Crisp, readable, not decorative.

### Battle Screen Typography
- Damage numbers: `font-mono font-bold`, size `2xl–4xl`, float-up animation.
- Action menu: `font-body font-semibold`, all-caps, size `sm`.
- Initiative tracker names: `font-body font-medium`, size `xs`.
- Turn announcement ("YOUR TURN"): `font-display font-black`, size `3xl`, brief fade-in.

---

## Spacing

Base unit: 4px (Tailwind's default).
- Tight: 2–4px (within a component — icon + label, number + unit)
- Default: 8–16px (between elements in a group)
- Section: 24–32px (between UI sections)
- Page: 48–64px (full-section padding)

Never use arbitrary spacing values. Stick to the 4px grid. GBA UIs were pixel-precise; ours should feel equally deliberate.

---

## Component Patterns

### Panels

```
.chr-panel         — base dark panel (void-900 bg, void-700 border)
.chr-panel-arcane  — action/player panel (arcane-800 border accent)
.chr-panel-spirit  — system/info panel (spirit-800 border accent)
```

Use `chr-panel-arcane` for anything the player can act on.
Use `chr-panel-spirit` for read-only system information.

### Game-Specific Panel Types (Phase 4+)

| Panel | Description |
|-------|-------------|
| `BattleScreen` | Full-width combat view with sprite area + action menu |
| `InitiativeTracker` | Vertical strip showing turn order with active highlight |
| `CombatLog` | Scrollable log of resolved actions (always accessible) |
| `CharacterSheet` | Tabbed sheet: Overview / Abilities / Skills / Saves / Inventory / Equipment / Spells / Features / Conditions / Notes |
| `MapCanvas` | Tile-grid canvas with DM and player layers |
| `TokenLayer` | SVG overlay for player/NPC/monster tokens |
| `FogOfWarLayer` | Canvas mask revealing only discovered areas |
| `ActionMenu` | JRPG-style menu: Attack / Spell / Item / Defend / Flee |

### Buttons

- Primary action → `variant="arcane"` — one per view maximum
- Navigation / secondary → `variant="ghost"`
- System feedback / info → `variant="spirit"`
- Destructive → `variant="danger"`
- Combat actions (Attack, Spell, Item, Defend, Flee) → `variant="arcane"` in the battle screen context, with active/disabled states matching D&D action economy

### Character Sheet Tabs

Tabs follow Roll20 / D&D 2024 familiarity:

| Tab | Contents |
|-----|----------|
| Overview | Name, level, class, ancestry, background, HP gauge, AC, initiative, speed, proficiency bonus |
| Abilities | Six ability scores with modifier callouts; saving throw proficiencies |
| Skills | All skills with proficiency markers, passive scores |
| Saves | Saving throw values with advantage/disadvantage flags |
| Inventory | Item list with weight, quantity, equipped state |
| Equipment | Armor, weapons, shields — attack bonus and damage auto-computed |
| Spells | Spell slots, prepared spells, concentration tracker |
| Features | Class features, racial traits, background features |
| Conditions | Active conditions with duration and effect description |
| Notes | Freeform text; supports rich text in Phase 7+ |

The engine reads from structured sheet fields. It does not parse the Notes tab.

### Text Hierarchy

```
H1  — font-display, 4xl–6xl, gradient-arcane    (landing, chapter titles)
H2  — font-display, 2xl–3xl, white              (section headers)
H3  — font-display, xl, void-200                (panel titles, location names)
Body  — font-body, base, void-200–white          (UI copy, labels)
Lore  — font-lore italic, void-200               (AI narration, flavor)
Label — stat-label (mono, xs, uppercase, tracking-widest, void-400)
Stat  — font-mono, varies, white/arcane          (all game numbers)
```

---

## Layout Modes

The game UI has three primary layout modes. Each is a distinct React shell with different panel compositions.

### Exploration Mode
```
┌─────────────────────────────────┐
│  Location Header + Quest Status │
├──────────┬──────────────────────┤
│  Mini-   │  Narration Panel     │
│  Map /   │  (AI lore text)      │
│  Scene   ├──────────────────────┤
│  Preview │  Action Input        │
│          │  + Suggested Actions │
├──────────┴──────────────────────┤
│  Character Bar (HP/AC/Status)   │
└─────────────────────────────────┘
```

### Combat Mode
```
┌─────────────────────────────────┐
│  Initiative Tracker (turn order)│
├──────────────────┬──────────────┤
│  Enemy Sprite /  │  Player      │
│  Token Area      │  Sprite /    │
│  (enemy HP bars) │  Token Area  │
├──────────────────┴──────────────┤
│  AI Narration (1–2 lines)       │
├─────────────────────────────────┤
│  Action Menu: Atk Spl Itm Def Fl│
├─────────────────────────────────┤
│  Combat Log (expandable)        │
└─────────────────────────────────┘
```

### Map Mode
```
┌─────────────────────────────────┐
│  Campaign / Location Breadcrumb │
├──────────────────┬──────────────┤
│                  │  Layer Panel │
│  Map Canvas      │  (DM/Player) │
│  (tile grid +    │  Token list  │
│  fog of war)     │  Quick stats │
│                  │              │
├──────────────────┴──────────────┤
│  Map Controls (zoom, layers)    │
└─────────────────────────────────┘
```

---

## Animation

Every animation must justify its presence. Animations signal state change — they are not decoration.

| Animation | Token | Use |
|-----------|-------|-----|
| Panel entrance | `animate-fade-in` | Page load, mode transitions |
| Action result | `animate-slide-up` | Dice result reveal, narration |
| Ambient | `animate-flicker` | Candles, fires — never on game-critical UI |
| AI loading | `animate-pulse-arcane` | Waiting for Director narration |
| Damage number | float-up + fade | HP reduction (custom, Phase 5) |
| Critical hit | `animate-arcane-flash` | 200ms full-panel gold flash (Phase 5) |
| Turn transition | `animate-slide-up` | "YOUR TURN" announcement |

**Rules:**
- Respect `prefers-reduced-motion` everywhere.
- No infinite animations on interactive UI elements.
- Damage float animations play once and are removed from DOM after completion.
- AI streaming text: no animation on the text itself. Pulse on the loading indicator only.

---

## Accessibility

- All interactive elements must have visible focus rings (`focus-visible:ring-2 ring-arcane-400`)
- All images and icons conveying game information need `aria-label` or `alt`
- Loading states: `role="status"` and `aria-live="polite"`
- Color alone never communicates state — always pair with icon or text label
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Combat action menu: fully keyboard navigable (arrow keys + Enter)
- Character sheet tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA pattern
- Map canvas: keyboard pan controls + screen-reader summary of visible tokens

---

## Code Style

### Component Pattern
```tsx
// Named export for UI components
export function Button({ variant = 'arcane', ...props }: ButtonProps) {}

// Default export for page and layout components
export default function DashboardPage() {}

// Game panel components live in src/components/adventure/
export function BattleScreen({ session, character, enemies }: BattleScreenProps) {}
```

### Props Pattern
- Interface over type for component props
- Extend HTML element props where appropriate
- Avoid prop drilling beyond 2 levels — use Zustand or context
- Game state (combat, map, sheet) lives in dedicated Zustand stores, not prop chains

### Class Names
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- Long class strings: multi-line template literal or array join
- Never inline conditional logic in JSX className — extract to a `const classes` variable

---

## Chronicle Design System (Phase 15.1)

Reusable component layer built on top of everything above — new screens
(including a future WorldSmith module) should reach for these first
instead of hand-rolling panel/button/icon/text markup.

### Components

| Component | File | Purpose |
|---|---|---|
| `Window` | `src/components/pixel/Window.tsx` | Shared title-bar + scrollable body + optional footer. Use for any new panel that needs a header. |
| `Icon` | `src/components/pixel/Icon.tsx` | Named registry over the emoji glyphs already used as icons (`<Icon name="dice" />`). See the file for the full `IconName` list. A real SVG pixel-icon set can swap in later behind the same API. |
| `Typography` | `src/components/pixel/Typography.tsx` | `LargeTitle`, `LocationTitle`, `SectionHeader`, `SubHeader`, `NpcName`, `Dialogue`, `StoryText`, `SystemText`, `StatLabel`, `TinyLabel`, `StatNumber` — named wrappers over the Text Hierarchy above. UI 2.0 tiers: headers gold, subheaders copper, body parchment, numbers ivory. |
| `Button` variants | `src/components/ui/Button.tsx` | Adds `navigation`, `menuAction`, `suggested`, `iconOnly` to the existing `arcane`/`spirit`/`ghost`/`danger` set — see the file's own header comment for the full role-to-variant mapping. |
| `locationIcons` | `src/components/adventure/locationIcons.ts` | Shared `LOCATION_ICON`/`LOCATION_TYPE_LABEL` maps (single source of truth for AtlasPanel and AdventureScenePanel). |
| Animations | `src/styles/pixel.css` | `pixel-type-dot` (typing indicator), `pixel-sparkle` (hover/focus flourish), `dialogue-reveal` (turn-block entrance) — all reduced-motion safe (see the kill-list at the bottom of that file; add new animations there too). |

### Deferred (not migrated in Phase 15)

These exist so the next contributor doesn't assume they were missed —
they were deliberately left alone to keep each Phase 15 commit small and
avoid destabilizing large, heavily-tested surfaces in one pass:

- **`Window` migration**: `AtlasPanel`, `CombatPanel`, `DicePanel`,
  `CharacterSidebar` still hand-roll their own headers (83/25/18/18
  tests respectively — a real retrofit risk for a single phase).
- **`Icon` migration**: `AtlasPanel`'s `LOCATION_ICON` consumers,
  `QuestsPanel`'s `STATUS_META`, `CodexPanel`'s alive/dead glyphs, and
  `ActionBar`'s weapon/spell/item submenu icons still use raw emoji
  literals directly.
- **Real SVG pixel-icon asset set**: `Icon` centralizes existing emoji;
  it does not introduce new artwork or an asset pipeline.
- **Weather / mood fields**: still do not exist on `WorldState` — the
  scene panel and header only show real fields (location, region,
  worldTime, turn, tone, difficulty) and reserve visually-labeled space
  for when Phase 10 (Living World) adds them for real.
- **Living Atlas** (tile canvas, fog of war, DM/player map layers):
  `AtlasMapPanel` (Phase 15.3) is a static room-grid placeholder
  establishing the mental model only — the full system is the
  Constitution's separate, larger Phase 6.

---

## UI 2.0 — Dark Fantasy Re-theme

The first real exercise of the "swap the palette without touching
components" promise: the entire GBA-gold → dark-fantasy repaint (tokens,
panel lighting/texture, carved-plaque buttons, torch-lit sidebar, bronze
story box, gold/copper/parchment/ivory typography, ember animations)
landed with zero component-API changes and zero test churn.

**Color ratio target** (keeps the UI dark and immersive; check new
screens against it): ~55% dark charcoal/black (`void`), ~20% warm
walnut (`panel`), ~15% bronze/gold (`bronze`), ~7% ember (`arcane`),
~3% status accents (`heal`/`harm`/`spirit`/`mystic`).

**Every panel is torchlit**: outer drop shadow + inset warm top
highlight + inset bottom depth shadow, plus a faint CSS-only grain so
surfaces never read as flat color. The recipe lives once in
`.chr-panel` (globals.css) and `.pixel-border*` (pixel.css) — don't
hand-roll it per component.

### UI 2.0 deferred

- **`mystic` (blue magic accent)**: token exists, deliberately unused so
  far — apply it when spell/magic-specific UI (spell slots, concentration,
  magic-item rarity) gets its own visual pass. Never use it as a general
  highlight.
- **Real bitmap textures** (wood/parchment photography or painted tiles):
  the CSS gradient + SVG-noise grain reads well at panel scale; revisit
  only if a future art pass wants more literal carved-oak surfaces.
- **`spirit` teal**: retained as-is for system feedback (MP, DC chips,
  enemy HP). It's the remaining cool accent by design — the 3% tier —
  not an oversight.

---

*Last updated: UI 2.0 (Dark Fantasy Re-theme)*
