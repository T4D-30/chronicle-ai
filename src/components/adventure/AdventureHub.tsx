/**
 * AdventureHub
 *
 * The permanent in-game shell. This is the layout that every future gameplay
 * feature will live inside — not a transient session page.
 *
 * Layout (Phase 14.1 layout refinement — at most 3 columns at any breakpoint):
 *   ┌───────────────────────────────────────────────┐
 *   │  Status Bar (campaign, session, session)       │
 *   ├─────────┬───────────────────────┬─────────────┤
 *   │  Left   │  Main panel area      │  Right       │
 *   │  nav    │  (Story / Dice / etc) │  sidebar     │
 *   │ (lg+)   │  wider story column   │  (tabbed,    │
 *   │         │                       │   md+)       │
 *   ├─────────┴───────────────────────┴─────────────┤
 *   │  Bottom tab nav (always visible)               │
 *   └─────────────────────────────────────────────────┘
 *
 * The right sidebar (AdventureRightSidebar) consolidates what used to be
 * three separate always-visible columns (party status, character detail,
 * world status) behind tabs — see that component's header comment. On
 * mobile/tablet (below `md`) all of it remains reachable via the bottom
 * tab nav's Character tab, unchanged.
 *
 * Constitution Law 1: the bottom tab nav is ALWAYS visible.
 * Constitution Law 3: character values come from the engine, never prose.
 */

import { useState, useEffect } from 'react'
import { AdventureStatusBar } from './AdventureStatusBar'
import { CharacterSidebar } from './CharacterSidebar'
import { AdventureLeftNav } from './AdventureLeftNav'
import { AdventureScenePanel } from './AdventureScenePanel'
import { AdventureRightSidebar } from './AdventureRightSidebar'
import { DicePanel } from './DicePanel'
import { StoryPanel } from './panels/StoryPanel'
import { JournalPanel } from './panels/JournalPanel'
import { QuestsPanel } from './panels/QuestsPanel'
import { AtlasPanel } from './panels/AtlasPanel'
import { OverworldScene } from './overworld/OverworldScene'
import { handleOverworldIntent } from './overworld/overworldAdapter'
import { monasteryCourtyard } from './overworld/maps/monasteryCourtyard'
import { AtlasMapPanel } from './panels/AtlasMapPanel'
import { CodexPanel } from './panels/CodexPanel'
import { DebugPanel } from './panels/DebugPanel'
import { CombatPanel } from './panels/CombatPanel'
import { ActionBar } from './ActionBar'
import { AmbientOverlay, useAudio, Icon } from '@/components/pixel'
import type { AmbienceKind, IconName } from '@/components/pixel'
import { Button } from '@/components/ui'
import { LevelUpModal } from '@/components/character/LevelUpModal'
import type { AdventureState, AdventureActions } from './useAdventureSession'

export type AdventurePanel =
  | 'story'
  | 'overworld'
  | 'character'
  | 'dice'
  | 'journal'
  | 'quests'
  | 'atlas'
  | 'codex'
  | 'debug'

const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true'

const TAB_DEFS: Array<{ id: AdventurePanel; label: string; icon: IconName }> = [
  { id: 'story',     label: 'Story',     icon: 'story' },
  { id: 'overworld', label: 'World',     icon: 'move' },
  { id: 'character', label: 'Character', icon: 'character' },
  { id: 'dice',      label: 'Dice',      icon: 'dice' },
  { id: 'journal',   label: 'Journal',   icon: 'journal' },
  { id: 'quests',    label: 'Quests',    icon: 'questsMap' },
  { id: 'atlas',     label: 'Atlas',     icon: 'world' },
  { id: 'codex',     label: 'Codex',     icon: 'codex' },
  // Debug tab only shown when VITE_ENABLE_DEBUG_PANEL=true
  ...(DEBUG_ENABLED ? [{ id: 'debug' as AdventurePanel, label: 'Debug', icon: 'debug' as IconName }] : []),
]

interface AdventureHubProps {
  state: AdventureState
  actions: AdventureActions
}

