/**
 * InteractionLayer — Presentation 3 (Playable Overworld)
 *
 * The "press E" affordance: when the player faces an interactable
 * entity, a small prompt chip floats above it naming the primary verb.
 * Pure presentation — the keypress itself is handled by OverworldScene,
 * which emits the typed intent.
 */

import { TILE_PX } from './TileMap'
import type { OverworldEntity, InteractionVerb } from './overworldTypes'

const VERB_LABEL: Record<InteractionVerb, string> = {
  talk: 'Talk',
  inspect: 'Inspect',
  collect: 'Collect',
  enter: 'Enter',
}

export function primaryVerb(entity: OverworldEntity): InteractionVerb | null {
  return entity.interactions[0] ?? null
}

export function InteractionLayer({ faced }: { faced: OverworldEntity | null }) {
  if (!faced) return null
  const verb = primaryVerb(faced)
  if (!verb) return null

  return (
    <div
      className="absolute pointer-events-none menu-enter"
      style={{
        left: faced.pos.x * TILE_PX + TILE_PX / 2,
        top: faced.pos.y * TILE_PX - 14,
        transform: 'translateX(-50%)',
        zIndex: 3,
      }}
      data-testid="interaction-prompt"
    >
      <span className="chr-panel px-1.5 py-0.5 rounded font-pixel-body text-sm text-arcane-300 whitespace-nowrap">
        ⏎ {VERB_LABEL[verb]}
      </span>
    </div>
  )
}
