/**
 * AdventureLeftNav — Phase 11.5 (Adventure Hub redesign)
 *
 * The left navigation column from the redesign reference. Desktop-only
 * (hidden below the lg breakpoint, where the existing bottom tab nav
 * already handles panel switching — see AdventureHub's own tablist,
 * which is NOT removed or replaced by this component).
 *
 * WHY THIS DOES NOT REPLACE THE BOTTOM TAB NAV: AdventureHub.test.tsx has
 * a large, real, load-bearing test suite built against
 * role="tablist"/role="tab" panel switching (Story/Character/Dice/
 * Journal/Quests/Atlas/Codex). Removing or restructuring that mechanism
 * would break dozens of passing tests for a purely visual reason. This
 * component instead calls the EXACT SAME onSelectPanel callback the
 * bottom tabs already use — it's a second, visually-distinct set of
 * buttons driving the identical activePanel state, not a parallel
 * navigation system.
 *
 * CURRENT OBJECTIVE CARD: real data — the most recently started active,
 * non-hidden PlotThread from campaign.directorConfig.activeThreads,
 * using the exact same status/isHidden filter QuestsPanel already
 * applies. Shows an honest empty state when no thread is active yet.
 *
 * WORLD STATUS CARD: reuses the same real, honestly-scoped WorldState
 * fields AdventureHub's existing WorldStatusSidebar already shows
 * (worldTime if set, current location if resolved, discovered location
 * count) — deliberately does not duplicate that component's full
 * factions list, keeping this card to a compact glance summary.
 */

import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import type { AdventurePanel } from './AdventureHub'
import type { Campaign, GameSession } from '@/lib/supabase'

const NAV_ITEMS: Array<{ id: AdventurePanel; label: string; icon: string }> = [
  { id: 'story',     label: 'Home',      icon: '🏠' },
  { id: 'character', label: 'Characters',icon: '⚔️' },
  { id: 'journal',   label: 'Journal',   icon: '📜' },
  { id: 'quests',    label: 'Quests',    icon: '🗺️' },
  { id: 'codex',     label: 'Codex',     icon: '📚' },
]

interface AdventureLeftNavProps {
  campaign: Campaign
  session: GameSession
  activePanel: AdventurePanel
  onSelectPanel: (panel: AdventurePanel) => void
  onEndSession: () => void
  isSessionDone: boolean
  isActionInFlight: boolean
}

export function AdventureLeftNav({
  campaign,
  session,
  activePanel,
  onSelectPanel,
  onEndSession,
  isSessionDone,
  isActionInFlight,
}: AdventureLeftNavProps) {
  const activeThreads = campaign.directorConfig.activeThreads
    .filter((t) => t.status === 'active' && !t.isHidden)
  const currentObjective = activeThreads.length > 0
    ? [...activeThreads].sort((a, b) => b.startedAtTurn - a.startedAtTurn)[0]
    : null

  const { worldState } = campaign
  const currentLocation = worldState.currentLocationId
    ? worldState.locations.find((l) => l.id === worldState.currentLocationId)
    : null
  const discoveredCount = worldState.locations.filter((l) => l.discovered).length

  return (
    <nav
      className="flex flex-col h-full overflow-y-auto p-3 gap-3"
      data-testid="adventure-left-nav"
      aria-label="Adventure navigation"
    >
      <Link to="/dashboard" className="flex items-center gap-2 px-1 py-1 group">
        <span className="text-xl" aria-hidden="true">🔥</span>
        <span className="font-pixel-display text-[10px] text-gradient-arcane group-hover:opacity-80 transition-opacity">
          CHRONICLE AI
        </span>
      </Link>

      <div className="chr-divider" />

      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activePanel === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPanel(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors',
                'font-pixel-body text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                isActive
                  ? 'bg-arcane-900/40 text-arcane-300 border-l-2 border-arcane-500'
                  : 'text-void-400 hover:text-void-200 hover:bg-void-800/50 border-l-2 border-transparent',
              ].join(' ')}
            >
              <span className="text-base leading-none" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
        <Link
          to={`/characters/${campaign.characterId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-pixel-body text-sm text-void-400 hover:text-void-200 hover:bg-void-800/50 border-l-2 border-transparent"
        >
          <span className="text-base leading-none" aria-hidden="true">🎒</span>
          Inventory
        </Link>
        {/* No settings page exists anywhere in the app yet (confirmed —
            no /settings route, AudioSettings.tsx is built but unmounted).
            Rendered as an honest disabled placeholder rather than a
            broken link, matching this phase's "no invented systems"
            constraint. */}
        <button
          type="button"
          disabled
          title="Settings are not available yet"
          className="flex items-center gap-2.5 px-3 py-2 rounded text-left font-pixel-body text-sm text-void-700 cursor-not-allowed border-l-2 border-transparent"
        >
          <span className="text-base leading-none" aria-hidden="true">⚙️</span>
          Settings
        </button>
      </div>

      <div className="chr-divider" />

      <PixelPanel variant="arcane" className="p-3" data-testid="current-objective-card">
        <p className="font-pixel-display text-[8px] text-arcane-400 mb-1.5 uppercase">Current Objective</p>
        {currentObjective ? (
          <>
            <p className="text-void-100 text-sm font-semibold leading-snug">{currentObjective.title}</p>
            <p className="text-void-400 text-xs mt-1 line-clamp-2">{currentObjective.description}</p>
          </>
        ) : (
          <p className="text-void-600 text-xs">No active objective yet.</p>
        )}
      </PixelPanel>

      <PixelPanel className="p-3" data-testid="world-status-card">
        <p className="font-pixel-display text-[8px] text-spirit-400 mb-1.5 uppercase">World Status</p>
        <div className="flex flex-col gap-1 font-pixel-body text-sm">
          <div className="flex items-center justify-between">
            <span className="text-void-500">Turn</span>
            <span className="text-void-200 tabular-nums">{session.turnNumber}</span>
          </div>
          {worldState.worldTime && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-void-500 flex-shrink-0">Time</span>
              <span className="text-arcane-300 text-right truncate">{worldState.worldTime}</span>
            </div>
          )}
          {currentLocation && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-void-500 flex-shrink-0">Location</span>
              <span className="text-heal-400 text-right truncate">{currentLocation.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-void-500">Discovered</span>
            <span className="text-void-200 tabular-nums">{discoveredCount}</span>
          </div>
        </div>
      </PixelPanel>

      {!isSessionDone && (
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={onEndSession}
          loading={isActionInFlight}
          disabled={isActionInFlight}
          className="mt-auto w-full"
        >
          End Session
        </Button>
      )}
    </nav>
  )
}
