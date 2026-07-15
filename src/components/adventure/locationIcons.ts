/**
 * locationIcons — Phase 15.2
 *
 * Extracted from AtlasPanel.tsx (Phase 6), which defined these maps
 * locally, so later location-labeled UI could share the same
 * per-LocationType glyphs — one source of truth instead of a second,
 * drifting copy.
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
