/**
 * CampaignSessionPage Tests
 * Covers: loading/error states, ready-to-start CTA, active session controls
 * (resume, pause, end), and the turn history placeholder.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCampaignMock         = vi.fn()
const getResumableSessionMock = vi.fn()
const getRecentTurnsMock      = vi.fn()
const startSessionMock        = vi.fn()
const pauseSessionMock        = vi.fn()
const resumeSessionMock       = vi.fn()
const endSessionMock          = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    getCampaign:          (...a: unknown[]) => getCampaignMock(...a),
    getResumableSession:  (...a: unknown[]) => getResumableSessionMock(...a),
    getRecentTurns:       (...a: unknown[]) => getRecentTurnsMock(...a),
    startSession:         (...a: unknown[]) => startSessionMock(...a),
    pauseSession:         (...a: unknown[]) => pauseSessionMock(...a),
    resumeSession:        (...a: unknown[]) => resumeSessionMock(...a),
    endSession:           (...a: unknown[]) => endSessionMock(...a),
  }
})

import CampaignSessionPage from '@/app/pages/CampaignSessionPage'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

const CAMPAIGN = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne', description: 'A kingdom in turmoil.',
  status: 'idle' as const, characterId: null,
  directorConfig: DEFAULT_DIRECTOR_CONFIG, worldState: DEFAULT_WORLD_STATE,
  tone: 'heroic' as const, difficulty: 'standard' as const,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const ACTIVE_SESSION = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 2,
  status: 'active' as const, currentMode: 'exploration' as const,
  startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

const PAUSED_SESSION = { ...ACTIVE_SESSION, status: 'paused' as const }
const COMPLETED_SESSION = { ...ACTIVE_SESSION, status: 'completed' as const }

function renderPage(campaignId = 'camp-1') {
  return render(
    <MemoryRouter initialEntries={[`/campaigns/${campaignId}/session`]}>
      <Routes>
        <Route path="/campaigns/:id/session" element={<CampaignSessionPage />} />
        <Route path="/campaigns/:id" element={<div>Back to Campaign</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getCampaignMock.mockReset()
  getResumableSessionMock.mockReset()
  getRecentTurnsMock.mockReset()
  startSessionMock.mockReset()
  pauseSessionMock.mockReset()
  resumeSessionMock.mockReset()
  endSessionMock.mockReset()
  getRecentTurnsMock.mockResolvedValue([])
})

describe('CampaignSessionPage — loading states', () => {
  it('shows loading spinner while data loads', () => {
    getCampaignMock.mockReturnValue(new Promise(() => {}))
    getResumableSessionMock.mockResolvedValue(null)
    renderPage()
    expect(screen.getByText(/Loading…/i)).toBeInTheDocument()
  })

  it('shows error state when campaign fails to load', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    getCampaignMock.mockRejectedValue(new ServiceError('Not found.', 'NOT_FOUND'))
    getResumableSessionMock.mockResolvedValue(null)
    renderPage()
    await waitFor(() => expect(screen.getByText('Not found.')).toBeInTheDocument())
  })
})

describe('CampaignSessionPage — ready to start', () => {
  beforeEach(() => {
    getCampaignMock.mockResolvedValue(CAMPAIGN)
    getResumableSessionMock.mockResolvedValue(null)
  })

  it('shows Begin Session button when no session exists', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Begin Session' })).toBeInTheDocument())
  })

  it('shows the campaign title and description on the start screen', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
    expect(screen.getByText('A kingdom in turmoil.')).toBeInTheDocument()
  })

  it('calls startSession when Begin Session is clicked', async () => {
    startSessionMock.mockResolvedValue(ACTIVE_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Begin Session' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Begin Session' }))
    await waitFor(() => expect(startSessionMock).toHaveBeenCalledWith('camp-1'))
  })

  it('transitions to the active session UI after start', async () => {
    startSessionMock.mockResolvedValue(ACTIVE_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Begin Session' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Begin Session' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
  })
})

describe('CampaignSessionPage — active session', () => {
  beforeEach(() => {
    getCampaignMock.mockResolvedValue(CAMPAIGN)
    getResumableSessionMock.mockResolvedValue(ACTIVE_SESSION)
  })

  it('shows the campaign title in the header', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('The Shattered Throne')).toBeInTheDocument())
  })

  it('shows Active badge for an active session', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument())
  })

  it('shows Pause and End Session buttons', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'End Session' })).toBeInTheDocument()
  })

  it('calls pauseSession when Pause is clicked', async () => {
    pauseSessionMock.mockResolvedValue(PAUSED_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(pauseSessionMock).toHaveBeenCalledWith('sess-1'))
  })

  it('shows Paused badge after pausing', async () => {
    pauseSessionMock.mockResolvedValue(PAUSED_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(screen.getByText('Paused')).toBeInTheDocument())
  })

  it('calls endSession when End Session is clicked', async () => {
    endSessionMock.mockResolvedValue(COMPLETED_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'End Session' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'End Session' }))
    await waitFor(() => expect(endSessionMock).toHaveBeenCalledWith('sess-1'))
  })
})

describe('CampaignSessionPage — paused session', () => {
  beforeEach(() => {
    getCampaignMock.mockResolvedValue(CAMPAIGN)
    getResumableSessionMock.mockResolvedValue(PAUSED_SESSION)
  })

  it('shows Resume and End Session buttons for a paused session', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'End Session' })).toBeInTheDocument()
  })

  it('calls resumeSession when Resume is clicked', async () => {
    resumeSessionMock.mockResolvedValue(ACTIVE_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(resumeSessionMock).toHaveBeenCalledWith('sess-1'))
  })

  it('shows Active badge after resuming', async () => {
    resumeSessionMock.mockResolvedValue(ACTIVE_SESSION)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument())
  })
})

describe('CampaignSessionPage — session state persists on page refresh', () => {
  it('loads a paused session and shows the correct controls on mount (state preserved server-side)', async () => {
    // This simulates a page refresh: the store is empty, but the DB has the session
    getCampaignMock.mockResolvedValue(CAMPAIGN)
    getResumableSessionMock.mockResolvedValue(PAUSED_SESSION)
    renderPage()
    // After load, the page should reflect the paused state from the DB — no
    // client-side state needed, getResumableSession is the source of truth.
    await waitFor(() => expect(screen.getByText('Paused')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  })
})
