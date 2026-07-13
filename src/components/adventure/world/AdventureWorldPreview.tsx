/**
 * AdventureWorldPreview — UI 4.1 (World Presence Pass)
 *
 * The world's IDLE STATE: a lightweight pixel-world representation that
 * fills the story view's visual emptiness whenever no real scene
 * artwork exists. This is deliberately NOT the future full
 * WorldRenderer — think "presence, not fidelity" (the pass's guiding
 * principle). The evolution path is documented in UI_VISION.md:
 * AdventureWorldPreview → WorldRenderer → procedural scene renderer;
 * nothing here hardcodes assumptions that block that path (scenes are
 * a config map, layers are composable, all animation is CSS).
 *
 * MOUNTING: a BACKGROUND layer behind the story content inside
 * AdventureScenePanel — absolutely positioned, aria-hidden,
 * pointer-events-none — so dialogue keeps the full height the
 * readability pass won while the blank space becomes a living world.
 *
 * BIOME AWARENESS: keyed by the current location's REAL `type` — the
 * same seven LocationType values the Atlas already maps to icons.
 * Scenery for a place that genuinely exists is representation, not
 * fabrication (Constitution Law 2/3, UI_VISION Concept 7):
 *   outdoor          → forest (pines, grass)
 *   town             → village (houses, fence, chimney)
 *   dungeon / floor  → torchlit stone (walls, sconces, darkness)
 *   building / room  → interior (wall, warm window, candle)
 *   region           → mountain vista (peaks, clouds)
 *   null / unknown   → neutral rolling hills
 *
 * HONESTY RULES: weather stays clear until a real WorldState field
 * exists; time-of-day grades only what the Director actually wrote
 * (later milestones). Performance: pure CSS animation, GPU-friendly
 * transforms, every keyframe in pixel.css's reduced-motion kill-list.
 */

import type { ReactNode } from 'react'
import { AmbientOverlay } from '@/components/pixel'
import type { AmbienceKind } from '@/components/pixel'
import { PlayerSprite } from './PlayerSprite'
import { WeatherLayer } from './WeatherLayer'
import type { WorldWeather } from './WeatherLayer'
import { parseTimeOfDay, tintFor } from './timeOfDay'
import type { LocationType } from '@/types/campaign'

export type WorldSceneKind =
  | 'forest'
  | 'village'
  | 'dungeon'
  | 'interior'
  | 'mountains'
  | 'default'

const SCENE_FOR_TYPE: Record<LocationType, WorldSceneKind> = {
  outdoor:  'forest',
  town:     'village',
  dungeon:  'dungeon',
  floor:    'dungeon',
  building: 'interior',
  room:     'interior',
  region:   'mountains',
}

interface SceneSpec {
  /** Sky (or interior wall) gradient, top → horizon. */
  sky: string
  /** Two stacked ground/floor silhouette fills, far → near. */
  ground: [string, string]
  /** Pixel furniture drawn over the ground band (100×42 viewBox). */
  furniture: ReactNode
  /** Darker scenes get a heavier readability vignette. */
  vignetteOpacity: number
  /** Biome-furniture ambience: fireflies in the forest, drifting fog in
   *  the dungeon — atmosphere for a place that genuinely exists, never
   *  a weather claim (rain/snow stay gated on a real weather field). */
  ambience: AmbienceKind
  /** Slow drifting cloud sheet across the sky band. */
  clouds: boolean
}

/* Furniture is hand-authored flat SVG in palette tones — deterministic,
   no randomness, no assets. Shapes are deliberately chunky/pixel-simple. */

