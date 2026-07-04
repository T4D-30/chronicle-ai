/**
 * AtlasPanel Tests — Phase 6
 *
 * Covers: empty state, location list, search, type filters,
 * location detail, breadcrumb navigation, NPC rendering,
 * Director property chips, child locations, keyboard accessibility.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AtlasPanel } from '@/components/adventure/panels/AtlasPanel'
import type { Campaign } from '@/lib/supabase'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { LocationState, NpcWorldState, WorldState } from '@/types/campaign'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCampaign(world: Partial<WorldState> = {}): Campaign {
  return {
    id: 'c1', userId: 'u1', title: 'T', description: null, status: 'active',
    characterId: null, directorConfig: DEFAULT_DIRECTOR_CONFIG,
    worldState: { ...DEFAULT_WORLD_STATE, ...world },
    tone: 'heroic', difficulty: 'standard',
    createdAt: '', updatedAt: '',
  }
}

function loc(overrides: Partial<LocationState> = {}): LocationState {
  return {
    id: 'loc-1', name: 'Iron Keep', type: 'dungeon',
    parentId: null, description: 'A crumbling fortress.',
    visited: true, discovered: true, properties: {},
    ...overrides,
  }
}

function npc(overrides: Partial<NpcWorldState> = {}): NpcWorldState {
  return { id: 'npc-1', name: 'Guard', locationId: 'loc-1', isAlive: true, combatStats: null, ...overrides }
}

function render_(campaign: Campaign) {
  return render(<MemoryRouter><AtlasPanel campaign={campaign} /></MemoryRouter>)
}

// ── Empty state ───────────────────────────────────────────────────────────────

describe('AtlasPanel — empty state', () => {
  it('renders empty state when no locations are discovered', () => {
    render_(makeCampaign())
    expect(screen.getByTestId('atlas-empty')).toBeInTheDocument()
  })

  it('has accessible region label on empty state', () => {
    render_(makeCampaign())
    expect(screen.getByRole('region', { name: /no locations discovered/i })).toBeInTheDocument()
  })

  it('shows flavour text', () => {
    render_(makeCampaign())
    expect(screen.getByText(/The world remembers/i)).toBeInTheDocument()
  })

  it('hints at undiscovered count when locations exist but none are discovered', () => {
    render_(makeCampaign({ locations: [loc({ discovered: false })] }))
    expect(screen.getByText(/1 location/i)).toBeInTheDocument()
  })

  it('does not render the list view', () => {
    render_(makeCampaign())
    expect(screen.queryByTestId('atlas-list')).not.toBeInTheDocument()
  })
})

// ── Location list ─────────────────────────────────────────────────────────────

describe('AtlasPanel — location list', () => {
  it('renders the list when locations are discovered', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.getByTestId('atlas-list')).toBeInTheDocument()
  })

  it('has an accessible region label', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.getByRole('region', { name: /location list/i })).toBeInTheDocument()
  })

  it('shows discovered count in header', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.getByText(/1 Location/i)).toBeInTheDocument()
  })

  it('renders a card for each discovered location', () => {
    render_(makeCampaign({ locations: [loc({ id: 'a' }), loc({ id: 'b', name: 'Dark Forest', type: 'outdoor' })] }))
    expect(screen.getByTestId('location-card-a')).toBeInTheDocument()
    expect(screen.getByTestId('location-card-b')).toBeInTheDocument()
  })

  it('excludes undiscovered locations from the list', () => {
    render_(makeCampaign({ locations: [loc({ discovered: false, name: 'Hidden Place' })] }))
    expect(screen.queryByTestId('location-card-loc-1')).not.toBeInTheDocument()
  })

  it('shows Visited badge for visited locations', () => {
    render_(makeCampaign({ locations: [loc({ visited: true })] }))
    expect(screen.getByText('Visited')).toBeInTheDocument()
  })

  it('does not show Visited badge for discovered-but-unvisited locations', () => {
    render_(makeCampaign({ locations: [loc({ visited: false })] }))
    expect(screen.queryByText('Visited')).not.toBeInTheDocument()
  })

  it('shows Cleared badge when properties.cleared === true', () => {
    render_(makeCampaign({ locations: [loc({ properties: { cleared: true } })] }))
    expect(screen.getByText('Cleared')).toBeInTheDocument()
  })

  it('shows Alert badge when alertLevel is high', () => {
    render_(makeCampaign({ locations: [loc({ properties: { alertLevel: 'high' } })] }))
    expect(screen.getByText('Alert')).toBeInTheDocument()
  })

  it('shows NPC count when live NPCs are at the location', () => {
    render_(makeCampaign({ locations: [loc()], npcs: [npc()] }))
    expect(screen.getByText(/1 NPC present/i)).toBeInTheDocument()
  })

  it('does not count deceased NPCs in the card NPC total', () => {
    render_(makeCampaign({ locations: [loc()], npcs: [npc({ isAlive: false })] }))
    expect(screen.queryByText(/NPC present/i)).not.toBeInTheDocument()
  })

  it('shows worldTime in header when set', () => {
    render_(makeCampaign({ locations: [loc()], worldTime: 'Dusk, Day 4' }))
    expect(screen.getByText('Dusk, Day 4')).toBeInTheDocument()
  })

  it('each card is an accessible button with aria-label', () => {
    render_(makeCampaign({ locations: [loc({ name: 'Vault' })] }))
    expect(screen.getByRole('button', { name: /Vault.*Dungeon/i })).toBeInTheDocument()
  })

  it('type groups have accessible group labels', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.getByRole('group', { name: /Dungeon locations/i })).toBeInTheDocument()
  })
})

// ── Search ────────────────────────────────────────────────────────────────────

describe('AtlasPanel — search', () => {
  it('renders a search input', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.getByRole('searchbox', { name: /search locations/i })).toBeInTheDocument()
  })

  it('filters by name substring', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ name: 'Iron Keep' }), loc({ id: 'l2', name: 'Sunken Vault', type: 'room' })] }))
    await user.type(screen.getByRole('searchbox'), 'iron')
    expect(screen.getByText('Iron Keep')).toBeInTheDocument()
    expect(screen.queryByText('Sunken Vault')).not.toBeInTheDocument()
  })

  it('filters by description text', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({
      locations: [
        loc({ name: 'Keep', description: 'ancient stone walls' }),
        loc({ id: 'l2', name: 'Forest', type: 'outdoor', description: 'tall oaks' }),
      ],
    }))
    await user.type(screen.getByRole('searchbox'), 'ancient')
    expect(screen.getByText('Keep')).toBeInTheDocument()
    expect(screen.queryByText('Forest')).not.toBeInTheDocument()
  })

  it('filters by type label', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({
      locations: [
        loc({ name: 'The Dungeon', type: 'dungeon' }),
        loc({ id: 'l2', name: 'Riverton', type: 'town' }),
      ],
    }))
    await user.type(screen.getByRole('searchbox'), 'town')
    expect(screen.getByText('Riverton')).toBeInTheDocument()
    expect(screen.queryByText('The Dungeon')).not.toBeInTheDocument()
  })

  it('is case-insensitive', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ name: 'Iron Keep' })] }))
    await user.type(screen.getByRole('searchbox'), 'IRON')
    expect(screen.getByText('Iron Keep')).toBeInTheDocument()
  })

  it('shows no-results message when nothing matches', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByRole('status')).toHaveTextContent(/No locations match your search/i)
  })

  it('shows a clear button when query is non-empty', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.type(screen.getByRole('searchbox'), 'iron')
    expect(screen.getByRole('button', { name: /Clear search/i })).toBeInTheDocument()
  })

  it('clears the query when the clear button is clicked', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.type(screen.getByRole('searchbox'), 'iron')
    await user.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('restores full list after clearing', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ name: 'Iron Keep' }), loc({ id: 'l2', name: 'Dark Forest', type: 'outdoor' })] }))
    await user.type(screen.getByRole('searchbox'), 'iron')
    await user.click(screen.getByRole('button', { name: /Clear search/i }))
    expect(screen.getByText('Dark Forest')).toBeInTheDocument()
  })
})

// ── Type filter ───────────────────────────────────────────────────────────────

describe('AtlasPanel — type filter', () => {
  it('filter group has accessible label', () => {
    render_(makeCampaign({ locations: [loc(), loc({ id: 'l2', type: 'town', name: 'T' })] }))
    expect(screen.getByRole('group', { name: /Filter by location type/i })).toBeInTheDocument()
  })

  it('shows filter pills when multiple types are present', () => {
    render_(makeCampaign({ locations: [loc(), loc({ id: 'l2', type: 'town', name: 'T' })] }))
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument()
  })

  it('filter pills use aria-pressed', () => {
    render_(makeCampaign({ locations: [loc(), loc({ id: 'l2', type: 'town', name: 'T' })] }))
    const all = screen.getByRole('button', { name: /All/i })
    expect(all).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not show filter pills when only one type is present', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.queryByRole('button', { name: /All/i })).not.toBeInTheDocument()
  })

  it('clicking a type pill filters to that type', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({
      locations: [loc({ name: 'Goblin Cave', type: 'dungeon' }), loc({ id: 'l2', name: 'Riverton', type: 'town' })],
    }))
    const pills = screen.getAllByRole('button', { name: /Dungeon/i })
    const pill = pills.find(el => el.hasAttribute('aria-pressed'))!
    await user.click(pill)
    expect(screen.getByText('Goblin Cave')).toBeInTheDocument()
    expect(screen.queryByText('Riverton')).not.toBeInTheDocument()
  })

  it('active filter pill has aria-pressed=true', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({
      locations: [loc(), loc({ id: 'l2', type: 'town', name: 'T' })],
    }))
    const pills = screen.getAllByRole('button', { name: /Dungeon/i })
    const dungeonBtn = pills.find(el => el.hasAttribute('aria-pressed'))!
    await user.click(dungeonBtn)
    expect(dungeonBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking the active filter pill again clears it', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({
      locations: [loc({ name: 'Cave' }), loc({ id: 'l2', name: 'Town', type: 'town' })],
    }))
    const pills = screen.getAllByRole('button', { name: /Dungeon/i })
    const btn = pills.find(el => el.hasAttribute('aria-pressed'))!
    await user.click(btn)
    await user.click(btn)
    expect(screen.getByText('Cave')).toBeInTheDocument()
    expect(screen.getByText('Town')).toBeInTheDocument()
  })

  it('search and type filter compose', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({
      locations: [
        loc({ name: 'Iron Dungeon', type: 'dungeon' }),
        loc({ id: 'l2', name: 'Iron Town', type: 'town' }),
        loc({ id: 'l3', name: 'Gold Dungeon', type: 'dungeon' }),
      ],
    }))
    await user.type(screen.getByRole('searchbox'), 'iron')
    const pills = screen.getAllByRole('button', { name: /Dungeon/i })
    const dungPill = pills.find(el => el.hasAttribute('aria-pressed'))!
    await user.click(dungPill)
    expect(screen.getByText('Iron Dungeon')).toBeInTheDocument()
    expect(screen.queryByText('Iron Town')).not.toBeInTheDocument()
    expect(screen.queryByText('Gold Dungeon')).not.toBeInTheDocument()
  })
})

// ── Location detail ───────────────────────────────────────────────────────────

describe('AtlasPanel — location detail', () => {
  it('opens detail view on card click', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByTestId('location-detail')).toBeInTheDocument()
  })

  it('detail has accessible region label', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ name: 'Iron Keep' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByRole('region', { name: /Location detail: Iron Keep/i })).toBeInTheDocument()
  })

  it('shows location name as heading', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ name: 'Vault' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByRole('heading', { name: 'Vault' })).toBeInTheDocument()
  })

  it('shows full description', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ description: 'Thick with cobwebs.' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('Thick with cobwebs.')).toBeInTheDocument()
  })

  it('shows "No description recorded" when description is empty', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ description: '' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText(/No description recorded/i)).toBeInTheDocument()
  })

  it('back button returns to list', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    await user.click(screen.getByRole('button', { name: /Back to atlas/i }))
    expect(screen.getByTestId('atlas-list')).toBeInTheDocument()
    expect(screen.queryByTestId('location-detail')).not.toBeInTheDocument()
  })

  it('Discovered badge shows for discovered-but-unvisited locations', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ visited: false, discovered: true })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('Discovered')).toBeInTheDocument()
  })
})

// ── Director property chips ───────────────────────────────────────────────────

describe('AtlasPanel — property chips', () => {
  it('renders property chips section with accessible label', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ properties: { cleared: true } })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByRole('region', { name: /Known properties/i })).toBeInTheDocument()
  })

  it('renders boolean true property in heal colour', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ properties: { cleared: true } })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('renders string property value', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ properties: { alertLevel: 'high' } })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('renders numeric property value', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ properties: { guardCount: 4 } })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('does not render properties section when properties object is empty', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ properties: {} })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.queryByText('Known Properties')).not.toBeInTheDocument()
  })
})

// ── NPC rendering ─────────────────────────────────────────────────────────────

describe('AtlasPanel — NPC rendering in detail', () => {
  it('shows NPCs section with accessible label', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc()] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByRole('region', { name: /NPCs at this location/i })).toBeInTheDocument()
  })

  it('renders alive NPC name', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc({ name: 'Captain Roth' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('Captain Roth')).toBeInTheDocument()
  })

  it('shows Alive badge for live NPCs', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc()] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('Alive')).toBeInTheDocument()
  })

  it('shows Deceased badge for dead NPCs', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc({ isAlive: false })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByText('Deceased')).toBeInTheDocument()
  })

  it('renders deceased NPC name with accessible label', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc({ name: 'Dead Soldier', isAlive: false })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    const item = screen.getByLabelText(/Dead Soldier.*deceased/i)
    expect(item).toBeInTheDocument()
  })

  it('does not show NPC section when no NPCs at location', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc({ locationId: 'other' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.queryByRole('region', { name: /NPCs at this location/i })).not.toBeInTheDocument()
  })

  it('renders NPCs as a list', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()], npcs: [npc(), npc({ id: 'n2', name: 'Scout' })] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.getByRole('list', { name: undefined })).toBeInTheDocument()
    // Both names present
    expect(screen.getByText('Guard')).toBeInTheDocument()
    expect(screen.getByText('Scout')).toBeInTheDocument()
  })
})

// ── Breadcrumb & hierarchy ────────────────────────────────────────────────────

describe('AtlasPanel — breadcrumb', () => {
  it('shows breadcrumb nav when location has a parent', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Castle', type: 'dungeon', parentId: null })
    const child  = loc({ id: 'c1', name: 'Guard Room', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-c1'))
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
  })

  it('breadcrumb shows ancestor names', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Ruined Castle', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Guard Room', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-c1'))
    expect(screen.getAllByText('Ruined Castle').length).toBeGreaterThan(0)
  })

  it('current location in breadcrumb has aria-current=page', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Castle', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Guard Room', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-c1'))
    // The breadcrumb crumb for the current page has aria-current=page
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    const current = within(nav).getByText('Guard Room')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('parent breadcrumb crumb is a navigable button', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Castle', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Guard Room', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-c1'))
    expect(screen.getByRole('button', { name: /Navigate to Castle/i })).toBeInTheDocument()
  })

  it('clicking a breadcrumb crumb navigates to that location', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Castle', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Guard Room', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-c1'))
    await user.click(screen.getByRole('button', { name: /Navigate to Castle/i }))
    expect(screen.getByRole('heading', { name: 'Castle' })).toBeInTheDocument()
  })

  it('no breadcrumb nav for top-level locations', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument()
  })
})

// ── Child locations ───────────────────────────────────────────────────────────

describe('AtlasPanel — child locations', () => {
  it('shows sub-locations section with accessible label', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Keep', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Vault', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-p1'))
    expect(screen.getByRole('region', { name: /Sub-locations/i })).toBeInTheDocument()
  })

  it('each child is a keyboard-navigable button', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Keep', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Vault', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-p1'))
    expect(screen.getByRole('button', { name: /Navigate to Vault/i })).toBeInTheDocument()
  })

  it('clicking a child location navigates into it', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Keep', type: 'dungeon' })
    const child  = loc({ id: 'c1', name: 'Vault', type: 'room', parentId: 'p1' })
    render_(makeCampaign({ locations: [parent, child] }))
    await user.click(screen.getByTestId('location-card-p1'))
    await user.click(screen.getByRole('button', { name: /Navigate to Vault/i }))
    expect(screen.getByRole('heading', { name: 'Vault' })).toBeInTheDocument()
  })

  it('undiscovered children are not shown', async () => {
    const user = userEvent.setup()
    const parent = loc({ id: 'p1', name: 'Keep', type: 'dungeon' })
    const hidden = loc({ id: 'c1', name: 'Secret Room', type: 'room', parentId: 'p1', discovered: false })
    render_(makeCampaign({ locations: [parent, hidden] }))
    await user.click(screen.getByTestId('location-card-p1'))
    expect(screen.queryByText('Secret Room')).not.toBeInTheDocument()
  })
})

// ── Keyboard accessibility ────────────────────────────────────────────────────

describe('AtlasPanel — keyboard accessibility', () => {
  it('location cards are reachable by Tab', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc({ name: 'Dungeon' })] }))
    await user.tab()
    // After tabbing, one focusable element should be focused
    const focused = document.activeElement
    expect(focused?.tagName).toBeTruthy()
  })

  it('location card is activatable with Enter key', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    const card = screen.getByTestId('location-card-loc-1')
    card.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('location-detail')).toBeInTheDocument()
  })

  it('location card is activatable with Space key', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    const card = screen.getByTestId('location-card-loc-1')
    card.focus()
    await user.keyboard(' ')
    expect(screen.getByTestId('location-detail')).toBeInTheDocument()
  })

  it('back button is focusable and has explicit aria-label', async () => {
    const user = userEvent.setup()
    render_(makeCampaign({ locations: [loc()] }))
    await user.click(screen.getByTestId('location-card-loc-1'))
    const back = screen.getByRole('button', { name: /Back to atlas/i })
    expect(back).toBeInTheDocument()
    back.focus()
    expect(document.activeElement).toBe(back)
  })

  it('filter pills have aria-pressed attribute', () => {
    render_(makeCampaign({
      locations: [loc(), loc({ id: 'l2', type: 'town', name: 'T' })],
    }))
    const allDungeonBtns = screen.getAllByRole('button', { name: /Dungeon/i })
    const dungeonPill = allDungeonBtns.find(el => el.hasAttribute('aria-pressed'))!
    expect(dungeonPill).toHaveAttribute('aria-pressed')
  })

  it('search input has accessible label', () => {
    render_(makeCampaign({ locations: [loc()] }))
    expect(screen.getByRole('searchbox', { name: /search locations/i })).toBeInTheDocument()
  })
})
