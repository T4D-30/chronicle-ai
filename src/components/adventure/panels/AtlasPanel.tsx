/**
 * AtlasPanel — Phase 6
 *
 * Displays WorldState.locations as a searchable, navigable list with detail view.
 * No map canvas, no fog of war, no AI image generation.
 *
 * Layout:
 *   • Empty state when no locations discovered
 *   • Search input + type-filter pills
 *   • Location list grouped by type in discovery hierarchy order
 *   • Visited/discovered badges; Director property chips; NPC count
 *   • Click any location card → detail view with breadcrumb nav
 *   • Detail: collapsible sections — description, lore, items, NPCs,
 *     property chips, child locations (native details/summary, default open)
 *
 * Keyboard accessibility:
 *   • All interactive elements reachable and operable via keyboard
 *   • filter pills use aria-pressed
 *   • Location cards are <button> with aria-label
 *   • Detail back button has explicit aria-label
 *   • Breadcrumb crumbs that are navigable use role=button
 *   • Search input has aria-label
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui'
import type { Campaign } from '@/lib/supabase'
import type { LocationState, LocationType, NpcWorldState } from '@/types/campaign'

// ─── Type metadata ────────────────────────────────────────────────────────────

const LOCATION_ICON: Record<LocationType, string> = {
  region:   '🗺',
  town:     '🏘',
  dungeon:  '🏰',
  building: '🏛',
  floor:    '⬛',
  room:     '🚪',
  outdoor:  '🌲',
}

const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  region:   'Region',
  town:     'Town',
  dungeon:  'Dungeon',
  building: 'Building',
  floor:    'Floor',
  room:     'Room',
  outdoor:  'Outdoor',
}

const TYPE_ORDER: LocationType[] = [
  'region', 'outdoor', 'town', 'dungeon', 'building', 'floor', 'room',
]

// ─── Component ────────────────────────────────────────────────────────────────

interface AtlasPanelProps {
  campaign: Campaign
}

export function AtlasPanel({ campaign }: AtlasPanelProps) {
  const { locations, npcs } = campaign.worldState
  const [selected, setSelected]     = useState<LocationState | null>(null)
  const [typeFilter, setTypeFilter] = useState<LocationType | null>(null)
  const [query, setQuery]           = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Only discovered locations are visible (player layer — Constitution Law 4)
  const discovered = useMemo(
    () => locations.filter((l) => l.discovered),
    [locations],
  )

  // Search: match name, description, or type label case-insensitively
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return discovered
    return discovered.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        LOCATION_TYPE_LABEL[l.type].toLowerCase().includes(q),
    )
  }, [discovered, query])

  // Type filter applied after search
  const filtered = useMemo(() => {
    if (!typeFilter) return searched
    return searched.filter((l) => l.type === typeFilter)
  }, [searched, typeFilter])

  // Group by type in hierarchy order
  const grouped = useMemo(() => {
    const map = new Map<LocationType, LocationState[]>()
    for (const type of TYPE_ORDER) {
      const group = filtered.filter((l) => l.type === type)
      if (group.length > 0) map.set(type, group)
    }
    return map
  }, [filtered])

  // Types present in the discovered set — for filter pills
  const presentTypes = useMemo(
    () => TYPE_ORDER.filter((t) => discovered.some((l) => l.type === t)),
    [discovered],
  )

  // Clear search when navigating into a detail
  function openDetail(loc: LocationState) {
    setSelected(loc)
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (discovered.length === 0) {
    return (
      <div
        className="flex flex-col h-full items-center justify-center p-6 text-center"
        data-testid="atlas-empty"
        role="region"
        aria-label="Atlas — no locations discovered"
      >
        <div className="chr-panel-arcane p-6 rounded-lg max-w-sm">
          <p className="stat-label text-arcane-400 mb-3">ATLAS</p>
          <p className="lore-text text-void-300 text-sm mb-4">
            "The world remembers where you've been."
          </p>
          <div className="chr-divider mb-4" />
          <p className="text-void-500 text-xs">
            Locations appear here as the Director reveals them during play.
            Explore the world to fill this map.
          </p>
          {locations.length > 0 && (
            <p className="text-void-700 text-xs mt-2 italic">
              {locations.length} location{locations.length !== 1 ? 's' : ''} exist — none discovered yet.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Detail view ──────────────────────────────────────────────────────────

  if (selected) {
    return (
      <LocationDetail
        key={selected.id}
        location={selected}
        allLocations={locations}
        npcs={npcs}
        onBack={() => setSelected(null)}
        onNavigateTo={openDetail}
      />
    )
  }

  // ── Location list ────────────────────────────────────────────────────────

  const noResults = filtered.length === 0
  const hasActiveFilter = !!query.trim() || !!typeFilter

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      data-testid="atlas-list"
      role="region"
      aria-label="Atlas — location list"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="stat-label text-arcane-400">
            ATLAS — {discovered.length} Location{discovered.length !== 1 ? 's' : ''}
          </p>
          {campaign.worldState.worldTime && (
            <span className="text-void-500 text-xs italic" aria-label={`World time: ${campaign.worldState.worldTime}`}>
              {campaign.worldState.worldTime}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search locations…"
            aria-label="Search locations"
            className="w-full px-3 py-1.5 pl-8 rounded-lg bg-void-900 border border-void-700 text-sm text-white placeholder:text-void-600 focus:outline-none focus:ring-2 focus:ring-arcane-400"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-void-600 text-xs pointer-events-none" aria-hidden>
            🔍
          </span>
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); searchRef.current?.focus() }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-void-500 hover:text-void-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded"
            >
              ✕
            </button>
          )}
        </div>

        {/* Type filter pills */}
        {presentTypes.length > 1 && (
          <div
            className="flex gap-1.5 flex-wrap"
            role="group"
            aria-label="Filter by location type"
          >
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              aria-pressed={!typeFilter}
              className={[
                'px-2 py-0.5 rounded-full text-xs border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                !typeFilter
                  ? 'bg-arcane-900/50 border-arcane-600 text-arcane-300'
                  : 'bg-void-900 border-void-700/50 text-void-500 hover:text-void-300',
              ].join(' ')}
            >
              All
            </button>
            {presentTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                aria-pressed={typeFilter === type}
                className={[
                  'px-2 py-0.5 rounded-full text-xs border transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                  typeFilter === type
                    ? 'bg-arcane-900/50 border-arcane-600 text-arcane-300'
                    : 'bg-void-900 border-void-700/50 text-void-500 hover:text-void-300',
                ].join(' ')}
              >
                {LOCATION_ICON[type]} {LOCATION_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 flex flex-col gap-4">
        {noResults ? (
          <p
            className="text-void-600 text-sm text-center pt-6"
            role="status"
            aria-live="polite"
          >
            {hasActiveFilter
              ? 'No locations match your search.'
              : 'No locations to display.'}
          </p>
        ) : (
          Array.from(grouped.entries()).map(([type, locs]) => (
            <div key={type} role="group" aria-label={`${LOCATION_TYPE_LABEL[type]} locations`}>
              <p className="stat-label text-void-600 mb-2" aria-hidden>
                {LOCATION_ICON[type]} {LOCATION_TYPE_LABEL[type]}s
              </p>
              <div className="flex flex-col gap-2">
                {locs.map((loc) => (
                  <LocationCard
                    key={loc.id}
                    location={loc}
                    npcCount={npcs.filter((n) => n.locationId === loc.id && n.isAlive).length}
                    onClick={() => openDetail(loc)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── LocationCard ─────────────────────────────────────────────────────────────

function LocationCard({
  location,
  npcCount,
  onClick,
}: {
  location: LocationState
  npcCount: number
  onClick: () => void
}) {
  const statusParts: string[] = []
  if (location.visited) statusParts.push('visited')
  if (location.properties['cleared'] === true) statusParts.push('cleared')
  if (location.properties['alertLevel'] === 'high') statusParts.push('alert')
  if (npcCount > 0) statusParts.push(`${npcCount} NPC${npcCount !== 1 ? 's' : ''} present`)
  const ariaLabel = `${location.name}, ${LOCATION_TYPE_LABEL[location.type]}${statusParts.length ? `, ${statusParts.join(', ')}` : ''}`

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`location-card-${location.id}`}
      aria-label={ariaLabel}
      className={[
        'pixel-border w-full text-left px-3 py-2.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
        location.visited
          ? 'bg-void-900 border-void-700/50 hover:border-arcane-700/50'
          : 'bg-void-900/60 border-void-700/30 hover:border-void-600/50',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none flex-shrink-0 mt-0.5" aria-hidden>
          {LOCATION_ICON[location.type]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-body font-semibold text-sm ${location.visited ? 'text-white' : 'text-void-400'}`}>
              {location.name}
            </span>
            {location.visited && <Badge variant="spirit">Visited</Badge>}
            {location.properties['cleared'] === true && <Badge variant="neutral">Cleared</Badge>}
            {location.properties['alertLevel'] === 'high' && <Badge variant="harm">Alert</Badge>}
          </div>
          {location.description && (
            <p className="text-void-500 text-xs mt-0.5 line-clamp-1">{location.description}</p>
          )}
          {npcCount > 0 && (
            <p className="text-arcane-500 text-xs mt-0.5">
              {npcCount} NPC{npcCount !== 1 ? 's' : ''} present
            </p>
          )}
        </div>
        <span className="text-void-600 text-xs flex-shrink-0" aria-hidden>›</span>
      </div>
    </button>
  )
}

// ─── LocationDetail ───────────────────────────────────────────────────────────

function LocationDetail({
  location,
  allLocations,
  npcs,
  onBack,
  onNavigateTo,
}: {
  location: LocationState
  allLocations: LocationState[]
  npcs: NpcWorldState[]
  onBack: () => void
  onNavigateTo: (loc: LocationState) => void
}) {
  // Auto-focus the detail region for screen readers
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [location.id])

  // Breadcrumb: root → … → parent → this location
  const breadcrumb = useMemo(() => {
    const crumbs: LocationState[] = [location]
    let current = location
    let guard = 0
    while (current.parentId && guard < 8) {
      const parent = allLocations.find((l) => l.id === current.parentId)
      if (!parent) break
      crumbs.unshift(parent)
      current = parent
      guard++
    }
    return crumbs
  }, [location, allLocations])

  // Children: discovered sub-locations
  const children = useMemo(
    () => allLocations.filter((l) => l.parentId === location.id && l.discovered),
    [allLocations, location.id],
  )

  // NPCs at this location (all — alive and deceased)
  const locationNpcs = useMemo(
    () => npcs.filter((n) => n.locationId === location.id),
    [npcs, location.id],
  )

  // Director property chips — skip null/undefined
  const properties = useMemo(
    () => Object.entries(location.properties).filter(([, v]) => v !== null && v !== undefined),
    [location.properties],
  )

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      data-testid="location-detail"
      role="region"
      aria-label={`Location detail: ${location.name}`}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-void-700/50">
        {/* Breadcrumb */}
        {breadcrumb.length > 1 && (
          <nav aria-label="Location breadcrumb" className="mb-2">
            <ol className="flex items-center gap-1 flex-wrap list-none p-0 m-0">
              {breadcrumb.map((crumb, i) => {
                const isCurrent = crumb.id === location.id
                const isNavigable = !isCurrent && crumb.id !== location.id
                return (
                  <li key={crumb.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-void-700" aria-hidden>›</span>}
                    {isNavigable ? (
                      <button
                        type="button"
                        onClick={() => onNavigateTo(crumb)}
                        className={[
                          'text-xs text-void-500 hover:text-arcane-300 transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded',
                        ].join(' ')}
                        aria-label={`Navigate to ${crumb.name}`}
                      >
                        {crumb.name}
                      </button>
                    ) : (
                      <span
                        className="text-xs text-void-300"
                        aria-current={isCurrent ? 'page' : undefined}
                      >
                        {crumb.name}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl" aria-hidden>{LOCATION_ICON[location.type]}</span>
            <div className="min-w-0">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-lg text-white leading-tight focus:outline-none"
              >
                {location.name}
              </h2>
              <p className="text-void-500 text-xs capitalize">{LOCATION_TYPE_LABEL[location.type]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to atlas"
            className={[
              'flex-shrink-0 text-void-500 hover:text-arcane-300 text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded',
            ].join(' ')}
          >
            ← Atlas
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {location.visited && <Badge variant="spirit">Visited</Badge>}
          {!location.visited && location.discovered && <Badge variant="neutral">Discovered</Badge>}
          {location.properties['cleared'] === true && <Badge variant="neutral">Cleared</Badge>}
          {location.properties['alertLevel'] === 'high' && <Badge variant="harm">Alert: High</Badge>}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Description */}
        <details open>
          <summary className="stat-label mb-2 cursor-pointer select-none">Description</summary>
          <section aria-label="Description" className="pt-1">
            {location.description ? (
              <p className="lore-text text-sm text-void-300 leading-relaxed">
                {location.description}
              </p>
            ) : (
              <p className="text-void-600 text-sm italic">No description recorded.</p>
            )}
          </section>
        </details>

        {/* Lore */}
        <details open>
          <summary className="stat-label mb-2 cursor-pointer select-none">Lore</summary>
          <section aria-label="Lore" className="pt-1">
            {location.lore ? (
              <p className="lore-text text-sm text-void-300 leading-relaxed">
                {location.lore}
              </p>
            ) : (
              <p className="text-void-600 text-sm italic">No lore recorded yet.</p>
            )}
          </section>
        </details>

        {/* Items */}
        {location.items && location.items.length > 0 && (
          <details open>
            <summary className="stat-label mb-2 cursor-pointer select-none">Items Here</summary>
            <section aria-label="Items at this location" className="pt-1">
              <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                {location.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col px-3 py-2 rounded-lg bg-void-900 border border-void-700/50"
                  >
                    <span className="font-body text-sm text-void-200">{item.name}</span>
                    {item.description && (
                      <span className="text-void-500 text-xs mt-0.5">{item.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </details>
        )}

        {/* NPCs */}
        {locationNpcs.length > 0 && (
          <details open>
            <summary className="stat-label mb-2 cursor-pointer select-none">NPCs Here</summary>
            <section aria-label="NPCs at this location" className="pt-1">
              <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                {locationNpcs.map((npc) => (
                  <li
                    key={npc.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-void-900 border border-void-700/50"
                  >
                    <span
                      className={`font-body text-sm ${npc.isAlive ? 'text-void-200' : 'text-void-600 line-through'}`}
                      aria-label={`${npc.name} — ${npc.isAlive ? 'alive' : 'deceased'}`}
                    >
                      {npc.name}
                    </span>
                    <Badge variant={npc.isAlive ? 'neutral' : 'harm'}>
                      {npc.isAlive ? 'Alive' : 'Deceased'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          </details>
        )}

        {/* Director property chips */}
        {properties.length > 0 && (
          <details open>
            <summary className="stat-label mb-2 cursor-pointer select-none">Known Properties</summary>
            <section aria-label="Known properties" className="pt-1">
              <div className="flex flex-wrap gap-2">
                {properties.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-void-900 border border-void-700/50 text-xs"
                    title={`${key}: ${value}`}
                  >
                    <span className="text-void-500 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                    </span>
                    <span
                      className={`font-mono ${
                        value === true  ? 'text-heal-400' :
                        value === false ? 'text-harm-400' :
                        'text-arcane-300'
                      }`}
                    >
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </details>
        )}

        {/* Child locations */}
        {children.length > 0 && (
          <details open>
            <summary className="stat-label mb-2 cursor-pointer select-none">Sub-locations</summary>
            <section aria-label="Sub-locations" className="pt-1">
              <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                {children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => onNavigateTo(child)}
                      aria-label={`Navigate to ${child.name}, ${LOCATION_TYPE_LABEL[child.type]}`}
                      className={[
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                        'bg-void-900 border border-void-700/50 hover:border-arcane-700/40 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                      ].join(' ')}
                    >
                      <span aria-hidden>{LOCATION_ICON[child.type]}</span>
                      <span className="text-void-300 text-sm flex-1 text-left">{child.name}</span>
                      <span className="text-void-600 text-xs capitalize">{child.type}</span>
                      {child.visited && <Badge variant="spirit">Visited</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </details>
        )}

      </div>
    </div>
  )
}
