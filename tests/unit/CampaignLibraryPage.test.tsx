import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listCampaignsMock = vi.fn()
const deleteCampaignMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    listCampaigns:  (...args: unknown[]) => listCampaignsMock(...args),
    deleteCampaign: (...args: unknown[]) => deleteCampaignMock(...args),
  }
})

import CampaignLibraryPage from '@/app/pages/CampaignLibraryPage'
import { useAuthStore }    from '@/store/authStore'
import { useCampaignStore } from '@/store/campaignStore'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign } from '@/lib/supabase'

function makeCampaign(id: string, title: string, tone = 'heroic' as const): Campaign {
  return {
    id, userId: 'user-1', title, description: null,
    status: 'idle', characterId: null,
    directorConfig: DEFAULT_DIRECTOR_CONFIG, worldState: DEFAULT_WORLD_STATE,
    tone, difficulty: 'standard',
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  }
}

function renderPage() {
  return render(<MemoryRouter><CampaignLibraryPage /></MemoryRouter>)
}

beforeEach(() => {
  listCampaignsMock.mockReset()
  deleteCampaignMock.mockReset()
  useAuthStore.setState({
    user: { id: 'user-1', email: 'test@chronicle.ai' } as never,
    isAuthenticated: true, isLoading: false, session: null,
  })
  useCampaignStore.setState({ campaigns: [], isLoading: false, error: null })
})

describe('CampaignLibraryPage — loading and listing', () => {
  it('fetches campaigns for the logged-in user on mount', async () => {
    listCampaignsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(listCampaignsMock).toHaveBeenCalledWith('user-1'))
  })

  it('renders each fetched campaign as a card', async () => {
    listCampaignsMock.mockResolvedValue([
      makeCampaign('c1', 'The Shattered Throne'),
      makeCampaign('c2', 'Blood in the Marshes'),
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    expect(screen.getByText('Blood in the Marshes')).toBeInTheDocument()
  })

  it('shows an empty state CTA when no campaigns exist', async () => {
    listCampaignsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Start Your First Campaign')).toBeInTheDocument())
  })

  it('shows an error when fetching fails', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    listCampaignsMock.mockRejectedValue(new ServiceError('Network error.', 'DB_ERROR'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Network error.')).toBeInTheDocument())
  })
})

describe('CampaignLibraryPage — search', () => {
  it('filters campaigns by title', async () => {
    listCampaignsMock.mockResolvedValue([
      makeCampaign('c1', 'The Shattered Throne'),
      makeCampaign('c2', 'Blood in the Marshes'),
    ])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    await user.type(screen.getByLabelText('Search campaigns'), 'Blood')
    expect(screen.queryByText('The Shattered Throne')).not.toBeInTheDocument()
    expect(screen.getByText('Blood in the Marshes')).toBeInTheDocument()
  })

  it('shows a no-results message for an unmatched search', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    await user.type(screen.getByLabelText('Search campaigns'), 'zzz')
    expect(screen.getByText('No campaigns match your search.')).toBeInTheDocument()
  })
})

describe('CampaignLibraryPage — delete', () => {
  it('opens a confirm dialog when Delete is clicked, does not delete immediately', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(deleteCampaignMock).not.toHaveBeenCalled()
  })

  it('deletes after confirming in the dialog', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    deleteCampaignMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteCampaignMock).toHaveBeenCalledWith('c1'))
  })

  it('removes the card after confirmed deletion', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    deleteCampaignMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('The Shattered Throne')).not.toBeInTheDocument())
  })

  it('cancels the dialog without deleting', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteCampaignMock).not.toHaveBeenCalled()
    expect(screen.getByText('The Shattered Throne')).toBeInTheDocument()
  })
})

describe('CampaignLibraryPage — import entry points (Phase 10.2)', () => {
  it('shows an "Import Campaign" link in the header that points to /campaigns/import', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Import Campaign' })).toHaveAttribute('href', '/campaigns/import')
  })

  it('the header "+ New Campaign" link still points to /campaigns/new (unchanged)', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: '+ New Campaign' })).toHaveAttribute('href', '/campaigns/new')
  })

  it('shows an "Import a Document" link in the empty state that points to /campaigns/import', async () => {
    listCampaignsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Start Your First Campaign')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Import a Document' })).toHaveAttribute('href', '/campaigns/import')
  })

  it('the empty-state "Start Your First Campaign" link still points to /campaigns/new (unchanged)', async () => {
    listCampaignsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Start Your First Campaign')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Start Your First Campaign' })).toHaveAttribute('href', '/campaigns/new')
  })

  it('does not show the empty-state import link when campaigns already exist', async () => {
    listCampaignsMock.mockResolvedValue([makeCampaign('c1', 'The Shattered Throne')])
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Import a Document' })).not.toBeInTheDocument()
  })
})
