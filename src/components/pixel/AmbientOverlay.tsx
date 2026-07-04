/**
 * AmbientOverlay — Phase 9.0
 *
 * Renders decorative pixel particles (fireflies, rain, snow, fog) over
 * the adventure view. Pointer-events disabled; aria-hidden; fully
 * suppressed under prefers-reduced-motion (see pixel.css).
 *
 * The ambience kind is presentation-only. It can be driven by the
 * campaign's world state weather/location in a future wiring pass.
 */

import { useMemo } from 'react'
import { cn } from '@/lib/cn'

export type AmbienceKind = 'none' | 'fireflies' | 'rain' | 'snow' | 'fog'

interface AmbientOverlayProps {
  kind: AmbienceKind
  /** Particle count (default varies by kind). Clamped 0–60. */
  count?: number
  className?: string
}

interface Particle {
  left: string
  top: string
  delay: string
  duration: string
  driftX: string
  driftY: string
  sway: string
}

function makeParticles(count: number, seed: number): Particle[] {
  // Deterministic pseudo-random so renders are stable (no test flake)
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }, () => ({
    left: `${Math.round(rand() * 100)}%`,
    top: `${Math.round(rand() * 100)}%`,
    delay: `${(rand() * 6).toFixed(2)}s`,
    duration: `${(3 + rand() * 6).toFixed(2)}s`,
    driftX: `${Math.round(rand() * 60 - 30)}px`,
    driftY: `${Math.round(-10 - rand() * 40)}px`,
    sway: `${Math.round(rand() * 48 - 24)}px`,
  }))
}

const DEFAULT_COUNTS: Record<AmbienceKind, number> = {
  none: 0, fireflies: 14, rain: 40, snow: 30, fog: 0,
}

export function AmbientOverlay({ kind, count, className }: AmbientOverlayProps) {
  const n = Math.max(0, Math.min(count ?? DEFAULT_COUNTS[kind], 60))
  const particles = useMemo(() => makeParticles(n, 42), [n])

  if (kind === 'none') return null

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
      aria-hidden="true"
      data-testid={`ambient-${kind}`}
    >
      {kind === 'fog' && <div className="particle-fog" />}
      {kind === 'fireflies' && particles.map((p, i) => (
        <span
          key={i}
          className="particle-firefly"
          style={{
            left: p.left, top: p.top,
            animationDelay: p.delay,
            ['--duration' as string]: p.duration,
            ['--drift-x' as string]: p.driftX,
            ['--drift-y' as string]: p.driftY,
          }}
        />
      ))}
      {kind === 'rain' && particles.map((p, i) => (
        <span
          key={i}
          className="particle-rain"
          style={{
            left: p.left,
            animationDelay: p.delay,
            ['--duration' as string]: `${0.6 + (i % 5) * 0.12}s`,
          }}
        />
      ))}
      {kind === 'snow' && particles.map((p, i) => (
        <span
          key={i}
          className="particle-snow"
          style={{
            left: p.left,
            animationDelay: p.delay,
            ['--duration' as string]: p.duration,
            ['--sway' as string]: p.sway,
          }}
        />
      ))}
    </div>
  )
}
