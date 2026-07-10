/**
 * WorldRenderer — UI 3.0 (Pixel RPG Experience)
 *
 * UI_VISION.md Concept 3: the one reusable surface that draws the world
 * behind every screen. Screens never hand-roll their own backgrounds —
 * they mount this with a scene name and overlay their UI (world →
 * atmosphere → chrome layering, Concept 4).
 *
 * PROCEDURAL NOW, REAL ART LATER (asset-slot pattern, UI_VISION.md):
 * on mount this probes `public/assets/sprites/environments/<scene>.png`.
 * If a real backdrop exists it renders that image (pixel-crisp,
 * cover-fit) — dropping pixel art or future AI art into that folder
 * upgrades every consumer with zero code changes. Until then it renders
 * procedural scenery: a sky gradient, hand-authored SVG silhouette
 * bands with per-layer parallax drift (nearer = larger/faster), and a
 * scene-specific light source (campfire glow, dusk horizon, dawn rim).
 * In jsdom the probe never resolves, so tests always exercise the
 * procedural fallback deterministically.
 *
 * DECORATIVE-ON-MENUS ONLY (Concept 7): this renderer is for the
 * title/menu/auth screens. In-game scenery must derive from real world
 * state and arrives with the Living World phase — AdventureHub's
 * honest-ambience rule is unaffected.
 *
 * All motion is CSS (`world-band`/`world-clouds`, pixel.css), slow, and
 * killed under prefers-reduced-motion — a reduced-motion player gets a
 * still painting.
 */

import { useEffect, useState } from 'react'
import { AmbientOverlay } from './AmbientOverlay'
import type { AmbienceKind } from './AmbientOverlay'
import { cn } from '@/lib/cn'

export type WorldScene = 'night-camp' | 'dusk-vale' | 'dawn-ridge'
export type WorldTint = 'night' | 'dusk' | 'dawn'

interface BandSpec {
  /** Polygon points for a 100×40 viewBox ridge silhouette. */
  points: string
  fill: string
  /** Drift amplitude (CSS length/percent) — nearer bands drift more. */
  drift: string
  driftDuration: string
}

interface SceneSpec {
  tint: WorldTint
  /** Sky gradient, top → horizon. */
  sky: string
  bands: BandSpec[]
  /** Radial light source (campfire / dusk horizon / dawn rim). */
  glow: string
  stars: boolean
}

/* Hand-authored ridgelines (no randomness — deterministic renders, same
   spirit as AmbientOverlay's seeded particles). Palette hexes from
   tailwind.config.ts — void/panel/bronze families. */
const SCENES: Record<WorldScene, SceneSpec> = {
  'night-camp': {
    tint: 'night',
    sky: 'linear-gradient(180deg, #0a0a0f 0%, #101014 55%, #17131a 100%)',
    bands: [
      { points: '0,40 0,22 8,18 17,21 26,15 36,19 44,13 55,17 63,12 74,16 84,11 92,15 100,13 100,40', fill: '#101014', drift: '0.6%', driftDuration: '90s' },
      { points: '0,40 0,27 10,23 20,26 31,20 42,24 52,19 64,23 75,18 86,22 100,20 100,40', fill: '#141315', drift: '1.1%', driftDuration: '70s' },
      { points: '0,40 0,32 7,29 15,31 24,27 33,30 45,26 57,29 68,25 80,28 91,24 100,27 100,40', fill: '#170f0b', drift: '1.8%', driftDuration: '55s' },
      { points: '0,40 0,36 12,34 25,36 38,33 52,35 66,32 80,34 100,33 100,40', fill: '#0a0a0f', drift: '2.6%', driftDuration: '45s' },
    ],
    glow: 'radial-gradient(ellipse 34% 22% at 50% 96%, rgba(215, 122, 38, 0.28) 0%, rgba(180, 90, 26, 0.10) 45%, transparent 70%)',
    stars: true,
  },
  'dusk-vale': {
    tint: 'dusk',
    sky: 'linear-gradient(180deg, #0a0a0f 0%, #17131a 45%, #2b1608 80%, #4f280e 100%)',
    bands: [
      { points: '0,40 0,20 12,16 22,19 34,13 46,17 58,12 70,16 82,11 93,15 100,12 100,40', fill: '#141315', drift: '0.6%', driftDuration: '85s' },
      { points: '0,40 0,26 9,22 19,25 30,20 43,24 54,18 66,22 78,17 90,21 100,19 100,40', fill: '#1b1a1e', drift: '1.2%', driftDuration: '65s' },
      { points: '0,40 0,31 11,28 23,30 36,26 48,29 61,25 73,28 85,24 100,26 100,40', fill: '#241810', drift: '1.9%', driftDuration: '52s' },
      { points: '0,40 0,35 14,33 28,35 43,32 58,34 74,31 88,33 100,32 100,40', fill: '#0f0a08', drift: '2.6%', driftDuration: '42s' },
    ],
    glow: 'radial-gradient(ellipse 70% 30% at 50% 100%, rgba(180, 90, 26, 0.22) 0%, rgba(122, 74, 31, 0.08) 50%, transparent 75%)',
    stars: false,
  },
  'dawn-ridge': {
    tint: 'dawn',
    sky: 'linear-gradient(180deg, #101014 0%, #1b1a1e 50%, #4f280e 88%, #7a4a1f 100%)',
    bands: [
      { points: '0,40 0,21 10,17 21,20 33,14 45,18 57,13 68,17 80,12 91,16 100,14 100,40', fill: '#141315', drift: '0.6%', driftDuration: '88s' },
      { points: '0,40 0,28 12,24 24,27 37,22 50,26 62,21 75,25 88,20 100,23 100,40', fill: '#1f1814', drift: '1.2%', driftDuration: '66s' },
      { points: '0,40 0,34 15,31 30,33 46,30 62,32 78,29 92,31 100,30 100,40', fill: '#0a0a0f', drift: '2.0%', driftDuration: '50s' },
    ],
    glow: 'radial-gradient(ellipse 60% 26% at 50% 100%, rgba(200, 148, 67, 0.20) 0%, rgba(168, 105, 50, 0.08) 50%, transparent 75%)',
    stars: false,
  },
}

