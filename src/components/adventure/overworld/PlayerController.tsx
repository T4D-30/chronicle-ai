/**
 * PlayerController — Presentation 3 (Playable Overworld)
 *
 * The movement hook: four-direction, grid-stepped, collision-checked,
 * lockable. Position/facing are PRESENTATION state (like scroll
 * position) — never persisted, never submitted; only exit intents
 * (OverworldScene) reach the controller.
 *
 * Movement rules:
 * - WASD + arrow keys; no diagonals (one direction per step).
 * - A step first turns the player to face the direction, then moves
 *   iff the target tile is walkable (isWalkable: bounds + tile +
 *   blocking entities). Blocked steps still turn — facing an NPC
 *   across a fence works.
 * - One step per STEP_MS; held keys repeat naturally through the
 *   browser's key-repeat gated by the step timer.
 * - `locked` (dialogue/transition/pause) freezes movement AND turning.
 * - The rendered step glides via a CSS transition; globals.css's
 *   reduced-motion rule zeroes all transition durations, so reduced
 *   motion gets instant stepping for free.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FACING_DELTA,
  isWalkable,
  type FacingDirection,
  type OverworldMap,
  type TileCoord,
} from './overworldTypes'

export const STEP_MS = 170

const KEY_TO_DIRECTION: Record<string, FacingDirection> = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
}

export function directionForKey(key: string): FacingDirection | null {
  return KEY_TO_DIRECTION[key] ?? null
}

interface UseOverworldPlayerOptions {
  map: OverworldMap
  spawnId: string
  locked: boolean
}

export function useOverworldPlayer({ map, spawnId, locked }: UseOverworldPlayerOptions) {
  const spawn = map.spawns.find((s) => s.id === spawnId) ?? map.spawns[0]
  const [pos, setPos] = useState<TileCoord>(spawn.pos)
  const [facing, setFacing] = useState<FacingDirection>(spawn.facing)
  const steppingUntil = useRef(0)

  // Re-spawn when the map (area transition) changes.
  useEffect(() => {
    setPos(spawn.pos)
    setFacing(spawn.facing)
    steppingUntil.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, spawnId])

  const tryMove = useCallback(
    (direction: FacingDirection): boolean => {
      if (locked) return false
      const now = Date.now()
      if (now < steppingUntil.current) return false

      setFacing(direction)
      const delta = FACING_DELTA[direction]
      const target = { x: pos.x + delta.x, y: pos.y + delta.y }
      if (!isWalkable(map, target)) return false

      steppingUntil.current = now + STEP_MS
      setPos(target)
      return true
    },
    [locked, map, pos],
  )

  return { pos, facing, tryMove, setPos, setFacing }
}
