/**
 * Fixture-map registry — Presentation 3 vertical slice.
 */

import { monasteryCourtyard } from './monasteryCourtyard'
import { forestPath } from './forestPath'
import type { OverworldMap } from '../overworldTypes'

export const OVERWORLD_MAPS: Record<string, OverworldMap> = {
  [monasteryCourtyard.id]: monasteryCourtyard,
  [forestPath.id]: forestPath,
}

export { monasteryCourtyard, forestPath }
