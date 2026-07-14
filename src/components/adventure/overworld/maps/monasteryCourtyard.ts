/**
 * Monastery Courtyard — Presentation 3 vertical-slice fixture map.
 *
 * EXPLICIT FIXTURE/CONTENT DATA: this map is handcrafted stage-set
 * content for proving the playable loop. It is never written into
 * campaign data, never invented into WorldState, and every
 * interaction's outcome is resolved by the existing Adventure
 * Controller via the grounded intent text below — the map only decides
 * what the player can WALK ON and ATTEMPT.
 */

import { buildTiles, type OverworldMap, type TileLegend } from '../overworldTypes'

const LEGEND: TileLegend = {
  W: { kind: 'wall',  walkable: false },
  T: { kind: 'tree',  walkable: false },
  '.': { kind: 'grass', walkable: true },
  p: { kind: 'path',  walkable: true },
  s: { kind: 'stone', walkable: true },
}

/* 14 × 10 — the gate sits on the top wall (walkable path tile). */
const ROWS = [
  'WWWWWWpWWWWWWW',
  'W....ppp.....W',
  'W.T..ppp..T..W',
  'W....ppp.....W',
  'W..s.ppp..s..W',
  'W....ppp.....W',
  'W....ppp.....W',
  'W.T..ppp..T..W',
  'W....ppp.....W',
  'WWWWWWWWWWWWWW',
]

export const monasteryCourtyard: OverworldMap = {
  id: 'monastery-courtyard',
  name: 'Monastery Courtyard',
  width: 14,
  height: 10,
  tiles: buildTiles(LEGEND, ROWS),

  spawns: [
    { id: 'start', pos: { x: 7, y: 8 }, facing: 'up' },
    { id: 'from-forest', pos: { x: 6, y: 1 }, facing: 'down' },
  ],

  entities: [
    {
      id: 'monk',
      kind: 'npc',
      name: 'Brother Aldwin',
      pos: { x: 2, y: 5 },
      glyph: '🧑‍🦲',
      interactions: ['talk'],
      intentText: {
        talk: 'I approach the monk in the courtyard and greet him.',
      },
      blocking: true,
    },
    {
      id: 'shrine',
      kind: 'object',
      name: 'Old Shrine',
      pos: { x: 3, y: 4 },
      glyph: '⛩️',
      interactions: ['inspect'],
      intentText: {
        inspect: 'I examine the old shrine in the courtyard closely.',
      },
      blocking: true,
    },
    {
      id: 'herb-patch',
      kind: 'object',
      name: 'Herb Patch',
      pos: { x: 10, y: 4 },
      glyph: '🌿',
      // collect first — the primary verb the interact key fires
      interactions: ['collect', 'inspect'],
      intentText: {
        inspect: 'I look over the herb patch growing by the courtyard stones.',
        collect: 'I try to gather some herbs from the herb patch.',
      },
      blocking: true,
    },
  ],

  exits: [
    {
      id: 'forest-gate',
      pos: { x: 6, y: 0 },
      to: 'forest-path',
      spawn: 'from-courtyard',
      label: 'Forest Gate',
      intentText: 'I pass through the forest gate and follow the path into the woods.',
    },
  ],

  encounters: [],
}
