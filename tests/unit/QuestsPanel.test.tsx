/**
 * QuestsPanel Tests — Phase 9.2
 *
 * QuestsPanel was a pure stub before this phase. It now renders real
 * DirectorConfig.activeThreads. These tests confirm: no fake data is ever
 * shown, hidden threads never leak, and grouping/sorting is correct.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QuestsPanel } from '@/components/adventure/panels/QuestsPanel'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign } from '@/lib/supabase'
import type { PlotThread } from '@/types/campaign'

function makeCampaign(threads: PlotThread[] = []): Campaign {
  return {
    id: 'camp-1', userId: 'user-1', title: 'Test Campaign', description: null,
    status: 'active', characterId: 'char-1',
    directorConfig: { ...DEFAULT_DIRECTOR_CONFIG, activeThreads: threads },
    worldState: DEFAULT_WORLD_STATE,
    tone: 'heroic', difficulty: 'standard',
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  }
}

function thread(overrides: Partial<PlotThread> = {}): PlotThread {
  return {
    id: 't1', title: 'Find the missing shipment', description: 'A caravan never arrived.',
    status: 'active', startedAtTurn: 3, resolvedAtTurn: null, isHidden: false,
    ...overrides,
  }
}

describe('QuestsPanel — empty state (no fake data)', () => {
  it('shows the honest empty state when there are no threads', () => {
    render(<QuestsPanel campaign={makeCampaign([])} />)
    expect(screen.getByText(/None have\s*emerged yet/i)).toBeInTheDocument()
  })

  it('does not render any quest cards in the empty state', () => {
    render(<QuestsPanel campaign={makeCampaign([])} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('QuestsPanel — real thread rendering', () => {
  it('renders a thread title and description', () => {
    render(<QuestsPanel campaign={makeCampaign([thread()])} />)
    expect(screen.getByText('Find the missing shipment')).toBeInTheDocument()
    expect(screen.getByText('A caravan never arrived.')).toBeInTheDocument()
  })

  it('groups threads by status into separate sections', () => {
    render(<QuestsPanel campaign={makeCampaign([
      thread({ id: 't1', title: 'Active One', status: 'active' }),
      thread({ id: 't2', title: 'Resolved One', status: 'resolved', resolvedAtTurn: 8 }),
      thread({ id: 't3', title: 'Abandoned One', status: 'abandoned' }),
    ])} />)
    expect(screen.getByRole('region', { name: /Active quests/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Resolved quests/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Abandoned quests/i })).toBeInTheDocument()
  })

  it('does not render a group section for a status with zero threads', () => {
    render(<QuestsPanel campaign={makeCampaign([thread({ status: 'active' })])} />)
    expect(screen.queryByRole('region', { name: /Resolved quests/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Abandoned quests/i })).not.toBeInTheDocument()
  })

  it('shows turn range for a resolved quest', () => {
    render(<QuestsPanel campaign={makeCampaign([
      thread({ status: 'resolved', startedAtTurn: 3, resolvedAtTurn: 9 }),
    ])} />)
    expect(screen.getByText(/Turn 3.*9/)).toBeInTheDocument()
  })

  it('shows only the start turn for an active quest', () => {
    render(<QuestsPanel campaign={makeCampaign([thread({ status: 'active', startedAtTurn: 5 })])} />)
    expect(screen.getByText('Turn 5')).toBeInTheDocument()
  })
})

describe('QuestsPanel — hidden arc protection', () => {
  it('never renders a thread marked isHidden', () => {
    render(<QuestsPanel campaign={makeCampaign([
      thread({ id: 't1', title: 'Visible Quest', isHidden: false }),
      thread({ id: 't2', title: 'Secret Director Thread', isHidden: true }),
    ])} />)
    expect(screen.getByText('Visible Quest')).toBeInTheDocument()
    expect(screen.queryByText('Secret Director Thread')).not.toBeInTheDocument()
  })

  it('shows the empty state if every thread is hidden', () => {
    render(<QuestsPanel campaign={makeCampaign([thread({ isHidden: true })])} />)
    expect(screen.getByText(/None have\s*emerged yet/i)).toBeInTheDocument()
  })
})

describe('QuestsPanel — accessibility', () => {
  it('has an accessible region label for the panel', () => {
    render(<QuestsPanel campaign={makeCampaign([thread()])} />)
    expect(screen.getByRole('region', { name: 'Quest log' })).toBeInTheDocument()
  })

  it('renders quest cards as a list with listitems', () => {
    render(<QuestsPanel campaign={makeCampaign([thread(), thread({ id: 't2', title: 'Second' })])} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
