/**
 * Overworld Model Tests — Presentation 3 (Playable Overworld)
 *
 * The typed model + fixture-map validity: legend decoding, collision
 * queries, and the Monastery Courtyard passing full validation.
 */
import { describe, it, expect } from 'vitest'
import {
  buildTiles,
  isWalkable,
  inBounds,
  entityAt,
  exitAt,
  validateMap,
  FACING_DELTA,
  type OverworldMap,
  type TileLegend,
} from '@/components/adventure/overworld/overworldTypes'
import { monasteryCourtyard } from '@/components/adventure/overworld/maps/monasteryCourtyard'

const LEGEND: TileLegend = {
  W: { kind: 'wall', walkable: false },
  '.': { kind: 'grass', walkable: true },
}

function tinyMap(): OverworldMap {
  return {
    id: 'tiny', name: 'Tiny', width: 3, height: 3,
    tiles: buildTiles(LEGEND, ['WWW', 'W.W', 'WWW']),
    spawns: [{ id: 'start', pos: { x: 1, y: 1 }, facing: 'up' }],
    entities: [],
    exits: [],
    encounters: [],
  }
}

describe('buildTiles — ASCII legend decoding', () => {
  it('decodes rows into typed tiles', () => {
    const tiles = buildTiles(LEGEND, ['W.', '.W'])
    expect(tiles[0][0]).toEqual({ kind: 'wall', walkable: false })
    expect(tiles[0][1]).toEqual({ kind: 'grass', walkable: true })
  })

  it('throws on unknown legend characters (fixture typos fail loudly)', () => {
    expect(() => buildTiles(LEGEND, ['WX'])).toThrow(/Unknown legend character "X"/)
  })
})

describe('collision queries', () => {
  it('walls and out-of-bounds are not walkable', () => {
    const map = tinyMap()
    expect(isWalkable(map, { x: 1, y: 1 })).toBe(true)
    expect(isWalkable(map, { x: 0, y: 0 })).toBe(false)
    expect(isWalkable(map, { x: -1, y: 1 })).toBe(false)
    expect(isWalkable(map, { x: 3, y: 1 })).toBe(false)
    expect(inBounds(map, { x: 2, y: 2 })).toBe(true)
    expect(inBounds(map, { x: 3, y: 2 })).toBe(false)
  })

  it('blocking entities make their tile unwalkable; non-blocking do not', () => {
    const map = tinyMap()
    map.entities.push({
      id: 'rock', kind: 'object', name: 'Rock', pos: { x: 1, y: 1 },
      glyph: '🪨', interactions: ['inspect'], intentText: { inspect: 'x' }, blocking: true,
    })
    expect(isWalkable(map, { x: 1, y: 1 })).toBe(false)
    map.entities[0].blocking = false
    expect(isWalkable(map, { x: 1, y: 1 })).toBe(true)
  })

  it('FACING_DELTA moves one tile in each cardinal direction only', () => {
    expect(FACING_DELTA.up).toEqual({ x: 0, y: -1 })
    expect(FACING_DELTA.down).toEqual({ x: 0, y: 1 })
    expect(FACING_DELTA.left).toEqual({ x: -1, y: 0 })
    expect(FACING_DELTA.right).toEqual({ x: 1, y: 0 })
    // no diagonals exist in the type
    expect(Object.keys(FACING_DELTA)).toHaveLength(4)
  })
})

describe('validateMap — fixture safety net', () => {
  it('flags dimension mismatches, out-of-bounds items, and missing intent text', () => {
    const broken = tinyMap()
    broken.height = 4 // rows no longer match
    broken.spawns.push({ id: 'bad', pos: { x: 9, y: 9 }, facing: 'up' })
    broken.exits.push({
      id: 'gate', pos: { x: 1, y: 1 }, to: 'x', spawn: 'y', label: 'Gate', intentText: '',
    })
    const errors = validateMap(broken)
    expect(errors.some((e) => e.includes('height'))).toBe(true)
    expect(errors.some((e) => e.includes('out of bounds'))).toBe(true)
    expect(errors.some((e) => e.includes('missing intent text'))).toBe(true)
  })
})

describe('Monastery Courtyard — the vertical-slice map is valid', () => {
  it('passes full validation with zero errors', () => {
    expect(validateMap(monasteryCourtyard)).toEqual([])
  })

  it('has the required content: spawn, monk, shrine, herb patch, forest gate', () => {
    expect(monasteryCourtyard.spawns.some((s) => s.id === 'start')).toBe(true)
    expect(entityAt(monasteryCourtyard, { x: 2, y: 5 })?.id).toBe('monk')
    expect(monasteryCourtyard.entities.map((e) => e.id).sort()).toEqual(
      ['herb-patch', 'monk', 'shrine'],
    )
    expect(exitAt(monasteryCourtyard, { x: 6, y: 0 })?.to).toBe('forest-path')
  })

  it('the player spawn and the tile in front of every entity are walkable (interactable)', () => {
    const spawn = monasteryCourtyard.spawns.find((s) => s.id === 'start')!
    expect(isWalkable(monasteryCourtyard, spawn.pos)).toBe(true)
    for (const entity of monasteryCourtyard.entities) {
      const approachable = Object.values(FACING_DELTA).some((d) =>
        isWalkable(monasteryCourtyard, { x: entity.pos.x + d.x, y: entity.pos.y + d.y }),
      )
      expect(approachable, `${entity.id} must be reachable`).toBe(true)
    }
  })

  it('every interaction has grounded intent text for the controller', () => {
    for (const entity of monasteryCourtyard.entities) {
      for (const verb of entity.interactions) {
        expect(entity.intentText[verb], `${entity.id}.${verb}`).toBeTruthy()
      }
    }
  })
})
