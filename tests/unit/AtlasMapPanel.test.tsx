/**
 * AtlasMapPanel Tests — Phase 15.3 (Exploration Framework UI)
 *
 * Covers: honest empty state (no fake locations), real discovered
 * siblings render as cards, current location gets the player marker,
 * undiscovered locations never leak, and movement buttons call
 * onSubmitAction with the expected text (mirroring how
 * ActionBar.test.tsx already asserts quick-action click behavior).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AtlasMapPanel } from '@/components/adventure/panels/AtlasMapPanel'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign } from '@/lib/supabase'
import type { LocationState } from '@/types/campaign'

function location(overrides: Partial<LocationState> = {}): LocationState {
  return {
    id: 'l1', name: 'Rivergate', type: 'town', parentId: null,
    description: 'A river town.', visited: true, discovered: true, properties: {},
    ...overrides,
  }
}

function makeCampaign(locations: LocationState[] = [], currentLocationId: string | null = null): Campaign {
  return {
    id: 'camp-1', userId: 'user-1', title: 'Test Campaign', description: null,
    status: 'active', characterId: 'char-1',
    directorConfig: DEFAULT_DIRECTOR_CONFIG,
    worldState: { ...DEFAULT_WORLD_STATE, locations, currentLocationId },
    tone: 'heroic', difficulty: 'standard',
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  }
}

describe('AtlasMapPanel — empty state (no fake locations)', () => {
  it('shows the honest empty state when nothing is discovered', () => {
    render(<AtlasMapPanel campaign={makeCampaign([])} onSubmitAction={vi.fn()} />)
    expect(screen.getByText(/starts blank until you walk it/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('AtlasMapPanel — real location rendering', () => {
  it('renders discovered sibling locations as cards', () => {
    const locations = [
      location({ id: 'l1', name: 'Rivergate', parentId: 'r1' }),
      location({ id: 'l2', name: 'Old Mill', parentId: 'r1', discovered: true }),
    ]
    render(<AtlasMapPanel campaign={makeCampaign(locations, 'l1')} onSubmitAction={vi.fn()} />)
    expect(screen.getByText('Rivergate')).toBeInTheDocument()
    expect(screen.getByText('Old Mill')).toBeInTheDocument()
  })

  it('never renders an undiscovered location', () => {
    const locations = [
      location({ id: 'l1', name: 'Rivergate', parentId: 'r1', discovered: true }),
      location({ id: 'l2', name: 'Hidden Cave', parentId: 'r1', discovered: false }),
    ]
    render(<AtlasMapPanel campaign={makeCampaign(locations, 'l1')} onSubmitAction={vi.fn()} />)
    expect(screen.getByText('Rivergate')).toBeInTheDocument()
    expect(screen.queryByText('Hidden Cave')).not.toBeInTheDocument()
  })

  it('marks the current location with the player marker', () => {
    const locations = [
      location({ id: 'l1', name: 'Rivergate', parentId: 'r1' }),
      location({ id: 'l2', name: 'Old Mill', parentId: 'r1' }),
    ]
    render(<AtlasMapPanel campaign={makeCampaign(locations, 'l1')} onSubmitAction={vi.fn()} />)
    expect(screen.getByTestId('atlas-map-player-marker')).toHaveTextContent('You are here')
  })

  it('falls back to root-level discovered locations when no current location is set', () => {
    const locations = [
      location({ id: 'r1', name: 'Ashen Valley', type: 'region', parentId: null }),
      location({ id: 'r2', name: 'Frostpeak', type: 'region', parentId: null }),
    ]
    render(<AtlasMapPanel campaign={makeCampaign(locations, null)} onSubmitAction={vi.fn()} />)
    expect(screen.getByText('Ashen Valley')).toBeInTheDocument()
    expect(screen.getByText('Frostpeak')).toBeInTheDocument()
  })
})

describe('AtlasMapPanel — movement', () => {
  it('clicking a direction button calls onSubmitAction with real, pre-written text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    render(<AtlasMapPanel campaign={makeCampaign([location()], 'l1')} onSubmitAction={onSubmitAction} />)
    await user.click(screen.getByTestId('atlas-map-move-north'))
    expect(onSubmitAction).toHaveBeenCalledWith('I move north.')
  })

  it('all four direction buttons are present and labeled', () => {
    render(<AtlasMapPanel campaign={makeCampaign([location()], 'l1')} onSubmitAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Move north' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move south' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move east' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move west' })).toBeInTheDocument()
  })

  it('disables movement buttons when isDisabled is true', () => {
    render(<AtlasMapPanel campaign={makeCampaign([location()], 'l1')} onSubmitAction={vi.fn()} isDisabled />)
    expect(screen.getByTestId('atlas-map-move-north')).toBeDisabled()
  })
})
