/**
 * Icon — Phase 15.1 (Chronicle Design System)
 *
 * A single named registry for the emoji glyphs already used as icons
 * across the adventure UI. There is no SVG/pixel-art icon asset set yet
 * (a real one is future scope) — this component centralizes the *existing*
 * glyphs behind semantic names so call sites stop repeating raw emoji
 * literals, and so a future real icon set can swap in behind this same
 * `<Icon name="..." />` API without touching every call site again.
 *
 * Every glyph below is copied verbatim from its current call site — this
 * is a consolidation pass, not a re-design of what icon means what.
 * Two names intentionally point to the same glyph where the codebase
 * already renders the identical emoji for two related concepts (e.g.
 * `character`/`attack` both render the existing "⚔️"). Two visually
 * similar map glyphs (`atlas` "🗺" vs `questsMap` "🗺️") are kept distinct
 * on purpose — the app already renders them differently at different call
 * sites today, and unifying them would be a visual change, not a refactor.
 */

import type { HTMLAttributes } from 'react'

export type IconName =
  | 'look'
  | 'inventory'
  | 'character'
  | 'attack'
  | 'atlas'
  | 'journal'
  | 'quest'
  | 'rest'
  | 'dice'
  | 'spell'
  | 'defend'
  | 'move'
  | 'flee'
  | 'story'
  | 'questsMap'
  | 'world'
  | 'codex'
  | 'debug'
  | 'home'
  | 'settings'
  | 'brand'
  | 'status'

const ICONS: Record<IconName, string> = {
  look: '👁',
  inventory: '🎒',
  character: '⚔️',
  attack: '⚔️',
  atlas: '🗺',
  journal: '📜',
  quest: '⚡',
  rest: '🌙',
  dice: '🎲',
  spell: '✨',
  defend: '🛡',
  move: '👣',
  flee: '🏃',
  story: '📖',
  questsMap: '🗺️',
  world: '🌍',
  codex: '📚',
  debug: '🔧',
  home: '🏠',
  settings: '⚙️',
  brand: '🔥',
  status: '📊',
}

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: IconName
}

/** Decorative by default (`aria-hidden`) — every current call site already
 *  carries its own accessible label on the parent control. */
export function Icon({ name, ...rest }: IconProps) {
  return (
    <span aria-hidden="true" {...rest}>
      {ICONS[name]}
    </span>
  )
}

/** For call sites that pass a raw glyph string into an existing prop
 *  (e.g. a sub-component that already renders its own icon span) rather
 *  than rendering `<Icon>` directly — keeps the registry as the one
 *  source of truth either way. */
export function resolveIcon(name: IconName): string {
  return ICONS[name]
}
