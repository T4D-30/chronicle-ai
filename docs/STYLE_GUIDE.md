# Chronicle AI — Style Guide

---

## Design Language

**Aesthetic reference**: Premium Game Boy Advance / Nintendo DS fantasy RPG. Think Golden Sun, Fire Emblem: Sacred Stones, Final Fantasy Tactics Advance, Castlevania: Aria of Sorrow. Warm, immediate, visually structured. High contrast between UI chrome and content. Every pixel has a job.

**Mechanical reference**: D&D 5e / Roll20. Character sheets, stat blocks, and dice results look familiar to anyone who has played at a digital table.

**Palette Philosophy**: The void is the canvas — deep space backgrounds that make color pop. Arcane gold is action and reward. Spirit teal is the system communicating. Warm amber and pixel-crisp borders frame every game panel. These colors carry semantic meaning; they are never purely decorative.

The two registers (GBA warmth + dark fantasy depth) must coexist. Dark backgrounds. Bright, saturated panel borders. Pixel-adjacent corner treatments on UI chrome. Soft glow effects reserved for magical events.

---

## Color System

| Token | Hex | Use |
|-------|-----|-----|
| `void-950` | `#050510` | Page background, deep UI shadow |
| `void-900` | `#0a0a1a` | Panel backgrounds |
| `void-700` | `#1e1e45` | Borders, dividers |
| `void-400` | `#5c5c98` | Muted text, disabled labels |
| `arcane-400` | `#f7cf4d` | Highlights, active state borders, CTA text, XP |
| `arcane-600` | `#c27505` | CTA button backgrounds, selected state |
| `spirit-400` | `#3bcac0` | System feedback, secondary actions, MP/mana |
| `harm-400` | `#f87171` | Damage numbers, error states, poison indicator |
| `heal-400` | `#4ade80` | Healing numbers, success states, buffs |

**Semantic rules — do not break these:**
- `arcane-*` means "action available" or "important reward." Never decorative.
- `spirit-*` means "the system is informing you." Never narrative prose.
- `harm-*` is exclusively for damage, errors, and negative conditions.
- `heal-*` is exclusively for healing, successes, and positive conditions.
- `warning-*` (`warning-400 #fb923c` / `warning-600 #ea580c`) is exclusively
  for caution states that are not yet errors (e.g. "irreversible action,"
  low-but-not-critical resources) — distinct from `arcane-*`, which means
  "action available," not "be careful."
- White text on void backgrounds only. No light mode.

### Generic token names (Phase 15 design-system mapping)

The design system is sometimes described in generic terms (Background,
Surface, Panel, Border, Gold, Success, Danger, Muted, Highlight, Selected,
Disabled). These are **not new tokens** — they already exist under the
semantic names above. This table exists so nobody reinvents them:

| Generic name | Existing token |
|---|---|
| Background | `void-950` |
| Surface / Panel | `void-900` |
| Border | `void-700` |
| Gold | `arcane-400` / `arcane-300` |
| Arcane | `arcane-*` |
| Success | `heal-400` |
| Danger | `harm-400` |
| Warning | `warning-400` |
| Muted | `void-400` |
| Highlight | `arcane-300` |
| Selected | `arcane-600` |
| Disabled | `void-700` (border) + reduced opacity, per component |

Because every component already reads these through Tailwind classes (not
hardcoded hex values), a future theme only requires swapping the palette in
`tailwind.config.ts` — no component changes needed.

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

*Last updated: Phase 1.2*