const FOREST_FURNITURE = (
  <g data-testid="scene-furniture-forest">
    {/* pine trees: trunk + stacked triangles; each sways at its own
        pace, anchored at the trunk base */}
    {[[8, 0.9], [20, 1.2], [78, 1.0], [90, 0.8]].map(([x, s], i) => (
      <g key={i} transform={`translate(${x}, ${16 - Number(s) * 8}) scale(${s})`}>
        <g
          className="world-sway"
          style={{
            ['--sway-duration' as string]: `${5.5 + i * 1.3}s`,
            ['--sway-delay' as string]: `${i * 0.9}s`,
          }}
        >
          <rect x="2.4" y="12" width="1.2" height="3" fill="#241810" />
          <polygon points="3,0 6,6 0,6" fill="#14261a" />
          <polygon points="3,3.5 6.6,9.5 -0.6,9.5" fill="#0f1d14" />
          <polygon points="3,7 7.2,13 -1.2,13" fill="#0b160f" />
        </g>
      </g>
    ))}
    {/* grass tufts */}
    {[30, 44, 58, 70].map((x, i) => (
      <g key={`g${i}`} transform={`translate(${x}, 22)`}>
        <rect x="0" y="0" width="0.6" height="1.6" fill="#14261a" />
        <rect x="1" y="-0.4" width="0.6" height="2" fill="#0f1d14" />
        <rect x="2" y="0.2" width="0.6" height="1.4" fill="#14261a" />
      </g>
    ))}
  </g>
)

const VILLAGE_FURNITURE = (
  <g data-testid="scene-furniture-village">
    {/* houses: body + roof + lit window (soft flicker) + chimney with
        rising smoke puffs */}
    {[[12, 1.1], [34, 0.85], [72, 1.0]].map(([x, s], i) => (
      <g key={i} transform={`translate(${x}, ${10 - Number(s) * 2}) scale(${s})`}>
        <rect x="0" y="6" width="12" height="8" fill="#241a16" />
        <polygon points="-1,6 6,0 13,6" fill="#170f0b" />
        <rect x="4.5" y="9" width="2.6" height="2.6" fill="#d77a26" opacity="0.8" className="torch-flicker" />
        <rect x="9" y="1.5" width="1.6" height="4" fill="#1f1814" />
        {[0, 1, 2].map((p) => (
          <rect
            key={p}
            x="9.2"
            y="0.4"
            width="1.2"
            height="1.2"
            rx="0.4"
            fill="#6b625a"
            opacity="0.4"
            className="world-smoke"
            style={{
              ['--smoke-duration' as string]: '5s',
              ['--smoke-delay' as string]: `${p * 1.6 + i * 0.7}s`,
            }}
          />
        ))}
      </g>
    ))}
    {/* fence posts */}
    {[50, 54, 58, 62].map((x, i) => (
      <g key={`f${i}`}>
        <rect x={x} y={20} width="0.8" height="3.4" fill="#241810" />
        {i < 3 && <rect x={x} y={21} width="4.8" height="0.7" fill="#241810" />}
      </g>
    ))}
  </g>
)

const DUNGEON_FURNITURE = (
  <g data-testid="scene-furniture-dungeon">
    {/* stone wall blocks */}
    {[0, 1, 2, 3].map((row) =>
      [0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
        <rect
          key={`${row}-${col}`}
          x={col * 13 + (row % 2 === 0 ? 0 : 6.5) - 3}
          y={row * 4 - 2}
          width="12.4"
          height="3.4"
          fill={row % 2 === 0 ? '#141315' : '#171518'}
          stroke="#0a0a0f"
          strokeWidth="0.4"
        />
      )),
    )}
    {/* torch sconces — flickering flames */}
    {[22, 76].map((x, i) => (
      <g key={`t${i}`} transform={`translate(${x}, 4)`}>
        <rect x="0.6" y="2.4" width="1" height="3.6" fill="#241810" />
        <g className="torch-flicker" style={{ animationDelay: `${i * 1.1}s` }}>
          <rect x="0.2" y="0.8" width="1.8" height="2" fill="#d77a26" data-torch="true" />
          <rect x="0.55" y="0.2" width="1.1" height="1" fill="#e8a74a" />
        </g>
      </g>
    ))}
  </g>
)

