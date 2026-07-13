/**
 * Forest Path — Presentation 3 vertical-slice fixture map (the second,
 * minimal area proving transitions). Explicit fixture/content data —
 * see monasteryCourtyard.ts. Holds the slice's single encounter
 * trigger; the ambush resolves through the EXISTING combat mode.
 */

import { buildTiles, type OverworldMap, type TileLegend } from '../overworldTypes'

const LEGEND: TileLegend = {
  T: { kind: 'tree',  walkable: false },
  '.': { kind: 'grass', walkable: true },
  p: { kind: 'path',  walkable: true },
}

/* 10 × 12 — a winding trail; the courtyard gate is at the bottom. */
const ROWS = [
  'TTTTTTTTTT',
  'T..ppp...T',
  'T..p.....T',
  'T..ppp...T',
  'T....p...T',
  'T....p...T',
  'T..ppp...T',
  'T..p.....T',
  'T..ppp...T',
  'T....p...T',
  'T....p...T',
  'TTTTTpTTTT',
]

export const forestPath: OverworldMap = {
  id: 'forest-path',
  name: 'Forest Path',
  width: 10,
  height: 12,
  tiles: buildTiles(LEGEND, ROWS),

  spawns: [
    { id: 'from-courtyard', pos: { x: 5, y: 10 }, facing: 'up' },
  ],

  entities: [],

  exits: [
    {
      id: 'courtyard-gate',
      pos: { x: 5, y: 11 },
      to: 'monastery-courtyard',
      spawn: 'from-forest',
      label: 'Monastery Gate',
      intentText: 'I head back through the gate into the monastery courtyard.',
    },
  ],

  encounters: [
    { id: 'forest-ambush', pos: { x: 3, y: 3 }, label: 'Something stirs in the undergrowth' },
  ],
}
