/**
 * CameraLayer — Presentation 2 (Exploration Presence)
 *
 * The world stops being a flat wallpaper and becomes a camera looking
 * at layered depth (UI_VISION.md Concept 2, "Cameras, not Pages"):
 *
 *   sky → background → midground → player → foreground
 *
 * Every plane drifts horizontally with the same slow period but a
 * depth-scaled amplitude — distant planes barely move, near planes
 * move most — which reads as a subtle handheld-camera parallax. The
 * sky never moves. Motion is one shared CSS keyframe (camera-drift,
 * pixel.css) with a per-plane amplitude variable: GPU transforms only,
 * no JS, killed under prefers-reduced-motion.
 *
 * Deliberately tiny (≤0.9% translation over ~48s): per the vision
 * doc's atmosphere rules the player should stop noticing it within
 * seconds. Never distracting.
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CameraDepth = 'sky' | 'background' | 'midground' | 'player' | 'foreground'

/** Parallax amplitude factor per depth — sky is pinned. */
const PARALLAX_FACTOR: Record<CameraDepth, number> = {
  sky: 0,
  background: 0.3,
  midground: 0.55,
  player: 0.75,
  foreground: 1,
}

const Z_INDEX: Record<CameraDepth, number> = {
  sky: 0,
  background: 1,
  midground: 2,
  player: 3,
  foreground: 4,
}

interface CameraPlaneProps {
  depth: CameraDepth
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** One depth plane of the world camera. Absolute-positioned; parents
 *  provide the relative frame (AdventureWorldPreview's root). */
export function CameraPlane({ depth, children, className, style }: CameraPlaneProps) {
  const factor = PARALLAX_FACTOR[depth]
  return (
    <div
      className={cn('absolute inset-0', factor > 0 && 'camera-drift', className)}
      style={{
        zIndex: Z_INDEX[depth],
        ...(factor > 0
          ? { ['--camera-amplitude' as string]: `${(factor * 0.9).toFixed(2)}%` }
          : {}),
        ...style,
      }}
      data-testid={`camera-plane-${depth}`}
      data-depth={depth}
    >
      {children}
    </div>
  )
}
