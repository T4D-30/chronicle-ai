/**
 * AdventureScenePanel — Phase 11.5 (Adventure Hub redesign)
 *
 * The center column's new chrome: location title, a time line, and a
 * scene-art placeholder, wrapping the EXISTING StoryPanel/ActionBar
 * (rendered as `children` — this component never reimplements narration,
 * suggested actions, or the action bar; it only adds framing around them).
 *
 * LOCATION TITLE / TIME LINE: reuses the exact same currentLocationId
 * resolution AdventureHub's WorldStatusSidebar already performs — never
 * a second, differently-implemented lookup. Falls back to the campaign
 * title when no current location has been set yet (a fresh campaign's
 * honest starting state), never a fabricated location name. The time
 * line shows worldState.worldTime only when the Director has actually
 * set it — there is no weather field anywhere in this codebase's data
 * model (confirmed: LocationState/WorldState have no such field), so
 * this line never mentions weather.
 *
 * SCENE ART PLACEHOLDER: genuinely a placeholder — there is no image
 * generation system, no per-location artwork field, and building one is
 * explicitly out of scope for this pass. Shows the location's own real
 * `description` text (when a current location resolves) inside a
 * stylized pixel-bordered frame, which is more honest than either a
 * blank box or a fabricated "generating image..." state that implies a
 * capability that doesn't exist.
 */

import { PixelPanel } from '@/components/pixel'
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

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="adventure-scene-panel">
      <div className="flex-shrink-0 px-4 pt-3 pb-1 flex items-baseline justify-between gap-2 flex-wrap">
        <h1
          className="font-display text-lg font-bold text-white truncate"
          data-testid="scene-location-title"
        >
          {locationTitle}
        </h1>
        {worldState.worldTime && (
          <p className="text-arcane-300 text-xs flex-shrink-0" data-testid="scene-time-line">
            {worldState.worldTime}
          </p>
        )}
      </div>

      <div className="flex-shrink-0 px-4 pb-2">
        <PixelPanel
          className="h-28 sm:h-36 flex items-center justify-center overflow-hidden relative"
          data-testid="scene-art-placeholder"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-40"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(139,92,246,0.25) 0%, transparent 70%)',
            }}
          />
          <div className="relative text-center px-4">
            <span className="text-3xl block mb-1" aria-hidden="true">🏔️</span>
            {currentLocation?.description ? (
              <p className="text-void-400 text-xs line-clamp-2 max-w-sm">{currentLocation.description}</p>
            ) : (
              <p className="text-void-600 text-xs">Scene art coming soon</p>
            )}
          </div>
        </PixelPanel>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
