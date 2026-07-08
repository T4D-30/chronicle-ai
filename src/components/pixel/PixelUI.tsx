/**
 * Pixel UI Components — Phase 9.0
 *
 * Retro GBA/NDS-style presentational components.
 * Purely additive — the existing ui/ primitives remain untouched.
 * All components respect prefers-reduced-motion (handled in pixel.css).
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

// ─── PixelPanel ───────────────────────────────────────────────────────────────

type PixelPanelVariant = 'default' | 'arcane' | 'harm' | 'spirit'

const PANEL_VARIANTS: Record<PixelPanelVariant, string> = {
  default: 'pixel-border bg-panel-900',
  arcane:  'pixel-border-arcane bg-panel-900',
  harm:    'pixel-border-harm bg-panel-900',
  spirit:  'pixel-border-spirit bg-panel-900',
}

interface PixelPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PixelPanelVariant
  /** Adds a warm animated torch glow around the panel. */
  glow?: boolean
}

export const PixelPanel = forwardRef<HTMLDivElement, PixelPanelProps>(
  ({ variant = 'default', glow = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(PANEL_VARIANTS[variant], glow && 'torch-glow', className)}
      {...props}
    >
      {children}
    </div>
  ),
)
PixelPanel.displayName = 'PixelPanel'

// ─── PixelButton ──────────────────────────────────────────────────────────────

type PixelButtonVariant = 'arcane' | 'harm' | 'spirit' | 'neutral'

const BUTTON_VARIANTS: Record<PixelButtonVariant, string> = {
  arcane:  'bg-arcane-600 text-void-950 border-arcane-700',
  harm:    'bg-harm-600 text-white border-red-900',
  spirit:  'bg-spirit-600 text-void-950 border-spirit-800',
  neutral: 'bg-panel-800 text-void-200 border-bronze-800',
}

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant
  /** Shows the blinking ▶ selection cursor before the label. */
  selected?: boolean
}

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ variant = 'neutral', selected = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'pixel-btn font-pixel-body px-3 py-1.5 text-base',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        selected && 'pixel-cursor',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
PixelButton.displayName = 'PixelButton'

// ─── PixelBar (HP / XP / MP) ─────────────────────────────────────────────────

interface PixelBarProps {
  /** Current value. */
  value: number
  /** Maximum value. */
  max: number
  /** Bar semantic: hp (green→gold→red by fraction), xp (gold), mp (teal). */
  kind?: 'hp' | 'xp' | 'mp'
  /** Short label rendered inside the bar (e.g. "HP"). */
  label?: string
  /** Show "value/max" text. */
  showNumbers?: boolean
  className?: string
}

/** HP color follows the battle-screen rule: full → half → critical. */
function hpColor(fraction: number): string {
  if (fraction > 0.5) return 'bg-heal-400'
  if (fraction > 0.25) return 'bg-arcane-400'
  return 'bg-harm-400'
}

export function PixelBar({
  value, max, kind = 'hp', label, showNumbers = true, className,
}: PixelBarProps) {
  const safeMax = Math.max(1, max)
  const clamped = Math.max(0, Math.min(value, safeMax))
  const fraction = clamped / safeMax
  const pct = Math.round(fraction * 100)

  const fillColor =
    kind === 'hp' ? hpColor(fraction) :
    kind === 'xp' ? 'bg-arcane-400' :
    'bg-spirit-400'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className="font-pixel-display text-[8px] text-void-300 uppercase flex-shrink-0">
          {label}
        </span>
      )}
      <div
        className="pixel-bar-track h-4 flex-1 relative"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label ? `${label}: ${clamped} of ${safeMax}` : `${clamped} of ${safeMax}`}
      >
        <div
          className={cn('pixel-bar-fill', fillColor)}
          style={{ width: `${pct}%` }}
          data-testid="pixel-bar-fill"
        />
      </div>
      {showNumbers && (
        <span className="font-pixel-body text-sm text-void-300 flex-shrink-0 tabular-nums">
          {clamped}/{safeMax}
        </span>
      )}
    </div>
  )
}

// ─── PixelCard ────────────────────────────────────────────────────────────────

interface PixelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card title shown in the header strip. */
  title: string
  /** Small icon/emoji shown before the title. */
  icon?: string
  variant?: PixelPanelVariant
  /** Footer strip content (e.g. rarity, cost, level). */
  footer?: React.ReactNode
}

/**
 * Classic handheld-RPG item/entity card:
 * header strip + body + optional footer strip.
 */
export const PixelCard = forwardRef<HTMLDivElement, PixelCardProps>(
  ({ title, icon, variant = 'default', footer, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(PANEL_VARIANTS[variant], 'flex flex-col', className)}
      {...props}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b-2 border-bronze-800 bg-panel-800">
        {icon && <span aria-hidden="true" className="text-sm leading-none">{icon}</span>}
        <span className="font-pixel-display text-[9px] text-bronze-400 uppercase truncate">
          {title}
        </span>
      </div>
      <div className="p-2 flex-1 font-pixel-body text-base text-void-200">
        {children}
      </div>
      {footer && (
        <div className="px-2 py-1 border-t-2 border-bronze-800 bg-panel-800 font-pixel-body text-sm text-void-400">
          {footer}
        </div>
      )}
    </div>
  ),
)
PixelCard.displayName = 'PixelCard'

// ─── DamageNumber ─────────────────────────────────────────────────────────────

interface DamageNumberProps {
  /** The number to display. */
  amount: number
  /** damage (red), heal (green), crit (gold, larger), miss (grey "MISS"). */
  kind?: 'damage' | 'heal' | 'crit' | 'miss'
  className?: string
}

const DAMAGE_COLORS = {
  damage: 'text-harm-400 text-sm',
  heal:   'text-heal-400 text-sm',
  crit:   'text-arcane-300 text-lg',
  miss:   'text-void-400 text-sm',
}

/**
 * Floating combat number. Render inside a `relative` parent;
 * it animates upward and fades via the damage-float keyframes.
 */
export function DamageNumber({ amount, kind = 'damage', className }: DamageNumberProps) {
  const text =
    kind === 'miss' ? 'MISS' :
    kind === 'heal' ? `+${amount}` :
    `${amount}`

  return (
    <span
      className={cn('damage-popup absolute left-1/2 -translate-x-1/2', DAMAGE_COLORS[kind], className)}
      role="status"
      aria-label={
        kind === 'miss' ? 'Attack missed' :
        kind === 'heal' ? `Healed ${amount}` :
        kind === 'crit' ? `Critical hit for ${amount}` :
        `${amount} damage`
      }
      data-testid={`damage-number-${kind}`}
    >
      {kind === 'crit' && <span aria-hidden="true">✦</span>}
      {text}
      {kind === 'crit' && <span aria-hidden="true">✦</span>}
    </span>
  )
}
