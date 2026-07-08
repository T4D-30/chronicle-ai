/**
 * locationIcons — Phase 15.2
 *
 * Extracted from AtlasPanel.tsx (Phase 6), which defined these maps
 * locally. AdventureScenePanel's redesign (Phase 15.2) needs the same
 * per-LocationType glyph for its "biome icon" — sharing this module keeps
 * one source of truth instead of a second, drifting copy.
 */

import type { LocationType } from '@/types/campaign'

export const LOCATION_ICON: Record<LocationType, string> = {
  region:   '🗺',
  town:     '🏘',
  dungeon:  '🏰',
  building: '🏛',
  floor:    '⬛',
  room:     '🚪',
  outdoor:  '🌲',
}

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  region:   'Region',
  town:     'Town',
  dungeon:  'Dungeon',
  building: 'Building',
  floor:    'Floor',
  room:     'Room',
  outdoor:  'Outdoor',
}
