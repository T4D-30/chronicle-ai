/**
 * AdventureScenePanel Tests — Phase 11.5 (Adventure Hub redesign)
 */
import { render, screen } from '@testing-library/react'
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

  it('renders the scene art placeholder', () => {
    renderScene()
    expect(screen.getByTestId('scene-art-placeholder')).toBeInTheDocument()
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

describe('AdventureScenePanel — scene art placeholder (honest, no fabricated image)', () => {
  it('shows a generic placeholder message when no current location resolves', () => {
    renderScene()
    expect(screen.getByText('Scene art coming soon')).toBeInTheDocument()
  })

  it('shows the real location description when a current location resolves', () => {
    const campaign: Campaign = {
      ...MOCK_CAMPAIGN,
      worldState: {
        ...DEFAULT_WORLD_STATE,
        currentLocationId: 'loc-1',
        locations: [{
          id: 'loc-1', name: 'Rivergate', type: 'town', parentId: null,
          description: 'A bustling river town full of traders.', visited: true, discovered: true, properties: {},
        }],
      },
    }
    renderScene(campaign)
    expect(screen.getByText('A bustling river town full of traders.')).toBeInTheDocument()
  })
})
