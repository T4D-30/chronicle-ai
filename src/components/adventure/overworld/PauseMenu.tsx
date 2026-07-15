/**
 * PauseMenu — Presentation 3 (Playable Overworld)
 *
 * Esc over the paused map: a JRPG pause overlay REUSING the existing
 * panels — CharacterSidebar, JournalPanel, QuestsPanel, AtlasPanel,
 * CodexPanel, DicePanel, AudioSettingsPanel (+ DebugPanel when the
 * debug flag is on) — over a dimmed backdrop. Since the unified
 * Adventure screen (B1), this overlay is THE panel surface: the hub's
 * bottom tab nav routes here too, so everything the old dashboard-style
 * columns and tab panels offered opens over the world instead of
 * replacing it.
 *
 * Level Up: the hub passes `onLevelUp` through to JournalPanel so the
 * flow stays reachable from the Journal overlay — the modal itself
 * stays owned by the hub (the pause menu reads state, it does not own
 * modals).
 */

import { useEffect, useRef } from 'react'
import { CharacterSidebar } from '../CharacterSidebar'
import { JournalPanel } from '../panels/JournalPanel'
import { QuestsPanel } from '../panels/QuestsPanel'
import { AtlasPanel } from '../panels/AtlasPanel'
import { CodexPanel } from '../panels/CodexPanel'
import { DebugPanel } from '../panels/DebugPanel'
import { DicePanel } from '../DicePanel'
import { AudioSettingsPanel, TextSettingsPanel, Icon } from '@/components/pixel'
import type { IconName } from '@/components/pixel'
import type { AdventureState } from '../useAdventureSession'

export type PauseTab =
  | 'character'
  | 'dice'
  | 'journal'
  | 'quests'
  | 'atlas'
  | 'codex'
  | 'settings'
  | 'debug'

const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true'

const PAUSE_TABS: Array<{ id: PauseTab; label: string; icon: IconName }> = [
  { id: 'character', label: 'Character', icon: 'character' },
  { id: 'dice',      label: 'Dice',      icon: 'dice' },
  { id: 'journal',   label: 'Journal',   icon: 'journal' },
  { id: 'quests',    label: 'Quests',    icon: 'questsMap' },
  { id: 'atlas',     label: 'Atlas',     icon: 'world' },
  { id: 'codex',     label: 'Codex',     icon: 'codex' },
  { id: 'settings',  label: 'Settings',  icon: 'settings' },
  ...(DEBUG_ENABLED ? [{ id: 'debug' as PauseTab, label: 'Debug', icon: 'debug' as IconName }] : []),
]

interface PauseMenuProps {
  state: AdventureState
  tab: PauseTab
  onSelectTab: (tab: PauseTab) => void
  onClose: () => void
  onLevelUp?: () => void
}

export function PauseMenu({ state, tab, onSelectTab, onClose, onLevelUp }: PauseMenuProps) {
  const { campaign, character, session } = state
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const selectedTab = dialogRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    selectedTab?.focus()

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      previouslyFocused?.focus()
    }
  }, [])

  if (!campaign || !session) return null

  return (
    <div
      ref={dialogRef}
      className="absolute inset-0 z-40 flex flex-col sm:flex-row bg-void-950/85 backdrop-blur-sm menu-enter"
      data-testid="pause-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Pause menu"
    >
      {/* Tab rail */}
      <nav
        className="flex-shrink-0 w-full sm:w-44 flex flex-row sm:flex-col gap-1 p-2 sm:p-3 border-b sm:border-b-0 sm:border-r border-bronze-800/50 overflow-x-auto"
        aria-label="Pause menu sections"
      >
        <p className="hidden sm:block font-pixel-display text-[10px] text-bronze-400 uppercase px-2 pb-2">Paused</p>
        {PAUSE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={[
              'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-sm text-left transition-all font-body text-sm font-medium border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
              tab === t.id
                ? 'bg-panel-800 text-arcane-300 border-bronze-500'
                : 'bg-transparent text-void-400 border-transparent hover:text-arcane-200 hover:bg-panel-800/60',
            ].join(' ')}
            data-testid={`pause-tab-${t.id}`}
          >
            <Icon name={t.icon} className="text-base leading-none" />
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 sm:mt-auto flex items-center gap-2 px-3 py-2 rounded-sm text-left font-body text-sm text-void-500 hover:text-arcane-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
          data-testid="pause-close"
        >
          ✕ Resume (Esc)
        </button>
      </nav>

      {/* Panel content — the EXISTING components, unmodified */}
      {/* id targeted by the hub bottom-nav tabs' aria-controls */}
      <div id="pause-panel" className="flex-1 min-w-0 min-h-0 overflow-hidden" data-testid="pause-panel">
        {tab === 'character' && character && <CharacterSidebar character={character} />}
        {tab === 'dice' && <DicePanel />}
        {tab === 'journal' && (
          <JournalPanel
            session={session}
            campaign={campaign}
            turns={state.turns}
            lastCombatResult={state.lastCombatResult}
            readyToLevel={state.readyToLevel}
            character={character}
            onLevelUp={onLevelUp}
          />
        )}
        {tab === 'quests' && <QuestsPanel campaign={campaign} />}
        {tab === 'atlas' && <AtlasPanel campaign={campaign} />}
        {tab === 'codex' && <CodexPanel campaign={campaign} />}
        {tab === 'settings' && (
          <div className="p-4 max-w-sm space-y-4 overflow-y-auto max-h-full">
            <AudioSettingsPanel />
            <TextSettingsPanel />
          </div>
        )}
        {tab === 'debug' && DEBUG_ENABLED && <DebugPanel state={state} />}
      </div>
    </div>
  )
}
