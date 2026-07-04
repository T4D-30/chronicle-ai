/**
 * AdventureHub
 *
 * The permanent in-game shell. This is the layout that every future gameplay
 * feature will live inside — not a transient session page.
 *
 * Layout (Constitution exploration mode spec):
 *   ┌─────────────────────────────────────────┐
 *   │  Status Bar (campaign, session, session) │
 *   ├────────────────────────┬────────────────┤
 *   │  Main panel area       │  Character     │
 *   │  (Story / Dice / etc)  │  Sidebar       │
 *   │                        │  (desktop only)│
 *   ├────────────────────────┴────────────────┤
 *   │  Bottom tab nav (always visible)        │
 *   └─────────────────────────────────────────┘
 *
 * On mobile the character sidebar is the "Character" tab in the bottom nav.
 * On desktop it is always-visible on the right.
 *
 * Constitution Law 1: the bottom tab nav is ALWAYS visible.
 * Constitution Law 3: character values come from the engine, never prose.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Badge } from '@/components/ui'
import { CharacterSidebar } from './CharacterSidebar'
import { DicePanel } from './DicePanel'
import { StoryPanel } from './panels/StoryPanel'
import { JournalPanel } from './panels/JournalPanel'
import { QuestsPanel } from './panels/QuestsPanel'
import { AtlasPanel } from './panels/AtlasPanel'
import { CodexPanel } from './panels/CodexPanel'
import { DebugPanel } from './panels/DebugPanel'
import { CombatPanel } from './panels/CombatPanel'
import { ActionBar } from './ActionBar'
import { AmbientOverlay, PixelPanel, useAudio } from '@/components/pixel'
import type { AmbienceKind } from '@/components/pixel'
import { LevelUpModal } from '@/components/character/LevelUpModal'
import type { AdventureState, AdventureActions } from './useAdventureSession'

export type AdventurePanel =
  | 'story'
  | 'character'
  | 'dice'
  | 'journal'
  | 'quests'
  | 'atlas'
  | 'codex'
  | 'debug'

const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true'

const TAB_DEFS: Array<{ id: AdventurePanel; label: string; icon: string }> = [
  { id: 'story',     label: 'Story',     icon: '📖' },
  { id: 'character', label: 'Character', icon: '⚔️' },
  { id: 'dice',      label: 'Dice',      icon: '🎲' },
  { id: 'journal',   label: 'Journal',   icon: '📜' },
  { id: 'quests',    label: 'Quests',    icon: '🗺️' },
  { id: 'atlas',     label: 'Atlas',     icon: '🌍' },
  { id: 'codex',     label: 'Codex',     icon: '📚' },
  // Debug tab only shown when VITE_ENABLE_DEBUG_PANEL=true
  ...(DEBUG_ENABLED ? [{ id: 'debug' as AdventurePanel, label: 'Debug', icon: '🔧' }] : []),
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
      {/* ── Status bar ──────────────────────────────────────────────── */}
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
              onClick={() => void handlePause()}
              loading={state.isActionInFlight}
            >
              Pause
            </Button>
          )}
          {isSessionPaused && (
            <Button
              type="button"
              variant="arcane"
              size="sm"
              onClick={() => void actions.resume()}
              loading={state.isActionInFlight}
            >
              Resume
            </Button>
          )}
          {!isSessionDone && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => void actions.end()}
              loading={state.isActionInFlight}
              disabled={state.isActionInFlight}
            >
              End
            </Button>
          )}
        </div>
      </header>

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

        {/* Character sidebar — always visible on lg+ screens */}
        <aside
          className="hidden lg:flex w-64 flex-col border-l border-void-700/50 bg-void-900/40 overflow-hidden"
          data-testid="adventure-character-sidebar"
        >
          <CharacterSidebar character={character} />
        </aside>

        {/* World status sidebar — third column, xl+ screens only.
            Additive: shows only real, currently-available world-state signals.
            Fields the Constitution would require (weather, time-of-day, active
            events, NPC relationships) are Phase 10 Living World work and are
            NOT fabricated here — see WorldStatusSidebar for what is and isn't
            shown and why. */}
        <aside
          className="hidden xl:flex w-60 flex-col border-l border-void-700/50 bg-void-900/40 overflow-hidden"
          data-testid="adventure-world-sidebar"
          aria-label="World status"
        >
          <WorldStatusSidebar campaign={campaign} session={session} combatState={combatState} />
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
              <span className="text-base leading-none" role="img" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ── World status sidebar (third column) ─────────────────────────────────────

/**
 * Shows real WorldState signals only: discovered locations, known NPCs,
 * faction standings, the Director's free-text worldTime if set, and (as of
 * Phase 9.2) the player's current location, resolved honestly against
 * WorldState.locations — never guessed or defaulted.
 *
 * Deliberately does NOT show: weather, day/night cycle, NPC relationships,
 * or reputation scores — none of these exist as structured data yet.
 * Fabricating them here would violate Constitution Law 3 (character/world
 * values come from real state, never invented). These arrive with the
 * Phase 10 Living World foundation.
 */
function WorldStatusSidebar({
  campaign, session, combatState,
}: {
  campaign: NonNullable<AdventureState['campaign']>
  session: NonNullable<AdventureState['session']>
  combatState: AdventureState['combatState']
}) {
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

  if (!campaign || !character || !session) return null

  const content = (() => {
    switch (panel) {
    case 'story':
      return (
        <div id="panel-story" role="tabpanel" className="h-full flex flex-col">
          <StoryPanel
            campaign={campaign}
            turns={turns}
            narrationStatus={state.narrationStatus}
            streamingText={state.streamingText}
            onCancelStream={actions.cancelStream}
            lastCheckResult={state.lastCheckResult}
            onClearCheckResult={actions.clearCheckResult}
          />
          {/* Suggested action chips above the input bar */}
          {state.suggestedActions.length > 0 && state.narrationStatus !== 'streaming' && (
            <div className="flex-shrink-0 px-4 pb-1 pt-2">
              <p className="stat-label text-void-600 mb-1.5">Suggested</p>
              <div className="flex gap-2 flex-wrap">
                {state.suggestedActions.map((action, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => actions.submitAction(action)}
                    className="px-3 py-1.5 rounded-full text-xs font-body border border-arcane-800/50 bg-arcane-900/20 text-arcane-300 hover:bg-arcane-900/40 hover:border-arcane-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
                  >
                    {action}
                  </button>
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
        <div id="panel-atlas" role="tabpanel" className="h-full">
          <AtlasPanel campaign={campaign} />
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
