/**
 * AdventureScenePanel Tests — Phase 11.5, updated for the
 * dialogue-readability pass: the scene viewport is content-aware. With
 * no real artwork (jsdom never loads images — also exactly what ships,
 * since no environment art exists yet) the viewport collapses entirely
 * and reserves no space; firing load on the hidden probe exercises the
 * artwork-present branch.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AdventureScenePanel } from '@/components/adventure/AdventureScenePanel'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign } from '@/lib/supabase'

const MOCK_CAMPAIGN: Campaign = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active', characterId: 'char-1',
  directorConfig: DEFAULT_DIRECTOR_CONFIG, worldState: DEFAULT_WORLD_STATE,
  tone: 'heroic', difficulty: 'standard',
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

function renderScene(campaign: Campaign = MOCK_CAMPAIGN) {
  return render(
    <AdventureScenePanel campaign={campaign}>
      <div data-testid="scene-children">Story content goes here</div>
    </AdventureScenePanel>,
  )
}

describe('AdventureScenePanel — rendering', () => {
  it('renders the scene panel container', () => {
    renderScene()
    expect(screen.getByTestId('adventure-scene-panel')).toBeInTheDocument()
  })

  it('renders its children unchanged', () => {
    renderScene()
    expect(screen.getByTestId('scene-children')).toHaveTextContent('Story content goes here')
  })

})

describe('AdventureScenePanel — location title', () => {
  it('falls back to the campaign title when no current location is set', () => {
    renderScene()
    expect(screen.getByTestId('scene-location-title')).toHaveTextContent('The Shattered Throne')
  })

  it('shows the real current location name when currentLocationId resolves', () => {
    const campaign: Campaign = {
      ...MOCK_CAMPAIGN,
      worldState: {
        ...DEFAULT_WORLD_STATE,
        currentLocationId: 'loc-1',
        locations: [{
          id: 'loc-1', name: 'Rivergate', type: 'town', parentId: null,
          description: 'A bustling river town.', visited: true, discovered: true, properties: {},
        }],
      },
    }
    renderScene(campaign)
    expect(screen.getByTestId('scene-location-title')).toHaveTextContent('Rivergate')
  })

  it('falls back to the campaign title when currentLocationId does not resolve to any known location', () => {
    const campaign: Campaign = {
      ...MOCK_CAMPAIGN,
      worldState: { ...DEFAULT_WORLD_STATE, currentLocationId: 'nonexistent', locations: [] },
    }
    renderScene(campaign)
    expect(screen.getByTestId('scene-location-title')).toHaveTextContent('The Shattered Throne')
  })
})

describe('AdventureScenePanel — time line (real worldTime only, never fabricated weather)', () => {
  it('does not render a time line when worldTime is not set', () => {
    renderScene()
    expect(screen.queryByTestId('scene-time-line')).not.toBeInTheDocument()
  })

  it('renders the real worldTime when the Director has set one', () => {
    const campaign: Campaign = {
      ...MOCK_CAMPAIGN,
      worldState: { ...DEFAULT_WORLD_STATE, worldTime: 'Midnight, a storm approaches' },
    }
    renderScene(campaign)
    expect(screen.getByTestId('scene-time-line')).toHaveTextContent('Midnight, a storm approaches')
  })

  it('never mentions weather anywhere in the panel', () => {
    renderScene()
    expect(screen.getByTestId('adventure-scene-panel')).not.toHaveTextContent(/weather|sunny|clear skies/i)
  })
})

describe('AdventureScenePanel — content-aware scene viewport (dialogue-readability pass)', () => {
  const CAMPAIGN_AT_TOWN: Campaign = {
    ...MOCK_CAMPAIGN,
    worldState: {
      ...DEFAULT_WORLD_STATE,
      currentLocationId: 'loc-1',
      locations: [{
        id: 'loc-1', name: 'Rivergate', type: 'town', parentId: null,
        description: 'A bustling river town.', visited: true, discovered: true, properties: {},
      }],
    },
  }

  it('collapses the viewport entirely when no artwork exists — no placeholder, no reserved space', () => {
    renderScene(CAMPAIGN_AT_TOWN)
    expect(screen.queryByTestId('scene-artwork')).not.toBeInTheDocument()
    expect(screen.queryByText('Scene art coming soon')).not.toBeInTheDocument()
    expect(screen.queryByText(/artwork arrive in a future update/i)).not.toBeInTheDocument()
  })

  it('renders a hidden artwork probe keyed by the location type asset slot', () => {
    renderScene(CAMPAIGN_AT_TOWN)
    const probe = screen.getByTestId('scene-artwork-probe')
    expect(probe).toHaveAttribute('src', '/assets/sprites/environments/location-town.png')
    expect(probe).toHaveClass('hidden')
  })

  it('renders the viewport with the artwork once the probe actually loads', () => {
    renderScene(CAMPAIGN_AT_TOWN)
    fireEvent.load(screen.getByTestId('scene-artwork-probe'))
    const viewport = screen.getByTestId('scene-artwork')
    expect(viewport).toBeInTheDocument()
    expect(screen.getByAltText('Scene: Rivergate')).toHaveAttribute(
      'src',
      '/assets/sprites/environments/location-town.png',
    )
  })

  it('renders no probe and no viewport when no current location resolves', () => {
    renderScene()
    expect(screen.queryByTestId('scene-artwork-probe')).not.toBeInTheDocument()
    expect(screen.queryByTestId('scene-artwork')).not.toBeInTheDocument()
  })

  it('location title and world time remain visible when the viewport is collapsed', () => {
    const campaign: Campaign = {
      ...CAMPAIGN_AT_TOWN,
      worldState: { ...CAMPAIGN_AT_TOWN.worldState, worldTime: 'Dusk, third day' },
    }
    renderScene(campaign)
    expect(screen.getByTestId('scene-location-title')).toHaveTextContent('Rivergate')
    expect(screen.getByTestId('scene-time-line')).toHaveTextContent('Dusk, third day')
  })
})