/* Deterministic star field for night scenes (fixed positions, no RNG). */
const STARS: Array<{ left: string; top: string; size: number; dim: boolean }> = [
  { left: '6%',  top: '9%',  size: 2, dim: false },
  { left: '14%', top: '22%', size: 1, dim: true },
  { left: '23%', top: '7%',  size: 1, dim: false },
  { left: '31%', top: '16%', size: 2, dim: true },
  { left: '40%', top: '5%',  size: 1, dim: false },
  { left: '48%', top: '19%', size: 1, dim: true },
  { left: '57%', top: '10%', size: 2, dim: false },
  { left: '65%', top: '24%', size: 1, dim: true },
  { left: '73%', top: '6%',  size: 1, dim: false },
  { left: '81%', top: '15%', size: 2, dim: true },
  { left: '89%', top: '9%',  size: 1, dim: false },
  { left: '95%', top: '20%', size: 1, dim: true },
]

interface WorldRendererProps {
  scene: WorldScene
  /** Disable the slow band drift (reduced-motion is handled by CSS regardless). */
  parallax?: boolean
  /** Override the scene's default time-of-day grade. */
  tint?: WorldTint
  /** Atmosphere layer — rendered internally so consumers mount ONE component. */
  ambience?: AmbienceKind
  className?: string
}

export function WorldRenderer({
  scene,
  parallax = true,
  tint,
  ambience = 'none',
  className,
}: WorldRendererProps) {
  const spec = SCENES[scene]
  const assetSrc = `/assets/sprites/environments/${scene}.png`
  const [assetReady, setAssetReady] = useState(false)

  // Asset-slot probe: upgrade to a real backdrop only once it has
  // actually loaded. Never resolves in jsdom → tests hit the fallback.
  useEffect(() => {
    if (typeof Image === 'undefined') return
    let cancelled = false
    const img = new Image()
    img.onload = () => { if (!cancelled) setAssetReady(true) }
    img.src = assetSrc
    return () => { cancelled = true }
  }, [assetSrc])

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
      aria-hidden="true"
      data-testid="world-renderer"
      data-scene={scene}
      data-tint={tint ?? spec.tint}
    >
      {assetReady ? (
        <img
          src={assetSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pixel-crisp"
          data-testid="world-renderer-asset"
        />
      ) : (
        <div className="absolute inset-0" data-testid="world-renderer-procedural">
          {/* Sky */}
          <div className="absolute inset-0" style={{ background: spec.sky }} />

          {/* Stars (night scenes) */}
          {spec.stars && STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-void-100 torch-flicker"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                opacity: s.dim ? 0.35 : 0.7,
                animationDelay: `${(i % 5) * 0.7}s`,
              }}
            />
          ))}

          {/* Silhouette bands, far → near */}
          {spec.bands.map((band, i) => (
            <svg
              key={i}
              className={cn('absolute inset-x-0 bottom-0 w-full', parallax && 'world-band')}
              style={{
                height: '70%',
                ['--drift' as string]: band.drift,
                ['--drift-duration' as string]: band.driftDuration,
              }}
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
            >
              <polygon points={band.points} fill={band.fill} />
            </svg>
          ))}

          {/* Fog sheet between mid and near bands */}
          <div
            className={cn('absolute inset-x-0 bottom-0 h-1/2', parallax && 'world-clouds')}
            style={{
              background:
                'radial-gradient(ellipse 55% 30% at 30% 80%, rgba(107, 98, 90, 0.07), transparent 70%),' +
                'radial-gradient(ellipse 45% 25% at 72% 70%, rgba(107, 98, 90, 0.05), transparent 70%)',
            }}
          />

          {/* Scene light source */}
          <div className="absolute inset-0" style={{ background: spec.glow }} />
        </div>
      )}

      {ambience !== 'none' && <AmbientOverlay kind={ambience} />}
    </div>
  )
}
