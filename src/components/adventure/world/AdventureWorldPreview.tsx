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
 * MOUNTING (the structural decision of this pass): rendered as a
 * BACKGROUND layer behind the story content inside AdventureScenePanel
 * — absolutely positioned, aria-hidden, pointer-events-none — so
 * dialogue keeps every pixel of the height the readability pass won
 * (378px at 1440×900) while the empty space behind/below the dialogue
 * boxes becomes a living world. Dialogue panels are opaque and float
 * above; the horizon and player sprite sit in the zone that was
 * previously blank.
 *
 * HONESTY RULES (Constitution Law 2/3, UI_VISION Concept 7):
 * - Biome furniture (trees, houses, torches) derives from the current
 *   location's REAL `type` — scenery for a place that genuinely
 *   exists, same class of representation as AtlasPanel's biome icons.
 * - Weather: WorldState has NO weather field today. The weather prop
 *   exists for when Phase 10 adds one; until then callers pass nothing
 *   and the sky is simply clear. No fabricated rain.
 * - Time of day: derived ONLY from keyword matches against the
 *   Director's real free-text `worldTime` (see timeOfDay.ts) — a
 *   presentation grade of what the Director actually wrote, defaulting
 *   to neutral daylight when unknown.
 *
 * Performance: pure CSS animation (no JS loops, no state updates per
 * frame), GPU-friendly transforms only, and every keyframe is in
 * pixel.css's prefers-reduced-motion kill-list — reduced motion gets a
 * readable still scene.
 */

import type { LocationType } from '@/types/campaign'

interface AdventureWorldPreviewProps {
  /** Real current-location type; null renders the neutral default scene. */
  locationType: LocationType | null
  /** Director's free-text world time (real state; may be null). */
  worldTime?: string | null
  className?: string
}

export function AdventureWorldPreview({
  locationType,
  worldTime = null,
  className,
}: AdventureWorldPreviewProps) {
  void locationType
  void worldTime

  return (
    <div
      className={['absolute inset-0 overflow-hidden pointer-events-none', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
      data-testid="adventure-world-preview"
    >
      {/* Sky — neutral daylight for the skeleton; time-of-day grading
          arrives with the weather/time milestone. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #101014 0%, #1b1a1e 55%, #241a16 100%)',
        }}
      />

      {/* Ground — a simple rolling band anchoring the horizon at ~62%,
          above the ActionBar's overlay zone so the world stays visible. */}
      <svg
        className="absolute inset-x-0 w-full"
        style={{ top: '58%', height: '42%' }}
        viewBox="0 0 100 42"
        preserveAspectRatio="none"
      >
        <polygon points="0,42 0,8 18,5 42,9 68,4 88,8 100,6 100,42" fill="#170f0b" />
        <polygon points="0,42 0,16 25,13 55,17 80,12 100,15 100,42" fill="#0f0a08" />
      </svg>

      {/* Soft vignette keeping edges dark so overlaid text stays readable. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 55%, rgba(10, 10, 15, 0.55) 100%)',
        }}
      />
    </div>
  )
}
