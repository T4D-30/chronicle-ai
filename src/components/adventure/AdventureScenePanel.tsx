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
 * stylized frame, which is more honest than either a blank box or a
 * fabricated "generating image..." state that implies a capability
 * that doesn't exist.
 *
 * Adventure UI 3.0, Phase 1: replaced the flat pixel-bordered box with
 * `.scene-viewport` (globals.css) — a layered-lighting frame with gold
 * corner brackets, in the spirit of a classic CRPG dialogue/scene
 * viewport. Presentation only: same data, same testids, same copy.
 */

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
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
          <h1
            className="font-display text-xl font-bold text-gradient-arcane truncate"
            data-testid="scene-location-title"
          >
            {locationTitle}
          </h1>
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

      <div className="flex-shrink-0 px-4 pb-3">
        <div
          className="scene-viewport h-36 sm:h-44 flex items-center justify-center"
          data-testid="scene-art-placeholder"
        >
          <div className="relative text-center px-6">
            <span
              className="text-4xl block mb-2 drop-shadow-[0_0_12px_rgba(243,207,77,0.25)]"
              aria-hidden="true"
            >
              🏔️
            </span>
            {currentLocation?.description ? (
              <p className="text-void-300 text-sm font-body leading-relaxed line-clamp-2 max-w-sm">
                {currentLocation.description}
              </p>
            ) : (
              <p className="text-void-500 text-sm font-body">Scene art coming soon</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
