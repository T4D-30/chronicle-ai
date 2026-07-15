/**
 * AdventureHub
 *
 * The permanent in-game shell. This is the layout that every future gameplay
 * feature will live inside — not a transient session page.
 *
 * Unified Adventure Screen (Presentation 4, B1):
 *   ┌───────────────────────────────────────────────┐
 *   │  Status Bar (campaign, session controls)       │
 *   ├───────────────────────────────────────────────┤
 *   │                                               │
 *   │  WORLD — OverworldMode, full-bleed, always    │
 *   │  the primary surface (CombatPanel swaps in    │
 *   │  during combat — Law 5)                       │
 *   │                                               │
 *   │  overlays: pause menu (panels), dialogue      │
 *   ├───────────────────────────────────────────────┤
 *   │  Bottom tab nav (always visible — Law 1)      │
 *   └───────────────────────────────────────────────┘
 *
 * There is no separate Story screen anymore: story presentation docks
 * over the world (StoryHud — NPC dialogue and ambient beats). Every
 * other panel — Character, Dice, Journal, Quests, Atlas,
 * Codex, Settings, flagged Debug — opens through the SAME pause overlay
 * the Esc key uses, over the frozen world, never replacing it. The
 * bottom tab nav and the pause menu are two doors into one surface.
 *
 * The old dashboard-style side columns were superseded and removed
 * in the unified-screen cleanup: the world is primary and their
 * content lives in the overlay panels.
 *
 * Constitution Law 1: the bottom tab nav is ALWAYS visible.
 * Constitution Law 3: character values come from the engine, never prose.
 * Constitution Law 5: combat keeps its own visual mode.
 */

import { useState, useEffect } from 'react'
import { AdventureStatusBar } from './AdventureStatusBar'
import { DEFAULT_OVERWORLD_AREA, OverworldMode } from './overworld/OverworldMode'
import type { OverworldArea } from './overworld/OverworldMode'
import type { PauseTab } from './overworld/PauseMenu'
import { CombatPanel } from './panels/CombatPanel'
import { AmbientOverlay, useAudio, Icon } from '@/components/pixel'
import type { AmbienceKind, IconName } from '@/components/pixel'
import { LevelUpModal } from '@/components/character/LevelUpModal'
import type { AdventureState, AdventureActions } from './useAdventureSession'

const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true'

/** Bottom-nav tabs: the unified Adventure surface plus the overlay
 *  panels it can open. Settings stays pause-menu-only (as before). */
export type AdventureTab = 'adventure' | PauseTab

const TAB_DEFS: Array<{ id: AdventureTab; label: string; icon: IconName }> = [
  { id: 'adventure', label: 'Adventure', icon: 'move' },
  { id: 'character', label: 'Character', icon: 'character' },
  { id: 'dice',      label: 'Dice',      icon: 'dice' },
  { id: 'journal',   label: 'Journal',   icon: 'journal' },
  { id: 'quests',    label: 'Quests',    icon: 'questsMap' },
  { id: 'atlas',     label: 'Atlas',     icon: 'world' },
  { id: 'codex',     label: 'Codex',     icon: 'codex' },
  // Debug tab only shown when VITE_ENABLE_DEBUG_PANEL=true
  ...(DEBUG_ENABLED ? [{ id: 'debug' as AdventureTab, label: 'Debug', icon: 'debug' as IconName }] : []),
]

interface AdventureHubProps {
  state: AdventureState
  actions: AdventureActions
}

export function AdventureHub({ state, actions }: AdventureHubProps) {
  // Which pause-overlay panel is open over the world (null = playing).
  // Owned here — not in OverworldMode — so the bottom tab nav and the
  // Esc key drive the same overlay.
  const [overlayTab, setOverlayTab] = useState<PauseTab | null>(null)
  const [saveConfirmed, setSaveConfirmed] = useState(false)
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  // Overworld area + exact position/facing — lifted so combat handoff
  // can unmount/remount the world without losing where the player was.
  const [overworldArea, setOverworldArea] = useState<OverworldArea>(DEFAULT_OVERWORLD_AREA)
  const { setContext } = useAudio()

  const { campaign, character, session, combatState } = state

  // Combat owns the screen (Law 5): any open overlay closes when combat
  // starts so it can't silently reopen over the post-combat world.
  useEffect(() => {
    if (combatState) setOverlayTab(null)
  }, [!!combatState])

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
            ⬆ Level up available — open your Journal to level up!
          </span>
        </div>
      )}

      {/* ── The world — the one main surface (combat swaps in, Law 5) ── */}
      <main
        className="flex-1 overflow-hidden min-w-0 min-h-0 relative"
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
          <div id="panel-adventure" role="tabpanel" aria-label="Adventure" className="h-full overflow-hidden">
            <OverworldMode
              state={state}
              actions={actions}
              area={overworldArea}
              onAreaChange={setOverworldArea}
              pauseTab={overlayTab}
              onPauseTabChange={setOverlayTab}
              onLevelUp={() => setLevelUpOpen(true)}
            />
          </div>
        )}
      </main>

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

      {/* ── Bottom tab nav — always visible (Law 1). "Adventure" returns
          to the world; every other tab opens the pause overlay OVER the
          world (world stays mounted — position, facing, and map are
          preserved). Overlay tabs are disabled during combat: combat
          keeps its own visual mode (Law 5), exactly as before when tab
          clicks were silently overridden by the combat panel. ── */}
      <nav
        className="flex-shrink-0 flex border-t border-void-700/50 bg-void-900/90 backdrop-blur-sm safe-area-bottom"
        role="tablist"
        aria-label="Adventure panels"
        data-testid="adventure-tab-nav"
      >
        {TAB_DEFS.map((tab) => {
          const isActive = tab.id === 'adventure' ? overlayTab === null : overlayTab === tab.id
          const isCombatLocked = !!combatState && tab.id !== 'adventure'
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={tab.id === 'adventure' ? 'panel-adventure' : 'pause-panel'}
              // Below `sm` the label span is display:none and the icon is
              // decorative, so the button needs an explicit name.
              aria-label={tab.label}
              type="button"
              disabled={isCombatLocked}
              onClick={() => setOverlayTab(tab.id === 'adventure' ? null : tab.id)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-3 px-1 min-h-[44px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 focus-visible:ring-inset',
                'text-[9px] font-pixel-display disabled:opacity-40',
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
