/**
 * PauseMenu — Presentation 3 (Playable Overworld)
 *
 * Esc/Tab over the paused map: a JRPG pause overlay REUSING the
 * existing panels — CharacterSidebar, JournalPanel, QuestsPanel,
 * AtlasPanel, CodexPanel, AudioSettingsPanel — over a dimmed backdrop.
 * This is what removes the need for permanent dashboard-style side
 * columns in overworld mode: everything those columns offered is one
 * keypress away, over the world instead of beside it.
 *
 * The Level Up flow deliberately stays on the story-mode Journal tab
 * (SessionSummaryPanel hides its button when no handler is passed) —
 * the pause menu reads state, it does not own modals.
 */

import { CharacterSidebar } from '../CharacterSidebar'
import { JournalPanel } from '../panels/JournalPanel'
import { QuestsPanel } from '../panels/QuestsPanel'
import { AtlasPanel } from '../panels/AtlasPanel'
import { CodexPanel } from '../panels/CodexPanel'
import { AudioSettingsPanel, Icon } from '@/components/pixel'
import type { IconName } from '@/components/pixel'
import type { AdventureState } from '../useAdventureSession'

export type PauseTab = 'character' | 'journal' | 'quests' | 'atlas' | 'codex' | 'settings'

const PAUSE_TABS: Array<{ id: PauseTab; label: string; icon: IconName }> = [
  { id: 'character', label: 'Character', icon: 'character' },
  { id: 'journal',   label: 'Journal',   icon: 'journal' },
  { id: 'quests',    label: 'Quests',    icon: 'questsMap' },
  { id: 'atlas',     label: 'Atlas',     icon: 'world' },
  { id: 'codex',     label: 'Codex',     icon: 'codex' },
  { id: 'settings',  label: 'Settings',  icon: 'settings' },
]

interface PauseMenuProps {
  state: AdventureState
  tab: PauseTab
  onSelectTab: (tab: PauseTab) => void
  onClose: () => void
}

export function PauseMenu({ state, tab, onSelectTab, onClose }: PauseMenuProps) {
  const { campaign, character, session } = state
  if (!campaign || !session) return null

  return (
    <div
      className="absolute inset-0 z-40 flex bg-void-950/85 backdrop-blur-sm menu-enter"
      data-testid="pause-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Pause menu"
    >
      {/* Tab rail */}
      <nav
        className="flex-shrink-0 w-44 flex flex-col gap-1 p-3 border-r border-bronze-800/50"
        aria-label="Pause menu sections"
      >
        <p className="font-pixel-display text-[10px] text-bronze-400 uppercase px-2 pb-2">Paused</p>
        {PAUSE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-sm text-left transition-all font-body text-sm font-medium border',
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
          className="mt-auto flex items-center gap-2 px-3 py-2 rounded-sm text-left font-body text-sm text-void-500 hover:text-arcane-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
          data-testid="pause-close"
        >
          ✕ Resume (Esc)
        </button>
      </nav>

      {/* Panel content — the EXISTING components, unmodified */}
      <div className="flex-1 min-w-0 overflow-hidden" data-testid="pause-panel">
        {tab === 'character' && character && <CharacterSidebar character={character} />}
        {tab === 'journal' && (
          <JournalPanel
            session={session}
            campaign={campaign}
            turns={state.turns}
            lastCombatResult={state.lastCombatResult}
            readyToLevel={state.readyToLevel}
            character={character}
          />
        )}
        {tab === 'quests' && <QuestsPanel campaign={campaign} />}
        {tab === 'atlas' && <AtlasPanel campaign={campaign} />}
        {tab === 'codex' && <CodexPanel campaign={campaign} />}
        {tab === 'settings' && (
          <div className="p-4 max-w-sm">
            <AudioSettingsPanel />
          </div>
        )}
      </div>
    </div>
  )
}