const INTERIOR_FURNITURE = (
  <g data-testid="scene-furniture-interior">
    {/* plank wall lines */}
    {[2, 7, 12].map((y, i) => (
      <rect key={i} x="-2" y={y} width="104" height="0.5" fill="#170f0b" />
    ))}
    {/* warm window */}
    <g transform="translate(16, 3)">
      <rect x="-0.8" y="-0.8" width="9.6" height="11.6" fill="#241810" />
      <rect x="0" y="0" width="8" height="10" fill="#4f280e" />
      <rect x="0" y="0" width="8" height="10" fill="#d77a26" opacity="0.35" />
      <rect x="3.6" y="0" width="0.8" height="10" fill="#241810" />
      <rect x="0" y="4.6" width="8" height="0.8" fill="#241810" />
    </g>
    {/* table + candle */}
    <g transform="translate(66, 12)">
      <rect x="0" y="4" width="14" height="1.4" fill="#241810" />
      <rect x="1.2" y="5.4" width="1.2" height="4.6" fill="#170f0b" />
      <rect x="11.6" y="5.4" width="1.2" height="4.6" fill="#170f0b" />
      <rect x="6.2" y="1.8" width="1.4" height="2.2" fill="#e4dcd0" />
      <rect x="6.5" y="0.9" width="0.8" height="1" fill="#e8a74a" data-candle="true" className="torch-flicker" />
    </g>
  </g>
)

const MOUNTAIN_FURNITURE = (
  <g data-testid="scene-furniture-mountains">
    {/* far peaks with snowcaps */}
    <polygon points="6,22 20,2 34,22" fill="#141315" />
    <polygon points="18,8 20,2 23.4,7" fill="#9c9086" opacity="0.5" />
    <polygon points="28,22 44,6 58,22" fill="#171518" />
    <polygon points="41,9.5 44,6 47,9.5" fill="#9c9086" opacity="0.4" />
    <polygon points="58,22 76,0 96,22" fill="#101014" />
    <polygon points="72.5,4.5 76,0 79.8,4.5" fill="#9c9086" opacity="0.55" />
  </g>
)

const SCENES: Record<WorldSceneKind, SceneSpec> = {
  forest: {
    sky: 'linear-gradient(180deg, #101014 0%, #17131a 50%, #14261a 100%)',
    ground: ['#0f1d14', '#0b160f'],
    furniture: FOREST_FURNITURE,
    vignetteOpacity: 0.5,
    ambience: 'fireflies',
    clouds: false,
  },
  village: {
    sky: 'linear-gradient(180deg, #101014 0%, #1b1a1e 55%, #2b1608 100%)',
    ground: ['#170f0b', '#0f0a08'],
    furniture: VILLAGE_FURNITURE,
    vignetteOpacity: 0.5,
    ambience: 'none',
    clouds: true,
  },
  dungeon: {
    sky: 'linear-gradient(180deg, #0a0a0f 0%, #101014 100%)',
    ground: ['#141315', '#0a0a0f'],
    furniture: DUNGEON_FURNITURE,
    vignetteOpacity: 0.7,
    ambience: 'fog',
    clouds: false,
  },
  interior: {
    sky: 'linear-gradient(180deg, #1f1814 0%, #241a16 100%)',
    ground: ['#170f0b', '#0f0a08'],
    furniture: INTERIOR_FURNITURE,
    vignetteOpacity: 0.55,
    ambience: 'none',
    clouds: false,
  },
  mountains: {
    sky: 'linear-gradient(180deg, #101014 0%, #1b1a1e 60%, #241a16 100%)',
    ground: ['#141315', '#0f0a08'],
    furniture: MOUNTAIN_FURNITURE,
    vignetteOpacity: 0.5,
    ambience: 'none',
    clouds: true,
  },
  default: {
    sky: 'linear-gradient(180deg, #101014 0%, #1b1a1e 55%, #241a16 100%)',
    ground: ['#170f0b', '#0f0a08'],
    furniture: null,
    vignetteOpacity: 0.55,
    ambience: 'none',
    clouds: false,
  },
}

/** Exterior scenes get time-of-day grading; interiors/dungeons have no
 *  sky to grade. */
const EXTERIOR_SCENES: WorldSceneKind[] = ['forest', 'village', 'mountains', 'default']

