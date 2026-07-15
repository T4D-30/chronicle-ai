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

import { useEffect, useRef } from 'react'
import { TileMap, TILE_PX } from './TileMap'
import { CameraViewport } from './CameraViewport'
import { useOverworldPlayer, directionForKey } from './PlayerController'
import { NpcEntity, ObjectEntity } from './NpcEntity'
import { InteractionLayer, primaryVerb } from './InteractionLayer'
import { PlayerSprite } from '../world/PlayerSprite'
import { bodyKindFor, weaponKindFor } from '../world/characterAppearance'
import { FACING_DELTA, entityAt, exitAt, encounterAt } from './overworldTypes'
import type {
  FacingDirection,
  OverworldEntity,
  OverworldIntent,
  OverworldMap,
  TileCoord,
} from './overworldTypes'
import type { CharacterRecord } from '@/lib/supabase'

const INTERACT_KEYS = new Set(['e', 'E', 'Enter', ' '])

interface OverworldSceneProps {
  map: OverworldMap
  spawnId: string
  character?: CharacterRecord | null
  locked?: boolean
  onIntent?: (intent: OverworldIntent) => void
  initialPosition?: TileCoord
  initialFacing?: FacingDirection
  initialZoneKey?: string | null
  onPlayerStateChange?: (state: { pos: TileCoord; facing: FacingDirection }) => void
  /** Reports the entity the player currently faces (or null) so the
   *  hub-side Action Layer can offer its verbs as buttons (B3). */
  onFacedChange?: (entity: OverworldEntity | null) => void
}

export function OverworldScene({
  map,
  spawnId,
  character = null,
  locked = false,
  onIntent,
  initialPosition,
  initialFacing,
  initialZoneKey = null,
  onPlayerStateChange,
  onFacedChange,
}: OverworldSceneProps) {
  const { pos, facing, tryMove } = useOverworldPlayer({
    map,
    spawnId,
    locked,
    initialPosition,
    initialFacing,
  })

  // The entity the player currently faces (adjacent tile in facing dir).
  const facedPos = { x: pos.x + FACING_DELTA[facing].x, y: pos.y + FACING_DELTA[facing].y }
  const faced = entityAt(map, facedPos)

  // Standing on an exit or encounter tile emits its intent — once per
  // arrival (leaving and re-entering re-arms it).
  const lastZoneKey = useRef<string | null>(initialZoneKey)
  useEffect(() => {
    onPlayerStateChange?.({ pos, facing })
  }, [pos, facing, onPlayerStateChange])

  // `faced` identity is stable per entity (entityAt returns the map's
  // own entity objects), so this fires only when the faced target
  // actually changes.
  useEffect(() => {
    onFacedChange?.(faced)
  }, [faced, onFacedChange])

  useEffect(() => {
    const exit = exitAt(map, pos)
    const encounter = encounterAt(map, pos)
    const zoneKey = exit ? `exit:${exit.id}` : encounter ? `enc:${encounter.id}` : null
    if (zoneKey === lastZoneKey.current) return
    lastZoneKey.current = zoneKey
    if (exit) {
      onIntent?.({ type: 'exit', exitId: exit.id, to: exit.to, spawn: exit.spawn, text: exit.intentText })
    } else if (encounter) {
      onIntent?.({ type: 'encounter', triggerId: encounter.id, label: encounter.label })
    }
  }, [map, pos, facing, onIntent])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (locked) return
      // Keys aimed at UI controls must never reach the world: typing in
      // the Story HUD's free input (present while movement is free)
      // must not move the player, and Enter/Space activating a focused
      // button (e.g. an ActionStrip verb) must not ALSO fire the
      // keyboard interact path — that would double-submit the action.
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return
      }
      const direction = directionForKey(e.key)
      if (direction) {
        e.preventDefault()
        tryMove(direction)
        return
      }
      if (INTERACT_KEYS.has(e.key) && faced) {
        const verb = primaryVerb(faced)
        const text = verb ? faced.intentText[verb] : undefined
        if (verb && text) {
          e.preventDefault()
          onIntent?.({
            type: 'interact',
            verb,
            entityId: faced.id,
            entityName: faced.name,
            text,
          })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [locked, tryMove, faced, onIntent])

  const spriteFacing = facing === 'left' ? 'left' : 'right'

  return (
    <div className="w-full h-full" data-testid="overworld-scene" data-map={map.id}>
      <CameraViewport map={map} focus={pos}>
        <TileMap map={map} />

        {/* Entities with faced-highlight */}
        {map.entities.map((entity) =>
          entity.kind === 'npc' ? (
            <NpcEntity key={entity.id} entity={entity} faced={faced?.id === entity.id} />
          ) : (
            <ObjectEntity key={entity.id} entity={entity} faced={faced?.id === entity.id} />
          ),
        )}

        {/* "Press E" affordance above the faced entity */}
        <InteractionLayer faced={locked ? null : faced} />

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
