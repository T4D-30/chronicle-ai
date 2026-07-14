/**
 * Typography — Phase 15.1 (Chronicle Design System), repainted UI 2.0
 *
 * Thin named wrappers over the type scale defined in docs/STYLE_GUIDE.md
 * ("Text Hierarchy") — a single named place to read/reuse the scale
 * instead of every screen re-deriving font classes by hand.
 *
 * UI 2.0 color assignments (the dark-fantasy warmth pass):
 *   Headers      → warm gold      (bronze-300)
 *   Subheaders   → copper         (arcane-600)
 *   Body/story   → warm parchment (void-100/200 — the repainted void
 *                   light stops ARE parchment-toned; no separate token)
 *   Numbers/stats→ bright ivory   (void-50 — brighter than body, warmer
 *                   than pure #fff)
 */

import type { ElementType, HTMLAttributes, ReactNode } from 'react'

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  /** Override the rendered tag when the default semantic element doesn't fit. */
  as?: ElementType
}

function makeText(defaultTag: ElementType, baseClassName: string, displayName: string) {
  function Text({ as, className, children, ...rest }: TypographyProps) {
    const Tag = as ?? defaultTag
    const classes = className ? `${baseClassName} ${className}` : baseClassName
    return (
      <Tag className={classes} {...rest}>
        {children}
      </Tag>
    )
  }
  Text.displayName = displayName
  return Text
}

/** Landing/chapter titles. Verbatim from LandingPage's H1 treatment. */
export const LargeTitle = makeText(
  'h1',
  'font-pixel-display text-3xl md:text-5xl leading-relaxed text-gradient-arcane pixel-crisp',
  'LargeTitle',
)

/** Scene location name. Verbatim from AdventureScenePanel's location title. */
export const LocationTitle = makeText(
  'h1',
  'font-display text-xl font-bold text-gradient-arcane truncate',
  'LocationTitle',
)

/** Panel/section titles — warm gold (UI 2.0 "Headers" tier). */
export const SectionHeader = makeText(
  'h2',
  'font-display text-xl text-bronze-300',
  'SectionHeader',
)

/** Subsection headings — copper (UI 2.0 "Subheaders" tier). */
export const SubHeader = makeText(
  'h3',
  'font-display text-base font-semibold text-arcane-600',
  'SubHeader',
)

/** Character/NPC name display — bright ivory, warmer than pure white. */
export const NpcName = makeText(
  'p',
  'font-display font-bold text-void-50 truncate leading-tight',
  'NpcName',
)

/** AI-spoken narration and NPC dialogue. Verbatim from the existing `.lore-text` class. */
export const Dialogue = makeText('p', 'lore-text', 'Dialogue')

/** Narrator prose / turn history. Same visual family as Dialogue — see `.lore-text`. */
export const StoryText = makeText('p', 'lore-text', 'StoryText')

/** System/status messages (streaming state, save confirmations). Verbatim
 *  from StoryPanel's "Director speaking…" label. */
export const SystemText = makeText('p', 'stat-label text-spirit-500', 'SystemText')

/** Stat-block labels. Wraps the existing `.stat-label` class. */
export const StatLabel = makeText('p', 'stat-label', 'StatLabel')

/** Micro labels inside dense stat blocks. Verbatim from CharacterSidebar's
 *  section labels ("Ability Modifiers", "Passive Skills", etc). */
export const TinyLabel = makeText(
  'p',
  'font-pixel-display text-[8px] text-void-400 uppercase',
  'TinyLabel',
)

/** Mechanically-meaningful numbers (HP, AC, modifiers, dice totals) —
 *  bright ivory mono, the brightest text tier (UI 2.0 "Numbers"). */
export const StatNumber = makeText(
  'span',
  'font-mono text-void-50 tabular-nums',
  'StatNumber',
)
