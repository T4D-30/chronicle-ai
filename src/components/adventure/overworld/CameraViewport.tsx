/**
 * CameraViewport — Presentation 3 (Playable Overworld)
 *
 * Player-centered scrolling viewport, clamped to map bounds. The
 * viewport fills whatever container it's given (the overworld mode
 * makes the world the primary visual area); the world plane translates
 * so the player stays centered until the camera hits a map edge.
 * Camera glide is a CSS transition — zeroed under reduced motion by
 * globals.css's universal rule, so reduced-motion players get an
 * instant camera.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TILE_PX } from './TileMap'
import type { OverworldMap, TileCoord } from './overworldTypes'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

interface CameraViewportProps {
  map: OverworldMap
  /** Player tile position — the camera target. */
  focus: TileCoord
  children: ReactNode
}

export function CameraViewport({ map, focus, children }: CameraViewportProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const measure = () => setFrame({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const worldW = map.width * TILE_PX
  const worldH = map.height * TILE_PX
  const focusPx = { x: focus.x * TILE_PX + TILE_PX / 2, y: focus.y * TILE_PX + TILE_PX / 2 }

  // Center on the player; clamp to bounds; center small maps in the frame.
  const offsetX = worldW <= frame.width
    ? (frame.width - worldW) / 2
    : -clamp(focusPx.x - frame.width / 2, 0, worldW - frame.width)
  const offsetY = worldH <= frame.height
    ? (frame.height - worldH) / 2
    : -clamp(focusPx.y - frame.height / 2, 0, worldH - frame.height)

  return (
    <div
      ref={frameRef}
      className="relative w-full h-full overflow-hidden bg-void-950"
      data-testid="overworld-viewport"
    >
      <div
        className="absolute"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          transition: 'transform 170ms linear',
          width: worldW,
          height: worldH,
        }}
        data-testid="overworld-camera"
      >
        {children}
      </div>
    </div>
  )
}
