/**
 * AtlasMapPanel — Phase 15.3 (Exploration Framework UI)
 *
 * A static room-grid + player marker + directional movement affordances —
 * the "mental model" placeholder the phase asks for, NOT a tile-canvas/
 * fog-of-war engine (that's the separate, larger Living Atlas system in
 * the Constitution's own roadmap, Phase 6 — see docs/CHRONICLE_CONSTITUTION.md).
 * Purely additive: does not replace or modify AtlasPanel's search/filter/
 * detail view, which stays reachable via the List/Map toggle in
 * AdventureHub — this component only adds a second way to view the same
 * real WorldState.locations data.
 *
 * REAL DATA ONLY: the grid shows the current location's real sibling
 * locations (same parentId), filtered to `discovered` — the identical
 * discovery gating AtlasPanel already applies (undiscovered locations
 * never leak). An honest empty state renders when nothing is discovered
 * yet, never a placeholder map image.
 *
 * MOVEMENT: the N/S/E/W buttons call the EXISTING onSubmitAction callback
 * with plain text ("I move north.") — the identical mechanism ActionBar's
 * quick-action buttons already use (see QUICK_ACTIONS in ActionBar.tsx).
 * This introduces no new controller/AI Director surface — it's the same
 * submitAction pipe, more pre-written text entering it. LocationState has
 * no compass-heading field, so these are honestly generic prompts for the
 * Director to interpret narratively, never a claim that a specific
 * location is literally north of another.
 */

import { PixelPanel, PixelCard, Icon } from '@/components/pixel'
import { Button } from '@/components/ui'
import { LOCATION_ICON } from '../locationIcons'
import type { Campaign } from '@/lib/supabase'

interface AtlasMapPanelProps {
  campaign: Campaign
  onSubmitAction: (text: string) => void
  isDisabled?: boolean
}

const DIRECTIONS: Array<{ id: 'north' | 'south' | 'east' | 'west'; label: string; text: string }> = [
  { id: 'north', label: 'N', text: 'I move north.' },
  { id: 'west',  label: 'W', text: 'I move west.' },
  { id: 'east',  label: 'E', text: 'I move east.' },
  { id: 'south', label: 'S', text: 'I move south.' },
]

export function AtlasMapPanel({ campaign, onSubmitAction, isDisabled = false }: AtlasMapPanelProps) {
  const { worldState } = campaign
  const currentLocation = worldState.currentLocationId
    ? worldState.locations.find((l) => l.id === worldState.currentLocationId)
    : null

  const roomGrid = currentLocation
    ? worldState.locations.filter((l) => l.parentId === currentLocation.parentId && l.discovered)
    : worldState.locations.filter((l) => l.parentId === null && l.discovered)

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="atlas-map-panel">
      <div className="flex-1 overflow-y-auto min-h-0 p-4" role="region" aria-label="Map">
        {roomGrid.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <PixelPanel variant="arcane" className="p-6 max-w-sm">
              <p className="lore-text text-void-400 text-sm mb-3">
                "Every map starts blank until you walk it."
              </p>
              <p className="text-void-600 text-xs">
                Discovered locations will appear here as you explore.
              </p>
            </PixelPanel>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="list" aria-label="Nearby locations">
            {roomGrid.map((loc) => {
              const isCurrent = loc.id === currentLocation?.id
              return (
                <div key={loc.id} role="listitem">
                  <PixelCard
                    title={loc.name}
                    icon={LOCATION_ICON[loc.type]}
                    variant={isCurrent ? 'arcane' : 'default'}
                  >
                    {isCurrent ? (
                      <span
                        data-testid="atlas-map-player-marker"
                        className="flex items-center gap-1 text-arcane-400 text-xs"
                      >
                        <Icon name="character" className="text-xs leading-none" />
                        You are here
                      </span>
                    ) : loc.description ? (
                      <p className="text-void-500 text-xs line-clamp-2">{loc.description}</p>
                    ) : null}
                  </PixelCard>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-void-700/50 p-3">
        <p className="stat-label text-void-600 mb-2 text-center">Move</p>
        <div className="grid grid-cols-3 gap-1.5 max-w-[10rem] mx-auto" role="group" aria-label="Movement">
          <span />
          <Button
            type="button"
            variant="navigation"
            disabled={isDisabled}
            onClick={() => onSubmitAction(DIRECTIONS[0].text)}
            aria-label="Move north"
            data-testid="atlas-map-move-north"
            className="justify-center"
          >
            {DIRECTIONS[0].label}
          </Button>
          <span />
          <Button
            type="button"
            variant="navigation"
            disabled={isDisabled}
            onClick={() => onSubmitAction(DIRECTIONS[1].text)}
            aria-label="Move west"
            data-testid="atlas-map-move-west"
            className="justify-center"
          >
            {DIRECTIONS[1].label}
          </Button>
          <span />
          <Button
            type="button"
            variant="navigation"
            disabled={isDisabled}
            onClick={() => onSubmitAction(DIRECTIONS[2].text)}
            aria-label="Move east"
            data-testid="atlas-map-move-east"
            className="justify-center"
          >
            {DIRECTIONS[2].label}
          </Button>
          <span />
          <Button
            type="button"
            variant="navigation"
            disabled={isDisabled}
            onClick={() => onSubmitAction(DIRECTIONS[3].text)}
            aria-label="Move south"
            data-testid="atlas-map-move-south"
            className="justify-center"
          >
            {DIRECTIONS[3].label}
          </Button>
          <span />
        </div>
      </div>
    </div>
  )
}
