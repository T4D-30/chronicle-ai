/**
 * OverworldMode — Presentation 3 (Playable Overworld)
 *
 * The hub-side orchestrator for overworld play: composes the scene,
 * dialogue mode, and (next milestones) transitions and the pause menu.
 * Holds only PRESENTATION state (which dialogue is open, current map);
 * all game consequences flow through the adapter into the existing
 * Adventure Controller.
 *
 * Dialogue mode: ANY interact intent opens the dialogue window with
 * the entity as the speaker — the window displays the Director's real
 * response (streaming text live, then the completed turn's narration).
 * While open, the scene is locked (movement and turning frozen);
 * closing restores movement. Choices and free-form input submit
 * through the same actions.submitAction contract as ActionBar.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { OverworldScene } from './OverworldScene'
import { DialogueWindow } from './DialogueWindow'
import { PauseMenu } from './PauseMenu'
import type { PauseTab } from './PauseMenu'
import { WorldTransition, TRANSITION_PHASE_MS } from './WorldTransition'
import type { TransitionPhase } from './WorldTransition'
import { handleOverworldIntent } from './overworldAdapter'
import { OVERWORLD_MAPS, monasteryCourtyard } from './maps'
import type { OverworldIntent } from './overworldTypes'
import type { FacingDirection, TileCoord } from './overworldTypes'
import type { AdventureState, AdventureActions } from '../useAdventureSession'

export interface OverworldArea {
  mapId: string
  spawnId: string
  position?: TileCoord
  facing?: FacingDirection
  activeZoneKey?: string | null
}

export const DEFAULT_OVERWORLD_AREA: OverworldArea = {
  mapId: monasteryCourtyard.id,
  spawnId: 'start',
}

interface OverworldModeProps {
  state: AdventureState
  actions: AdventureActions
  area?: OverworldArea
  onAreaChange?: (area: OverworldArea) => void
}

export function OverworldMode({
  state,
  actions,
  area: controlledArea,
  onAreaChange,
}: OverworldModeProps) {
  const [dialogue, setDialogue] = useState<{ speaker: string } | null>(null)
  // Current area — presentation state; named-location persistence
  // happens ONLY via the exit intent's grounded text through the
  // controller, never per tile. AdventureHub may own this so combat
  // handoff can unmount/remount the world without resetting the area.
  const [localArea, setLocalArea] = useState<OverworldArea>(DEFAULT_OVERWORLD_AREA)
  const area = controlledArea ?? localArea
  const [transition, setTransition] = useState<TransitionPhase>(null)
  const pendingArea = useRef<OverworldArea | null>(null)
  const currentPlayer = useRef<{ pos: TileCoord; facing: FacingDirection } | null>(null)
  // Narration older than the dialogue is stale — only show responses
  // that arrive after it opened.
  const turnCountAtOpen = useRef(0)

  const [pauseTab, setPauseTab] = useState<PauseTab | null>(null)

  const isStreaming = state.narrationStatus === 'streaming'
  const busy = state.isActionInFlight || isStreaming
  const locked = !!dialogue || !!transition || busy || !!pauseTab

  const commitArea = useCallback((nextArea: OverworldArea) => {
    if (onAreaChange) {
      onAreaChange(nextArea)
    } else {
      setLocalArea(nextArea)
    }
  }, [onAreaChange])

  const commitPlayerState = useCallback(({ pos, facing }: { pos: TileCoord; facing: FacingDirection }) => {
    currentPlayer.current = { pos, facing }
    const nextArea = {
      mapId: area.mapId,
      spawnId: area.spawnId,
      activeZoneKey: area.activeZoneKey,
      position: pos,
      facing,
    }
    commitArea(nextArea)
  }, [area.mapId, area.spawnId, area.activeZoneKey, commitArea])

  // Escape: pause menu over the frozen map. When dialogue is open it
  // closes that first (never strands the player — Law 1). Tab remains
  // available for standard keyboard focus navigation.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (dialogue) {
        setDialogue(null)
        return
      }
      setPauseTab((current) => (current ? null : 'character'))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialogue])

  // Timer-driven fade: out → swap at full black → in → clear.
  useEffect(() => {
    if (!transition) return
    const timer = window.setTimeout(() => {
      if (transition === 'out') {
        if (pendingArea.current) {
          commitArea(pendingArea.current)
          pendingArea.current = null
        }
        setTransition('in')
      } else {
        setTransition(null)
      }
    }, TRANSITION_PHASE_MS)
    return () => window.clearTimeout(timer)
  }, [transition, commitArea])

  function onIntent(intent: OverworldIntent) {
    if (intent.type === 'interact') {
      turnCountAtOpen.current = state.turns.length
      setDialogue({ speaker: intent.entityName })
    }
    if (intent.type === 'exit' && OVERWORLD_MAPS[intent.to]) {
      pendingArea.current = { mapId: intent.to, spawnId: intent.spawn }
      setTransition('out')
    }
    if (intent.type === 'encounter') {
      const player = currentPlayer.current
      commitArea({
        ...area,
        position: player?.pos ?? area.position,
        facing: player?.facing ?? area.facing,
        activeZoneKey: `enc:${intent.triggerId}`,
      })
    }
    handleOverworldIntent(intent, actions)
  }

  const map = OVERWORLD_MAPS[area.mapId] ?? monasteryCourtyard

  const latestTurn = state.turns[state.turns.length - 1]
  const responseText = isStreaming
    ? state.streamingText
    : state.turns.length > turnCountAtOpen.current
      ? latestTurn?.aiNarration ?? ''
      : ''

  return (
    <div className="relative w-full h-full" data-testid="overworld-mode">
      <OverworldScene
        map={map}
        spawnId={area.spawnId}
        character={state.character}
        locked={locked}
        onIntent={onIntent}
        initialPosition={area.position}
        initialFacing={area.facing}
        initialZoneKey={area.activeZoneKey}
        onPlayerStateChange={commitPlayerState}
      />

      <WorldTransition phase={transition} />

      {pauseTab && (
        <PauseMenu
          state={state}
          tab={pauseTab}
          onSelectTab={setPauseTab}
          onClose={() => setPauseTab(null)}
        />
      )}

      {dialogue && (
        <DialogueWindow
          speaker={dialogue.speaker}
          text={responseText}
          streaming={isStreaming}
          suggestedActions={isStreaming ? [] : state.suggestedActions}
          busy={busy}
          onChoose={(text) => actions.submitAction(text)}
          onSubmitFree={(text) => actions.submitAction(text)}
          onClose={() => setDialogue(null)}
        />
      )}
    </div>
  )
}
