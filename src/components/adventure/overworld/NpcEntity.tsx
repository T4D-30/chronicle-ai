/**
 * NpcEntity / ObjectEntity — Presentation 3 (Playable Overworld)
 *
 * Pure entity renderers: a glyph on its tile, with a subtle highlight
 * when the player faces it (interactable affordance). NPCs and objects
 * share mechanics; they differ only in styling emphasis — split
 * components keep the seam where future sprite art (portraits slot)
 * lands per kind.
 */

import { TILE_PX } from './TileMap'
import type { OverworldEntity } from './overworldTypes'

interface EntityProps {
  entity: OverworldEntity
  /** True when the player stands adjacent, facing this entity. */
  faced: boolean
}

function EntityBase({ entity, faced }: EntityProps) {
  return (
    <div
      className="absolute flex items-end justify-center text-2xl leading-none"
      style={{
        left: entity.pos.x * TILE_PX,
        top: entity.pos.y * TILE_PX,
        width: TILE_PX,
        height: TILE_PX,
        filter: faced ? 'brightness(1.35) drop-shadow(0 0 6px rgba(232, 167, 74, 0.55))' : undefined,
      }}
      aria-hidden="true"
      data-testid={`overworld-entity-${entity.id}`}
      data-faced={faced || undefined}
    >
      {entity.glyph}
    </div>
  )
}

export function NpcEntity(props: EntityProps) {
  return <EntityBase {...props} />
}

export function ObjectEntity(props: EntityProps) {
  return <EntityBase {...props} />
}
