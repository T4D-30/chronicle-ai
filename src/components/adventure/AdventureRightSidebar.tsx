/**
 * AdventureRightSidebar — Phase 14.1 (Adventure Hub layout refinement)
 *
 * Consolidates the three previously-separate right-hand columns
 * (PartyStatusPanel, CharacterSidebar, WorldStatusSidebar) into a single
 * tabbed sidebar. Layout-only change: none of the three panels' data,
 * markup, or logic is modified — this component only adds a tab switcher
 * around them, mirroring the same "same callback, different chrome"
 * pattern AdventureLeftNav already uses for the bottom tab nav.
 *
 * Previously these three asides all appeared simultaneously from the
 * `xl` breakpoint (alongside the left nav and main column, five columns
 * total) — too crowded for the retro RPG layout this phase targets.
 * Collapsing them behind tabs keeps the hub to at most three columns
 * (left nav / story / this sidebar) at any breakpoint, and gives the
 * story column back the width the extra columns were taking.
 */

import { useState } from 'react'
import { PartyStatusPanel } from './PartyStatusPanel'
import { CharacterSidebar } from './CharacterSidebar'
import { WorldStatusSidebar } from './WorldStatusSidebar'
import type { AdventureState } from './useAdventureSession'

type SidebarTab = 'status' | 'character' | 'world'

const TABS: Array<{ id: SidebarTab; label: string; icon: string }> = [
  { id: 'status',    label: 'Status',    icon: '📊' },
  { id: 'character', label: 'Character', icon: '⚔️' },
  { id: 'world',     label: 'World',     icon: '🌍' },
]

interface AdventureRightSidebarProps {
  campaign: NonNullable<AdventureState['campaign']>
  character: NonNullable<AdventureState['character']>
  session: NonNullable<AdventureState['session']>
  turns: AdventureState['turns']
  combatState: AdventureState['combatState']
  onViewJournal: () => void
}

export function AdventureRightSidebar({
  campaign,
  character,
  session,
  turns,
  combatState,
  onViewJournal,
}: AdventureRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('status')

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="adventure-right-sidebar">
      {/* Plain buttons rather than role="tab"/"tablist": AdventureHub's
          bottom nav already owns that ARIA tablist pattern page-wide (see
          phase7Polish.test.tsx, which asserts on `getAllByRole('tab')`
          unscoped) — a second tablist would collide with that query and
          overload the semantics of "tab" on this page. aria-pressed is the
          correct role for a plain toggle-button switcher like this one. */}
      <div
        className="flex-shrink-0 flex border-b border-void-700/50"
        role="group"
        aria-label="Sidebar panels"
        data-testid="adventure-right-sidebar-tabs"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              aria-controls={`sidebar-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors',
                'font-pixel-display text-[8px] uppercase',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 focus-visible:ring-inset',
                isActive
                  ? 'text-arcane-400 border-b-2 border-arcane-500 -mb-px bg-arcane-900/20'
                  : 'text-void-500 hover:text-void-300',
              ].join(' ')}
            >
              <span className="text-sm leading-none" aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'status' && (
          <div id="sidebar-panel-status" className="h-full">
            <PartyStatusPanel character={character} turns={turns} onViewJournal={onViewJournal} />
          </div>
        )}
        {activeTab === 'character' && (
          <div id="sidebar-panel-character" className="h-full">
            <CharacterSidebar character={character} />
          </div>
        )}
        {activeTab === 'world' && (
          <div id="sidebar-panel-world" className="h-full">
            <WorldStatusSidebar campaign={campaign} session={session} combatState={combatState} />
          </div>
        )}
      </div>
    </div>
  )
}
