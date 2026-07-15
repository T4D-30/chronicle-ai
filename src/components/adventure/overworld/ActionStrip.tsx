/**
 * ActionStrip — Unified Adventure Screen (Presentation 4, B3)
 *
 * The contextual Action Layer: a slim row of chips docked above the
 * Story HUD. It offers the faced entity's interaction verbs (Talk,
 * Inspect, Collect, Enter — the same grounded intents the keyboard
 * path emits), a standing Rest action, and Menu access to the pause
 * overlay. Pure presentation: every button calls back into
 * OverworldMode, which routes through the existing adapter /
 * actions.submitAction — the strip itself owns no game logic.
 *
 * Contextual rules: verbs render only while an entity is faced and
 * input isn't locked (mirroring the "press E" prompt); Rest is
 * disabled while busy; Menu is always available (Law 1 — same as Esc).
 */

import { Button } from '@/components/ui'
import { VERB_LABEL } from './InteractionLayer'
import type { InteractionVerb, OverworldEntity } from './overworldTypes'

interface ActionStripProps {
  /** The entity the player currently faces (null = none). */
  faced: OverworldEntity | null
  /** Scene input is locked (dialogue, transition, pause) — hide verbs. */
  locked: boolean
  /** An action is in flight or streaming — Rest and verbs disabled. */
  busy: boolean
  onVerb: (entity: OverworldEntity, verb: InteractionVerb) => void
  onRest: () => void
  onMenu: () => void
}

export function ActionStrip({ faced, locked, busy, onVerb, onRest, onMenu }: ActionStripProps) {
  const verbs = !locked && faced ? faced.interactions : []

  return (
    <div
      className="flex items-center gap-2 justify-end"
      data-testid="action-strip"
      role="toolbar"
      aria-label="Actions"
    >
      {verbs.map((verb) => (
        <Button
          key={verb}
          type="button"
          variant="suggested"
          size="sm"
          disabled={busy}
          onClick={() => onVerb(faced!, verb)}
          data-testid={`action-verb-${verb}`}
        >
          {VERB_LABEL[verb]} {faced!.name}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy || locked}
        onClick={onRest}
        data-testid="action-rest"
      >
        Rest
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onMenu}
        data-testid="action-menu-button"
        aria-haspopup="dialog"
      >
        Menu (Esc)
      </Button>
    </div>
  )
}
