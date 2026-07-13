/**
 * AdventureScenePanel — Phase 11.5 / 15.2 / dialogue-readability pass
 *
 * The center column's chrome: a slim location row (title + world time)
 * and a CONTENT-AWARE scene viewport, wrapping the EXISTING
 * StoryPanel/ActionBar (rendered as `children` — this component never
 * reimplements narration, suggested actions, or the action bar).
 *
 * DESIGN CONSTRAINT (dialogue-readability pass): the story view always
 * optimizes for the player reading the narrative. When a tradeoff
 * exists between placeholder presentation and narration space,
 * narration wins.
 *
 * CONTENT-AWARE VIEWPORT — the viewport is NOT deleted, it collapses:
 *   - Real scene artwork exists for the current location's type
 *     (asset slot: public/assets/sprites/environments/
 *     location-<LocationType>.png, e.g. location-town.png — the sprites
 *     README's "environment backdrops" slot, distinct from
 *     WorldRenderer's <scene>.png names) → the viewport renders
 *     normally with the artwork filling it.
 *   - No artwork → the viewport collapses COMPLETELY, reserving zero
 *     vertical space; the narration below immediately occupies the
 *     reclaimed height. No placeholder messaging of any kind.
 * Detection uses a hidden DOM <img> probe whose onLoad reveals the
 * viewport (display:none images still load in real browsers; jsdom
 * never fires load, so tests exercise the collapsed default and can
 * fireEvent.load the probe to exercise the artwork branch).
 *
 * The viewport architecture is deliberately preserved for future:
 * generated artwork, animated maps, and the dialogue-overlay mode
 * (UI_VISION.md roadmap) — dropping a real backdrop into the asset
 * slot re-inflates it with zero code changes.
 *
 * LOCATION TITLE / TIME LINE: reuses the exact same currentLocationId
 * resolution AdventureHub's WorldStatusSidebar performs. Falls back to
 * the campaign title when no current location is set — never a
 * fabricated location name. No weather is ever mentioned (no such
 * field exists on WorldState; the test suite enforces this).
 */

import { useState } from 'react'
import { LocationTitle } from '@/components/pixel'
import type { Campaign } from '@/lib/supabase'

interface AdventureScenePanelProps {
  campaign: Campaign
  children: React.ReactNode
}

export function AdventureScenePanel({ campaign, children }: AdventureScenePanelProps) {
  const { worldState } = campaign
  const currentLocation = worldState.currentLocationId
    ? worldState.locations.find((l) => l.id === worldState.currentLocationId)
    : null

  const locationTitle = currentLocation?.name ?? campaign.title
  const artworkSrc = currentLocation
    ? `/assets/sprites/environments/location-${currentLocation.type}.png`
    : null
  const [artworkReady, setArtworkReady] = useState(false)

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="adventure-scene-panel">
      {/* Slim location row — the only chrome that always renders. */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
            <LocationTitle data-testid="scene-location-title">
              {locationTitle}
            </LocationTitle>
            {worldState.worldTime && (
              <p
                className="font-mono text-[10px] tracking-widest uppercase text-arcane-300/80 flex-shrink-0"
                data-testid="scene-time-line"
              >
                {worldState.worldTime}
              </p>
            )}
          </div>
          <div
            className="h-px bg-gradient-to-r from-arcane-700/60 via-arcane-800/20 to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Hidden artwork probe — reveals the viewport only when a real
          backdrop actually loads from the asset slot. */}
      {artworkSrc && !artworkReady && (
        <img
          src={artworkSrc}
          alt=""
          aria-hidden="true"
          className="hidden"
          onLoad={() => setArtworkReady(true)}
          data-testid="scene-artwork-probe"
        />
      )}

      {/* Scene viewport — renders ONLY with real artwork; otherwise it
          collapses entirely and narration takes the space. */}
      {artworkSrc && artworkReady && (
        <div className="flex-shrink-0 px-4 pb-3">
          <div
            className="scene-viewport h-40 sm:h-48 overflow-hidden max-w-3xl mx-auto"
            data-testid="scene-artwork"
          >
            <img
              src={artworkSrc}
              alt={`Scene: ${locationTitle}`}
              className="w-full h-full object-cover pixel-crisp"
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
