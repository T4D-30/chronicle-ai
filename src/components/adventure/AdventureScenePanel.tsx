/**
 * AdventureScenePanel — Phase 11.5, redesigned Phase 15.2/15.4
 *
 * The center column's chrome: location title, a time line, and the scene
 * viewport, wrapping the EXISTING StoryPanel/ActionBar (rendered as
 * `children` — this component never reimplements narration, suggested
 * actions, or the action bar; it only adds framing around them).
 *
 * LOCATION TITLE / TIME LINE: reuses the exact same currentLocationId
 * resolution AdventureHub's WorldStatusSidebar already performs — never
 * a second, differently-implemented lookup. Falls back to the campaign
 * title when no current location has been set yet (a fresh campaign's
 * honest starting state), never a fabricated location name.
 *
 * SCENE VIEWPORT (Phase 15.2/15.4 "signature panel" pass): still
 * genuinely a placeholder — there is no image generation system, no
 * per-location artwork field. What changed is *how much real information*
 * the placeholder honestly shows while waiting for artwork:
 *   - a biome icon derived from the location's real `type` (via the
 *     shared LOCATION_ICON map — same source AtlasPanel uses, see
 *     ./locationIcons.ts), replacing the old generic 🏔️ for every location
 *   - a "Music: —" row: an honest empty slot, not a fabricated track name
 *   - nearby NPCs / nearby locations counts, computed from real WorldState
 *     data (npcs at this exact locationId; sibling locations sharing this
 *     location's parentId) — shown only when the count is greater than
 *     zero, never a fabricated "0 nearby"
 *   - a single generic note that more atmospheric detail (lighting,
 *     ambience, artwork) arrives in a future update. It deliberately does
 *     NOT name "weather" or "mood" specifically — those fields do not
 *     exist on WorldState today (confirmed: no such fields anywhere in
 *     src/types/campaign.ts), and AdventureScenePanel.test.tsx explicitly
 *     asserts the panel never mentions weather. When Phase 10 (Living
 *     World) adds real fields, they render in this same reserved space —
 *     the layout doesn't need to change shape.
 * Same testids, same fallback copy ("Scene art coming soon") as before.
 */

import { LocationTitle, Icon } from '@/components/pixel'
import { LOCATION_ICON } from './locationIcons'
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
  const biomeIcon = currentLocation ? LOCATION_ICON[currentLocation.type] : '🏔️'

  const nearbyNpcCount = currentLocation
    ? worldState.npcs.filter((n) => n.locationId === currentLocation.id && n.isAlive).length
    : 0
  const nearbyLocationCount = currentLocation
    ? worldState.locations.filter(
        (l) => l.id !== currentLocation.id && l.parentId === currentLocation.parentId && l.discovered,
      ).length
    : 0

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="adventure-scene-panel">
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

      <div className="flex-shrink-0 px-4 pb-3">
        <div
          className="scene-viewport h-40 sm:h-48 flex flex-col justify-between p-4 max-w-3xl mx-auto"
          data-testid="scene-art-placeholder"
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="text-4xl leading-none drop-shadow-[0_0_12px_rgba(243,207,77,0.25)]"
              aria-hidden="true"
            >
              {biomeIcon}
            </span>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-[9px] uppercase tracking-widest text-void-600">Music</p>
              <p className="font-mono text-xs text-void-500">—</p>
            </div>
          </div>

          <div className="text-center px-2">
            {currentLocation?.description ? (
              <p className="text-void-300 text-sm font-body leading-relaxed line-clamp-2">
                {currentLocation.description}
              </p>
            ) : (
              <p className="text-void-500 text-sm font-body">Scene art coming soon</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[10px] text-void-500">
              {nearbyNpcCount > 0 && (
                <span data-testid="scene-nearby-npcs" className="flex items-center gap-1">
                  <Icon name="character" className="text-xs leading-none" />
                  {nearbyNpcCount} nearby
                </span>
              )}
              {nearbyLocationCount > 0 && (
                <span data-testid="scene-nearby-locations" className="flex items-center gap-1">
                  <Icon name="world" className="text-xs leading-none" />
                  {nearbyLocationCount} nearby
                </span>
              )}
            </div>
            <p className="text-void-700 text-[9px] text-right">
              More atmosphere &amp; artwork arrive in a future update.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
