import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

/**
 * Phase 15.1 (Chronicle Design System) — variant coverage for the phase's
 * requested button roles:
 *   Primary          → `arcane`      (existing)
 *   Secondary        → `ghost`       (existing — Style Guide: "Navigation /
 *                                      secondary → ghost")
 *   System feedback  → `spirit`      (existing)
 *   Danger           → `danger`      (existing)
 *   Navigation       → `navigation`  (new — AdventureLeftNav's row style)
 *   Menu             → `menuAction`  (new — flat selectable menu row)
 *   Suggested Action → `suggested`   (new — verbatim from AdventureHub's
 *                                      suggested-action chips)
 *   Pixel Icon       → `iconOnly`    (new — compact square icon button)
 *   Combat           → intentionally not duplicated here. ActionBar's
 *                       `CombatActionBtn` already owns this role (a
 *                       stacked icon+label JRPG menu button with 4 color
 *                       sub-variants) and isn't migrated onto generic
 *                       Button in this pass — see Phase 15 plan.
 */
export type ButtonVariant =
  | 'arcane'
  | 'spirit'
  | 'ghost'
  | 'danger'
  | 'navigation'
  | 'menuAction'
  | 'suggested'
  | 'iconOnly'
export type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  arcane: [
    'bg-arcane-600 hover:bg-arcane-500 active:bg-arcane-700',
    'text-void-950 font-semibold',
    'border border-arcane-500/50',
    'shadow-arcane hover:shadow-arcane',
  ].join(' '),
  spirit: [
    'bg-spirit-700 hover:bg-spirit-600 active:bg-spirit-800',
    'text-white font-semibold',
    'border border-spirit-500/50',
    'shadow-spirit hover:shadow-spirit',
  ].join(' '),
  ghost: [
    'bg-transparent hover:bg-void-800 active:bg-void-700',
    'text-void-200 hover:text-white',
    'border border-void-700/50 hover:border-void-600',
  ].join(' '),
  danger: [
    'bg-harm-600 hover:bg-harm-400/80 active:bg-harm-600',
    'text-white font-semibold',
    'border border-harm-400/30',
  ].join(' '),
  // Verbatim from AdventureLeftNav.tsx's inactive nav-row treatment.
  // Active/selected highlighting stays a call-site concern for now (no
  // generic "selected" concept exists on Button yet).
  navigation: [
    'justify-start text-left rounded',
    'font-body text-sm font-medium',
    'bg-transparent text-void-400 hover:text-void-200 hover:bg-void-800/50',
    'border border-transparent border-l-2',
  ].join(' '),
  // Flat, full-width selectable menu row (inventory lists, spell lists,
  // future WorldSmith menus) — distinct from `ghost`'s centered pill shape.
  menuAction: [
    'justify-start text-left',
    'bg-void-900 hover:bg-void-800 active:bg-void-950',
    'text-void-200 hover:text-white font-body font-semibold',
    'border border-void-700/50 hover:border-void-600',
  ].join(' '),
  // Verbatim from AdventureHub.tsx's suggested-action chips.
  suggested: [
    'rounded-full px-3 py-1.5 text-xs font-body',
    'border border-arcane-800/50 bg-arcane-900/20 text-arcane-300',
    'hover:bg-arcane-900/40 hover:border-arcane-600',
  ].join(' '),
  // Compact square icon-only button, reusing the pixel-btn raised-key feel.
  iconOnly: [
    'w-9 h-9 p-0 rounded',
    'pixel-btn bg-void-900 border-void-700 text-void-400 hover:text-void-200',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-4 py-2 text-base rounded-md',
  lg: 'px-6 py-3 text-lg rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'arcane', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Size before variant: none of the original 4 variants set
          // shape (rounded/padding) classes, so this reorder is a no-op
          // for them — but the new `suggested`/`iconOnly` variants do
          // set their own shape, which needs to win over the generic
          // per-size rounded/padding defaults below.
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