interface AdventureWorldPreviewProps {
  /** Real current-location type; null renders the neutral default scene. */
  locationType: LocationType | null
  /** Director's free-text world time (real state; may be null). */
  worldTime?: string | null
  /** Real weather state. No such field exists on WorldState today —
   *  callers pass nothing and the sky stays clear. Exists so Phase 10's
   *  real field wires in as a one-line prop. */
  weather?: WorldWeather | null
  className?: string
}

export function AdventureWorldPreview({
  locationType,
  worldTime = null,
  weather = null,
  className,
}: AdventureWorldPreviewProps) {
  const kind: WorldSceneKind = locationType ? SCENE_FOR_TYPE[locationType] : 'default'
  const scene = SCENES[kind]
  const isExterior = EXTERIOR_SCENES.includes(kind)
  const timePhase = isExterior ? parseTimeOfDay(worldTime) : null
  const timeTint = tintFor(timePhase)

  return (
    <div
      className={['absolute inset-0 overflow-hidden pointer-events-none', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
      data-testid="adventure-world-preview"
      data-scene={kind}
      data-time={timePhase ?? 'neutral'}
    >
      {/* Sky / interior wall */}
      <div className="absolute inset-0" style={{ background: scene.sky }} />

      {/* Drifting cloud sheet across the sky band (village/mountains). */}
      {scene.clouds && (
        <div
          className="absolute inset-x-0 world-clouds"
          data-testid="scene-clouds"
          style={{
            top: '4%',
            height: '30%',
            ['--drift-duration' as string]: '110s',
            background:
              'radial-gradient(ellipse 26% 42% at 24% 45%, rgba(107, 98, 90, 0.10), transparent 70%),' +
              'radial-gradient(ellipse 20% 34% at 62% 30%, rgba(107, 98, 90, 0.07), transparent 70%),' +
              'radial-gradient(ellipse 24% 38% at 86% 55%, rgba(107, 98, 90, 0.08), transparent 70%)',
          }}
        />
      )}

      {/* Ground band + biome furniture, horizon at ~58% (above the
          ActionBar overlay zone so the world stays visible). */}
      <svg
        className="absolute inset-x-0 w-full"
        style={{ top: '58%', height: '42%' }}
        viewBox="0 0 100 42"
        preserveAspectRatio="none"
      >
        <polygon points="0,42 0,8 18,5 42,9 68,4 88,8 100,6 100,42" fill={scene.ground[0]} />
        <polygon points="0,42 0,16 25,13 55,17 80,12 100,15 100,42" fill={scene.ground[1]} />
      </svg>
      {/* Furniture in a non-stretched overlay so shapes keep proportions. */}
      <svg
        className="absolute inset-x-0 w-full pixel-crisp"
        style={{ top: '58%', height: '42%' }}
        viewBox="0 0 100 42"
        preserveAspectRatio="xMidYMax meet"
      >
        {scene.furniture}
      </svg>

      {/* The party leader, present in the world — idle breathing/blink
          only, standing on the near ground ridge. */}
      <div className="absolute" style={{ left: '30%', bottom: '26%', width: 26, height: 39 }}>
        <PlayerSprite className="w-full h-full" />
      </div>

      {/* Biome-furniture ambience (fireflies/fog) — reuses the existing
          reduced-motion-safe particle system. */}
      {scene.ambience !== 'none' && <AmbientOverlay kind={scene.ambience} count={scene.ambience === 'fireflies' ? 8 : undefined} />}

      {/* Weather — renders nothing today (no real weather field exists);
          see WeatherLayer's header. */}
      <WeatherLayer weather={weather} />

      {/* Time-of-day grade — only when the Director's real worldTime
          contains an honest signal, exterior scenes only. */}
      {timeTint && (
        <div
          className="absolute inset-0"
          data-testid="scene-time-tint"
          style={{ background: timeTint }}
        />
      )}

      {/* Readability vignette — heavier in dark scenes. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 90% 80% at 50% 45%, transparent 55%, rgba(10, 10, 15, ${scene.vignetteOpacity}) 100%)`,
        }}
      />
    </div>
  )
}
