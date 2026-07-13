/**
 * OverworldScene — Presentation 3 (Playable Overworld)
 *
 * The composition root of the overworld presentation layer: fixture
 * map + camera viewport + tile grid + the real character's sprite,
 * with keyboard movement. Emits typed OverworldIntents upward via
 * `onIntent` — the ONLY way anything leaves this layer (the hub-side
 * adapter grounds them through the existing Adventure Controller).
 *
 * Reads real state (the character record drives the sprite via the
 * Character Presence derivations). Never mutates game state, never
 * touches Supabase, never bypasses the controller.
 *
 * `locked` freezes all input — dialogue mode, transitions, and the
 * pause menu set it (later milestones wire those).
 */

import { useEffect } from 'react'
import { TileMap, TILE_PX } from './TileMap'
import { CameraViewport } from './CameraViewport'
import { useOverworldPlayer, directionForKey } from './PlayerController'
import { PlayerSprite } from '../world/PlayerSprite'
import { bodyKindFor, weaponKindFor } from '../world/characterAppearance'
import type { OverworldIntent, OverworldMap } from './overworldTypes'
import type { CharacterRecord } from '@/lib/supabase'

interface OverworldSceneProps {
  map: OverworldMap
  spawnId: string
  character?: CharacterRecord | null
  locked?: boolean
  onIntent?: (intent: OverworldIntent) => void
}

export function OverworldScene({
  map,
  spawnId,
  character = null,
  locked = false,
  onIntent,
}: OverworldSceneProps) {
  void onIntent // interactions arrive in the next milestone
  const { pos, facing, tryMove } = useOverworldPlayer({ map, spawnId, locked })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (locked) return
      const direction = directionForKey(e.key)
      if (direction) {
        e.preventDefault()
        tryMove(direction)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [locked, tryMove])

  const spriteFacing = facing === 'left' ? 'left' : 'right'

  return (
    <div className="w-full h-full" data-testid="overworld-scene" data-map={map.id}>
      <CameraViewport map={map} focus={pos}>
        <TileMap map={map} />

        {/* The player — the real character's sprite, gliding tile to
            tile (transition zeroed under reduced motion → instant). */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: TILE_PX,
            height: TILE_PX * 1.35,
            transform: `translate(${pos.x * TILE_PX}px, ${(pos.y - 0.35) * TILE_PX}px)`,
            transition: 'transform 170ms linear',
            zIndex: 2,
          }}
          data-testid="overworld-player"
          data-x={pos.x}
          data-y={pos.y}
          data-facing={facing}
        >
          <PlayerSprite
            className="w-full h-full"
            body={bodyKindFor(character?.sheet.archetype)}
            weapon={weaponKindFor(character?.sheet.equipment)}
            archetype={character?.sheet.archetype ?? null}
            facing={spriteFacing}
          />
        </div>
      </CameraViewport>
    </div>
  )
}
