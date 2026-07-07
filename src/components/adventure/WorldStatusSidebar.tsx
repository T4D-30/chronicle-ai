/**
 * WorldStatusSidebar — Phase 1 (Adventure UI 2.0)
 *
 * Extracted from AdventureHub.tsx's inline function of the same name.
 * Pure code motion — markup, classes, and data-testids are unchanged
 * (world-status-sidebar, current-location-row), so AdventureHub.test.tsx's
 * existing coverage keeps passing without modification.
 *
 * Shows real WorldState signals only: discovered locations, known NPCs,
 * faction standings, the Director's free-text worldTime if set, and the
 * player's current location, resolved honestly against WorldState.locations
 * — never guessed or defaulted.
 *
 * Deliberately does NOT show: weather, day/night cycle, NPC relationships,
 * or reputation scores — none of these exist as structured data yet.
 * Fabricating them here would violate Constitution Law 3 (character/world
 * values come from real state, never invented). These arrive with the
 * Phase 10 Living World foundation.
 */

import { PixelPanel } from '@/components/pixel'
import type { AdventureState } from './useAdventureSession'

interface WorldStatusSidebarProps {
  campaign: NonNullable<AdventureState['campaign']>
  session: NonNullable<AdventureState['session']>
  combatState: AdventureState['combatState']
}

export function WorldStatusSidebar({
  campaign, session, combatState,
}: WorldStatusSidebarProps) {
  const { worldState } = campaign
  const discoveredCount = worldState.locations.filter((l) => l.discovered).length
  const knownNpcs = worldState.npcs.filter((n) => n.isAlive)
  const activeFactions = worldState.factions
  // Resolve the real currentLocationId (Phase 9.2) against known locations.
  // Falls back to nothing shown if the id doesn't resolve — never guesses.
  const currentLocation = worldState.currentLocationId
    ? worldState.locations.find((l) => l.id === worldState.currentLocationId)
    : null

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3" data-testid="world-status-sidebar">
      <PixelPanel className="p-3">
        <p className="font-pixel-display text-[8px] text-arcane-400 mb-2 uppercase">World</p>
        <div className="flex flex-col gap-1.5 font-pixel-body text-base">
          <div className="flex items-center justify-between">
            <span className="text-void-500">Turn</span>
            <span className="text-void-200 tabular-nums">{session.turnNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-void-500">Tone</span>
            <span className="text-void-200 capitalize">{campaign.tone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-void-500">Difficulty</span>
            <span className="text-void-200 capitalize">{campaign.difficulty}</span>
          </div>
          {worldState.worldTime && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-void-500 flex-shrink-0">Time</span>
              <span className="text-arcane-300 text-right truncate">{worldState.worldTime}</span>
            </div>
          )}
          {currentLocation && (
            <div className="flex items-center justify-between gap-2" data-testid="current-location-row">
              <span className="text-void-500 flex-shrink-0">Location</span>
              <span className="text-heal-400 text-right truncate">{currentLocation.name}</span>
            </div>
          )}
        </div>
      </PixelPanel>

      <PixelPanel className="p-3">
        <p className="font-pixel-display text-[8px] text-spirit-400 mb-2 uppercase">Status</p>
        {combatState ? (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-harm-400 flex-shrink-0" aria-hidden="true" />
            <span className="font-pixel-body text-base text-harm-300">In Combat</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-heal-400 flex-shrink-0" aria-hidden="true" />
            <span className="font-pixel-body text-base text-void-300">Exploring</span>
          </div>
        )}
      </PixelPanel>

      <PixelPanel className="p-3">
        <p className="font-pixel-display text-[8px] text-arcane-400 mb-2 uppercase">Discovered</p>
        <div className="flex items-center justify-between font-pixel-body text-base">
          <span className="text-void-500">Locations</span>
          <span className="text-void-200 tabular-nums">{discoveredCount}</span>
        </div>
        <div className="flex items-center justify-between font-pixel-body text-base">
          <span className="text-void-500">Known NPCs</span>
          <span className="text-void-200 tabular-nums">{knownNpcs.length}</span>
        </div>
      </PixelPanel>

      {activeFactions.length > 0 && (
        <PixelPanel className="p-3">
          <p className="font-pixel-display text-[8px] text-spirit-400 mb-2 uppercase">Factions</p>
          <div className="flex flex-col gap-1">
            {activeFactions.slice(0, 4).map((f) => (
              <div key={f.id} className="flex items-center justify-between font-pixel-body text-base">
                <span className="text-void-400 truncate">{f.name}</span>
                <span className="text-void-300 tabular-nums flex-shrink-0">{f.standing}</span>
              </div>
            ))}
          </div>
        </PixelPanel>
      )}

      <p className="text-void-700 text-[10px] mt-auto pt-2 border-t border-void-700/50">
        Weather, day/night, and NPC relationships arrive with Phase 10.
      </p>
    </div>
  )
}
