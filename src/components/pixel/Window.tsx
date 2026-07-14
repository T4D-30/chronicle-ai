/**
 * Window — Phase 15.1 (Chronicle Design System)
 *
 * One shared title-bar + scrollable body + optional footer, so panels stop
 * hand-rolling their own header markup. The title-bar/body classes below
 * are copied verbatim from QuestsPanel/CodexPanel's existing structure
 * (`flex-shrink-0 px-4 pt-4 pb-2` header, `flex-1 overflow-y-auto min-h-0
 * px-4 pb-4` body) — migrating those panels onto `Window` is a structural
 * no-op for them. The one visible addition is a hairline divider under the
 * title (reusing the existing `.chr-divider` class — no new CSS needed)
 * so "window" reads as a real, bordered chrome element rather than just
 * a text label floating above content.
 *
 * Not migrated onto this component in Phase 15: AtlasPanel, CombatPanel,
 * DicePanel, CharacterSidebar — see the Phase 15 plan for why (large,
 * heavily-tested surfaces deliberately left for a later, lower-risk pass).
 */

import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

interface WindowProps {
  title: string
  icon?: IconName
  /** When set, the scrollable body gets `role="region" aria-label={regionLabel}`
   *  — matches the accessible-region pattern QuestsPanel/CodexPanel already use. */
  regionLabel?: string
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function Window({
  title,
  icon,
  regionLabel,
  footer,
  className,
  bodyClassName,
  children,
}: WindowProps) {
  const regionProps = regionLabel ? { role: 'region' as const, 'aria-label': regionLabel } : {}

  return (
    <div
      className={['flex flex-col h-full overflow-hidden', className].filter(Boolean).join(' ')}
      data-testid="window"
    >
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          {icon && <Icon name={icon} className="text-xs leading-none" />}
          <p className="font-pixel-display text-[10px] text-arcane-400 uppercase">{title}</p>
        </div>
        <div className="chr-divider mt-2" aria-hidden="true" />
      </div>

      <div
        className={['flex-1 overflow-y-auto min-h-0 px-4 pb-4 pt-2', bodyClassName].filter(Boolean).join(' ')}
        {...regionProps}
      >
        {children}
      </div>

      {footer && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-void-700/50">
          {footer}
        </div>
      )}
    </div>
  )
}
