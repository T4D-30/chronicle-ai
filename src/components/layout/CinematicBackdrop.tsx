/**
 * CinematicBackdrop — shared full-bleed backdrop for marketing/auth screens
 * (Landing, Login, Signup). Layered radial glow + vignette (see .bg-cinematic
 * in globals.css) with optional ambient fireflies for depth. Purely
 * decorative: aria-hidden and pointer-events-none, same pattern as
 * AmbientOverlay. Intended to sit inside a `relative` page container, behind
 * `relative z-10` content.
 */

import { AmbientOverlay } from '@/components/pixel'
import { cn } from '@/lib/cn'

interface CinematicBackdropProps {
  /** Ambient firefly particle count. Set to 0 to disable. */
  fireflyCount?: number
  className?: string
}

export function CinematicBackdrop({ fireflyCount = 14, className }: CinematicBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-0 overflow-hidden pointer-events-none z-0 bg-cinematic', className)}
    >
      {fireflyCount > 0 && <AmbientOverlay kind="fireflies" count={fireflyCount} />}
    </div>
  )
}
