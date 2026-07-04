import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { CampaignCard } from '@/components/campaign/CampaignCard'
import type { Campaign } from '@/lib/supabase'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1',
    userId: 'user-1',
    title: 'The Shattered Throne',
    description: 'A kingdom in turmoil.',
    status: 'idle',
    characterId: null,
    directorConfig: DEFAULT_DIRECTOR_CONFIG,
    worldState: DEFAULT_WORLD_STATE,
    tone: 'heroic',
    difficulty: 'standard',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('CampaignCard', () => {
  it('renders the campaign title', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign()} onOpen={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('The Shattered Throne')).toBeInTheDocument()
  })

  it('renders the campaign description when present', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign()} onOpen={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('A kingdom in turmoil.')).toBeInTheDocument()
  })

  it('shows status, tone, and difficulty badges', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign()} onOpen={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Not started')).toBeInTheDocument()
    expect(screen.getByText('Heroic')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
  })

  it('calls onOpen when the title is clicked', async () => {
    const user = userEvent.setup()
    const handleOpen = vi.fn()
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign()} onOpen={handleOpen} onDelete={() => {}} />
      </MemoryRouter>,
    )
    await user.click(screen.getByText('The Shattered Throne'))
    expect(handleOpen).toHaveBeenCalledWith('camp-1')
  })

  it('calls onDelete when Delete is clicked', async () => {
    const user = userEvent.setup()
    const handleDelete = vi.fn()
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign()} onOpen={() => {}} onDelete={handleDelete} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handleDelete).toHaveBeenCalledWith('camp-1')
  })

  it('shows "Continue" label for an active campaign', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign({ status: 'active' })} onOpen={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('shows "View" label for a completed campaign', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={makeCampaign({ status: 'completed' })} onOpen={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
  })
})