export function AdventureHub({ state, actions }: AdventureHubProps) {
  const [activePanel, setActivePanel] = useState<AdventurePanel>('story')
  const [saveConfirmed, setSaveConfirmed] = useState(false)
  const { setContext } = useAudio()

  const { campaign, character, session, combatState } = state
  if (!campaign || !character || !session) return null

  const isSessionActive = session.status === 'active'
  const isSessionPaused = session.status === 'paused'

  // Better save/load UX (Phase 9.2): confirm explicitly when the player
  // pauses — the moment they most want reassurance their progress is safe.
  // No new persistence logic here; pause() already saves via the existing
  // pauseSession() service call. This is purely a visibility improvement.
  async function handlePause() {
    await actions.pause()
    setSaveConfirmed(true)
    window.setTimeout(() => setSaveConfirmed(false), 2600)
  }
  const isSessionDone   = session.status === 'completed'

  // ── Audio context ──────────────────────────────────────────────────────────
  // locationKind is derived ONLY from real world-state data. Phase 9.2 added
  // a real currentLocationId to WorldState; we resolve it against the known
  // locations list and map only the LocationType values that have an exact
  // AudioManager equivalent ('town', 'dungeon'). Other location types
  // (region, building, floor, room, outdoor) have no honest 1:1 mapping to
  // the audio manifest's town/dungeon/forest keys, so they fall through to
  // the default menu theme rather than being guessed at.
  const currentLocation = campaign.worldState.currentLocationId
    ? campaign.worldState.locations.find((l) => l.id === campaign.worldState.currentLocationId)
    : null
  const locationKind =
    currentLocation?.type === 'town' || currentLocation?.type === 'dungeon'
      ? currentLocation.type
      : null

  const isBossFight = (combatState?.enemies.length ?? 0) >= 3
    || (combatState?.enemies.some((e) => (e.maxHp ?? 0) >= 40) ?? false)

  useEffect(() => {
    setContext({ inCombat: !!combatState, isBoss: isBossFight, locationKind })
  }, [!!combatState, isBossFight, locationKind, setContext])

  // Ambient particles: only rendered when we have a real signal to justify them.
  // Combat never shows weather ambience (it has its own dedicated visual language).
  // Location `type` still has no weather/season data, so we still cannot honestly
  // decide between fireflies/rain/snow/fog — that requires Phase 10's weather
  // field. A static "fireflies always on" would be decoration masquerading as
  // world state, which the Constitution explicitly forbids.
  const ambienceKind: AmbienceKind = 'none'

  return (
    <div className="fixed inset-0 flex flex-col bg-void-950 overflow-hidden" data-testid="adventure-hub">
      <AdventureStatusBar
        campaign={campaign}
        session={session}
        isSessionActive={isSessionActive}
        isSessionPaused={isSessionPaused}
        isSessionDone={isSessionDone}
        saveConfirmed={saveConfirmed}
        isActionInFlight={state.isActionInFlight}
        onPause={() => void handlePause()}
        onResume={() => void actions.resume()}
        onEnd={() => void actions.end()}
      />

      {state.error && (
        <div className="flex-shrink-0 px-4 py-2 bg-harm-600/20 border-b border-harm-600/30">
          <p className="text-harm-400 text-xs" role="alert">{state.error}</p>
        </div>
      )}
      {state.readyToLevel && (
        <div className="flex-shrink-0 px-4 py-2 bg-heal-600/20 border-b border-heal-600/30 flex items-center gap-2">
          <span className="text-heal-300 text-xs font-body font-semibold" role="status">
            ⬆ Level up available — visit your character sheet to level up!
          </span>
        </div>
      )}

      {/* ── Main content area ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left navigation — new in the redesign, desktop-only (lg+).
            Drives the SAME activePanel state as the bottom tab nav below;
            see AdventureLeftNav's own header comment for why the bottom
            tabs are not removed or replaced. Hidden in overworld mode —
            the world is the primary visual area there (Presentation 3);
            everything remains reachable via the bottom tabs (Law 1) and
            the pause menu. */}
        <aside
          className={[
            activePanel === 'overworld' ? 'hidden' : 'hidden lg:flex',
            'w-56 flex-col border-r border-void-700/50 bg-void-900/40 overflow-hidden flex-shrink-0',
          ].join(' ')}
          data-testid="adventure-left-sidebar"
        >
          <AdventureLeftNav
            campaign={campaign}
            session={session}
            activePanel={activePanel}
            onSelectPanel={setActivePanel}
            onEndSession={() => void actions.end()}
            isSessionDone={isSessionDone}
            isActionInFlight={state.isActionInFlight}
          />
        </aside>

        {/* Panel area — Combat Panel overrides normal panels when in combat */}
        <main
          className="flex-1 overflow-hidden min-w-0 relative"
          data-testid="adventure-panel-area"
        >
          <AmbientOverlay kind={ambienceKind} />
          {combatState ? (
            <CombatPanel
              playerSheet={character.sheet}
              enemies={combatState.enemies}
              lastNarration={state.streamingText || state.lastDirectorResult?.narration}
              worldStateUpdates={state.lastDirectorResult?.worldStateUpdates ?? {}}
              onCombatEnd={(result) => void actions.commitCombatResult(result)}
            />
          ) : (
            <ActivePanelContent
              panel={activePanel}
              state={state}
              actions={actions}
            />
          )}
        </main>

        {/* Right sidebar — Phase 14.1: consolidates the party-status,
            character-detail, and world-status columns into one tabbed
            column so the hub never shows more than 3 main columns at once
            (left nav / story / this sidebar). Shown from `md` so tablet
            widths get it too; the story column keeps the rest of the
            width for readability. Everything it shows remains reachable
            on mobile via the Character tab in the bottom nav, unchanged. */}
        <aside
          className={[
            activePanel === 'overworld' ? 'hidden' : 'hidden md:flex',
            'w-72 flex-col border-l border-void-700/50 bg-void-900/40 overflow-hidden flex-shrink-0',
          ].join(' ')}
          data-testid="adventure-right-sidebar-wrapper"
        >
          <AdventureRightSidebar
            campaign={campaign}
            character={character}
            session={session}
            turns={state.turns}
            combatState={combatState}
            onViewJournal={() => setActivePanel('journal')}
          />
        </aside>
      </div>

      {/* ── Bottom tab nav — always visible (Law 1) — combat mode shows combat indicator ─ */}
      <nav
        className="flex-shrink-0 flex border-t border-void-700/50 bg-void-900/90 backdrop-blur-sm safe-area-bottom"
        role="tablist"
        aria-label="Adventure panels"
        data-testid="adventure-tab-nav"
      >
        {TAB_DEFS.map((tab) => {
          const isActive = activePanel === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              type="button"
              onClick={() => setActivePanel(tab.id)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-3 px-1 min-h-[44px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 focus-visible:ring-inset',
                'text-[9px] font-pixel-display',
                isActive
                  ? 'text-arcane-400 border-t-2 border-arcane-500 -mt-px bg-arcane-900/20 torch-flicker'
                  : 'text-void-500 hover:text-void-300',
              ].join(' ')}
            >
              <Icon name={tab.icon} className="text-base leading-none" role="img" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ── Panel dispatcher ─────────────────────────────────────────────────────────

function ActivePanelContent({
  panel,
  state,
  actions,
}: {
  panel: AdventurePanel
  state: AdventureState
  actions: AdventureActions
}) {
  const { campaign, character, turns, session } = state
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const [atlasView, setAtlasView] = useState<'list' | 'map'>('list')

  if (!campaign || !character || !session) return null

  const content = (() => {
    switch (panel) {
    case 'story':
      return (
        <div id="panel-story" role="tabpanel" className="h-full flex flex-col">
          <AdventureScenePanel campaign={campaign} character={character}>
          <StoryPanel
            campaign={campaign}
            turns={turns}
            narrationStatus={state.narrationStatus}
            streamingText={state.streamingText}
            onCancelStream={actions.cancelStream}
            lastCheckResult={state.lastCheckResult}
            onClearCheckResult={actions.clearCheckResult}
          />
          {/* Suggested action chips above the input bar — no visual
              heading (dialogue-readability pass); the aria-label keeps
              the semantics the removed "Suggested" label provided. */}
          {state.suggestedActions.length > 0 && state.narrationStatus !== 'streaming' && (
            <div className="flex-shrink-0 px-4 pb-1 pt-2 max-w-3xl mx-auto w-full">
              <div className="flex gap-2 flex-wrap" role="group" aria-label="Suggested actions">
                {state.suggestedActions.map((action, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant="suggested"
                    disabled={state.narrationStatus === 'streaming' || state.isActionInFlight}
                    onClick={() => actions.submitAction(action)}
                    className="pixel-sparkle"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <ActionBar
            sessionStatus={session.status}
            isInCombat={!!state.combatState}
            isStreaming={state.narrationStatus === 'streaming'}
            isSubmitting={state.isActionInFlight}
            equippedWeapons={character.sheet.equipment.filter((e) => e.slot === 'weapon' && e.equipped)}
            preparedSpells={character.spells?.prepared ?? []}
            inventoryItems={character.inventory.map((i) => ({ id: i.id, name: i.name }))}
            onSubmitAction={actions.submitAction}
            onCancelStream={actions.cancelStream}
          />
          </AdventureScenePanel>
        </div>
      )
    case 'overworld':
      // Presentation 3: the playable overworld. Locked while an action
      // resolves; combat handoff is automatic — when combatState exists
      // the hub swaps this panel for CombatPanel, and combat's end
      // returns here (state unchanged).
      return (
        <div id="panel-overworld" role="tabpanel" className="h-full overflow-hidden">
          <OverworldScene
            map={monasteryCourtyard}
            spawnId="start"
            character={character}
            locked={state.isActionInFlight || state.narrationStatus === 'streaming'}
            onIntent={(intent) => handleOverworldIntent(intent, actions)}
          />
        </div>
      )
    case 'character':
      return (
        <div id="panel-character" role="tabpanel" className="h-full overflow-hidden">
          <CharacterSidebar character={character} />
        </div>
      )
    case 'dice':
      return (
        <div id="panel-dice" role="tabpanel" className="h-full overflow-hidden">
          <DicePanel />
        </div>
      )
    case 'journal':
      return (
        <div id="panel-journal" role="tabpanel" className="h-full overflow-hidden">
          <JournalPanel
            session={session}
            campaign={campaign}
            turns={turns}
            lastCombatResult={state.lastCombatResult}
            readyToLevel={state.readyToLevel}
            character={character}
            onLevelUp={() => setLevelUpOpen(true)}
          />
        </div>
      )
    case 'quests':
      return (
        <div id="panel-quests" role="tabpanel" className="h-full">
          <QuestsPanel campaign={campaign} />
        </div>
      )
    case 'atlas':
      return (
        <div id="panel-atlas" role="tabpanel" className="h-full flex flex-col">
          {/* List/Map toggle — Phase 15.3. AtlasPanel (search/filter/detail)
              is untouched; AtlasMapPanel is a purely additive second view
              over the same real WorldState.locations data. */}
          <div className="flex-shrink-0 flex gap-1.5 px-3 pt-3" role="group" aria-label="Atlas view">
            <Button
              type="button"
              variant={atlasView === 'list' ? 'arcane' : 'ghost'}
              size="sm"
              onClick={() => setAtlasView('list')}
              aria-pressed={atlasView === 'list'}
            >
              List
            </Button>
            <Button
              type="button"
              variant={atlasView === 'map' ? 'arcane' : 'ghost'}
              size="sm"
              onClick={() => setAtlasView('map')}
              aria-pressed={atlasView === 'map'}
            >
              Map
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            {atlasView === 'list' ? (
              <AtlasPanel campaign={campaign} />
            ) : (
              <AtlasMapPanel
                campaign={campaign}
                onSubmitAction={actions.submitAction}
                isDisabled={state.narrationStatus === 'streaming' || state.isActionInFlight || session.status !== 'active'}
              />
            )}
          </div>
        </div>
      )
    case 'codex':
      return (
        <div id="panel-codex" role="tabpanel" className="h-full">
          <CodexPanel campaign={campaign} />
        </div>
      )
    case 'debug':
      // Only reachable when VITE_ENABLE_DEBUG_PANEL=true (tab hidden otherwise)
      return DEBUG_ENABLED ? (
        <div id="panel-debug" role="tabpanel" className="h-full overflow-hidden">
          <DebugPanel state={state} />
        </div>
      ) : null
    }
  })()

  return (
    <>
      {content}
      <LevelUpModal
        open={levelUpOpen}
        character={character}
        isSaving={state.isActionInFlight}
        onCancel={() => setLevelUpOpen(false)}
        onConfirm={async (patch) => {
          await actions.levelUpCharacter(patch)
          setLevelUpOpen(false)
        }}
      />
    </>
  )
}
