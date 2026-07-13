/**
 * TileMap — Presentation 3 (Playable Overworld)
 *
 * Pure renderer for a fixture map's tile grid and entities. No state,
 * no input, no intents — just tiles as pixel-styled divs and entity
 * glyphs at their coordinates. Visuals derive from TileKind; collision
 * comes from the typed model, never from looks.
 */

import type { OverworldMap, OverworldTile } from './overworldTypes'

export const TILE_PX = 36

/** Palette-token tile fills (flat, pixel-simple). */
const TILE_STYLE: Record<OverworldTile['kind'], { background: string; boxShadow?: string }> = {
  grass: { background: '#14261a', boxShadow: 'inset 0 0 0 1px rgba(15, 29, 20, 0.8)' },
  path:  { background: '#3a2b20', boxShadow: 'inset 0 0 0 1px rgba(36, 24, 16, 0.8)' },
  stone: { background: '#322c28', boxShadow: 'inset 0 0 0 1px rgba(23, 21, 24, 0.8)' },
  wall:  { background: '#171518', boxShadow: 'inset 0 -3px 0 0 #0a0a0f, inset 0 1px 0 0 rgba(226,181,98,0.06)' },
  tree:  { background: '#0f1d14', boxShadow: 'inset 0 0 0 2px #0b160f' },
  water: { background: '#1a4a49', boxShadow: 'inset 0 0 0 1px #092c2d' },
  floor: { background: '#241a16', boxShadow: 'inset 0 0 0 1px #170f0b' },
}

const TREE_GLYPH = '🌲'

export function TileMap({ map }: { map: OverworldMap }) {
  return (
    <div
      className="relative pixel-crisp"
      style={{ width: map.width * TILE_PX, height: map.height * TILE_PX }}
      data-testid="overworld-tilemap"
    >
      {/* Tiles */}
      {map.tiles.map((row, y) =>
        row.map((tile, x) => (
          <div
            key={`${x}-${y}`}
            className="absolute"
            style={{
              left: x * TILE_PX,
              top: y * TILE_PX,
              width: TILE_PX,
              height: TILE_PX,
              ...TILE_STYLE[tile.kind],
            }}
            data-tile={tile.kind}
          >
            {tile.kind === 'tree' && (
              <span
                className="absolute inset-0 flex items-end justify-center text-xl leading-none"
                aria-hidden="true"
              >
                {TREE_GLYPH}
              </span>
            )}
          </div>
        )),
      )}

      {/* Entities */}
      {map.entities.map((entity) => (
        <div
          key={entity.id}
          className="absolute flex items-end justify-center text-2xl leading-none"
          style={{
            left: entity.pos.x * TILE_PX,
            top: entity.pos.y * TILE_PX,
            width: TILE_PX,
            height: TILE_PX,
          }}
          aria-hidden="true"
          data-testid={`overworld-entity-${entity.id}`}
        >
          {entity.glyph}
        </div>
      ))}

      {/* Exit markers — a subtle glow on exit tiles */}
      {map.exits.map((exit) => (
        <div
          key={exit.id}
          className="absolute torch-flicker"
          style={{
            left: exit.pos.x * TILE_PX,
            top: exit.pos.y * TILE_PX,
            width: TILE_PX,
            height: TILE_PX,
            background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(232, 167, 74, 0.25), transparent 75%)',
          }}
          aria-hidden="true"
          data-testid={`overworld-exit-${exit.id}`}
        />
      ))}
    </div>
  )
}
