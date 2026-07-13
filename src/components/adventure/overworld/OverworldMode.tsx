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

import { useRef, useState } from 'react'
import { OverworldScene } from './OverworldScene'
import { DialogueWindow } from './DialogueWindow'
import { handleOverworldIntent } from './overworldAdapter'
import { monasteryCourtyard } from './maps/monasteryCourtyard'
import type { OverworldIntent } from './overworldTypes'
import type { AdventureState, AdventureActions } from '../useAdventureSession'

interface OverworldModeProps {
  state: AdventureState
  actions: AdventureActions
}

export function OverworldMode({ state, actions }: OverworldModeProps) {
  const [dialogue, setDialogue] = useState<{ speaker: string } | null>(null)
  // Narration older than the dialogue is stale — only show responses
  // that arrive after it opened.
  const turnCountAtOpen = useRef(0)

  const isStreaming = state.narrationStatus === 'streaming'
  const busy = state.isActionInFlight || isStreaming
  const locked = !!dialogue || busy

  function onIntent(intent: OverworldIntent) {
    if (intent.type === 'interact') {
      turnCountAtOpen.current = state.turns.length
      setDialogue({ speaker: intent.entityName })
    }
    handleOverworldIntent(intent, actions)
  }

  const latestTurn = state.turns[state.turns.length - 1]
  const responseText = isStreaming
    ? state.streamingText
    : state.turns.length > turnCountAtOpen.current
      ? latestTurn?.aiNarration ?? ''
      : ''

  return (
    <div className="relative w-full h-full" data-testid="overworld-mode">
      <OverworldScene
        map={monasteryCourtyard}
        spawnId="start"
        character={state.character}
        locked={locked}
        onIntent={onIntent}
      />

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
