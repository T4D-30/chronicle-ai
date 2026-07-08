/**
 * AdventureStatusBar — Phase 1 (Adventure UI 2.0)
 *
 * Extracted from AdventureHub.tsx's inline <header> block. Pure code
 * motion — markup, classes, and data-testid are unchanged, so the
 * existing `within(screen.getByTestId('adventure-status-bar'))` test
 * coverage in AdventureHub.test.tsx keeps passing without modification.
 *
 * Owns only the top status strip: campaign link, Live/Paused/Ended
 * badge, turn counter, tone/difficulty, and the pause/resume/end
 * session controls. Local UI state (saveConfirmed's timeout) still
 * lives in AdventureHub, since it's tied to handlePause's side effect,
 * not to this component's own lifecycle.
 */

import { Link } from 'react-router-dom'
import { Button, Badge } from '@/components/ui'
import type { Campaign, GameSession } from '@/lib/supabase'
import type { LocationState } from '@/types/campaign'

interface AdventureStatusBarProps {
  campaign: Campaign
  session: GameSession
  isSessionActive: boolean
  isSessionPaused: boolean
  isSessionDone: boolean
  saveConfirmed: boolean
  isActionInFlight: boolean
  onPause: () => void
  onResume: () => void
  onEnd: () => void
}

/**
 * Walks the real `parentId` chain (WorldState.locations) up from the
 * current location looking for the nearest ancestor whose `type` is
 * literally 'region' — the Constitution's own hierarchy is
 * world → region → town → building → floor → encounter zone, so "region"
 * here means that specific tier, not just "any parent." Returns null
 * (rendered as nothing) rather than guessing when no region-typed
 * ancestor exists — same honesty rule every other real-data field here
 * already follows (see WorldStatusSidebar, AdventureScenePanel).
 */
function findRegionAncestor(
  locationId: string | null,
  locations: LocationState[],
): LocationState | null {
  const visited = new Set<string>()
  let current = locationId ? locations.find((l) => l.id === locationId) ?? null : null
  while (current) {
    if (current.type === 'region') return current
    if (!current.parentId || visited.has(current.id)) return null
    visited.add(current.id)
    current = locations.find((l) => l.id === current!.parentId) ?? null
  }
  return null
}

export function AdventureStatusBar({
  campaign,
  session,
  isSessionActive,
  isSessionPaused,
  isSessionDone,
  saveConfirmed,
  isActionInFlight,
  onPause,
  onResume,
  onEnd,
}: AdventureStatusBarProps) {
  const region = findRegionAncestor(campaign.worldState.currentLocationId, campaign.worldState.locations)

  return (
    <header
      className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-void-700/50 bg-void-900/80 backdrop-blur-sm"
      data-testid="adventure-status-bar"
    >
      <Link
        to={`/campaigns/${campaign.id}`}
        className="text-void-500 hover:text-arcane-300 text-xs transition-colors flex-shrink-0"
      >
        ← {campaign.title}
      </Link>

      <div className="h-3 w-px bg-void-700" />

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge
          variant={isSessionActive ? 'spirit' : isSessionPaused ? 'arcane' : 'neutral'}
        >
          {isSessionActive ? 'Live' : isSessionPaused ? 'Paused' : 'Ended'}
        </Badge>
        <span className="font-mono text-xs text-void-500">
          Turn {session.turnNumber}
        </span>
        {region && (
          <span className="stat-label text-arcane-500 hidden md:inline" data-testid="status-bar-region">
            {region.name}
          </span>
        )}
        <span className="stat-label text-void-700 hidden sm:inline">
          {campaign.tone} · {campaign.difficulty}
        </span>
      </div>

      {/* Session controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {saveConfirmed && (
          <span
            className="font-pixel-body text-sm text-heal-400 flex items-center gap-1 menu-enter"
            role="status"
            data-testid="save-confirmed"
          >
            <span aria-hidden="true">✓</span> Progress saved
          </span>
        )}
        {isSessionActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPause}
            loading={isActionInFlight}
          >
            Pause
          </Button>
        )}
        {isSessionPaused && (
          <Button
            type="button"
            variant="arcane"
            size="sm"
            onClick={onResume}
            loading={isActionInFlight}
          >
            Resume
          </Button>
        )}
        {!isSessionDone && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onEnd}
            loading={isActionInFlight}
            disabled={isActionInFlight}
          >
            End
          </Button>
        )}
      </div>
    </header>
  )
}
