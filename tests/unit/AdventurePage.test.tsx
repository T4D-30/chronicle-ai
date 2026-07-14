/**
 * AdventurePage Tests — Phase 2.3
 *
 * Tests the route wrapper: loading state, no_character state,
 * error state with retry, and the ready → AdventureHub render.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCampaignMock        = vi.fn()
const getCharacterMock       = vi.fn()
const getResumableSessionMock = vi.fn()
const startSessionMock       = vi.fn()
const getRecentTurnsMock     = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    getCampaign:         (...a: unknown[]) => getCampaignMock(...a),
    getCharacter:        (...a: unknown[]) => getCharacterMock(...a),
    getResumableSession: (...a: unknown[]) => getResumableSessionMock(...a),
    startSession:        (...a: unknown[]) => startSessionMock(...a),
    getRecentTurns:      (...a: unknown[]) => getRecentTurnsMock(...a),
  }
})

import AdventurePage from '@/app/pages/AdventurePage'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

const CAMPAIGN = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active' as const,
  characterId: 'char-1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
  worldState: DEFAULT_WORLD_STATE, tone: 'heroic' as const, difficulty: 'standard' as const,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const CAMPAIGN_NO_CHAR = { ...CAMPAIGN, characterId: null }

const CHARACTER = {
  id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '', experience: 0,
  tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
  conditions: [], features: [], inventory: [], spells: {},
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  sheet: {
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human', background: 'soldier',
    scores: { strength:16, dexterity:14, constitution:14, intelligence:10, wisdom:12, charisma:8 },
    modifiers: { strength:3, dexterity:2, constitution:2, intelligence:0, wisdom:1, charisma:-1 },
    hitDie: 'd10' as const, maxHp: 30, currentHp: 30, armorClass: 16, proficiencyBonus: 2,
    skillProficiencies: [] as const, savingThrowProficiencies: [], equipment: [],
    conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

const SESSION = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 0, status: 'active' as const,
  currentMode: 'exploration' as const, startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

function renderPage(campaignId = 'camp-1') {
  return render(
    <MemoryRouter initialEntries={[`/adventure/${campaignId}`]}>
      <Routes>
        <Route path="/adventure/:campaignId" element={<AdventurePage />} />
        <Route path="/campaigns/:id" element={<div data-testid="campaign-detail">Campaign Detail</div>} />
        <Route path="/campaigns" element={<div data-testid="campaigns-list">Campaigns</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  getCampaignMock.mockReset()
  getCharacterMock.mockReset()
  getResumableSessionMock.mockReset()
  startSessionMock.mockReset()
  getRecentTurnsMock.mockReset()
  getRecentTurnsMock.mockResolvedValue([])
})

describe('AdventurePage — loading state', () => {
  it('renders loading screen while data is fetching', () => {
    getCampaignMock.mockReturnValue(new Promise(() => {}))
    getResumableSessionMock.mockResolvedValue(null)
    renderPage()
    expect(screen.getByTestId('adventure-loading')).toBeInTheDocument()
  })

  it('shows the loading spinner', () => {
    getCampaignMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    // LoadingSpinner renders with label "Preparing your adventure…"
    expect(screen.getByText(/Preparing your adventure/i)).toBeInTheDocument()
  })
})

describe('AdventurePage — no_character state', () => {
  it('shows the no-character prompt when campaign has no character assigned', async () => {
    getCampaignMock.mockResolvedValue(CAMPAIGN_NO_CHAR)
    getResumableSessionMock.mockResolvedValue(null)
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('No Character Assigned')).toBeInTheDocument()
    )
  })

  it('shows the campaign title in the no-character screen', async () => {
    getCampaignMock.mockResolvedValue(CAMPAIGN_NO_CHAR)
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/The Shattered Throne/)).toBeInTheDocument()
    )
  })

  it('has a link to assign a character on the campaign detail page', async () => {
    getCampaignMock.mockResolvedValue(CAMPAIGN_NO_CHAR)
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Assign Character/i })).toBeInTheDocument()
    )
  })
})

describe('AdventurePage — error state', () => {
  it('shows error message when campaign fails to load', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    getCampaignMock.mockRejectedValue(new ServiceError('Campaign not found.', 'NOT_FOUND'))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Campaign not found.')).toBeInTheDocument()
    )
  })

  it('shows Retry button in error state', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    getCampaignMock.mockRejectedValue(new ServiceError('Network error.', 'DB_ERROR'))
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    )
  })

  it('reloads when Retry is clicked', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    getCampaignMock
      .mockRejectedValueOnce(new ServiceError('Fail.', 'DB_ERROR'))
      .mockResolvedValue(CAMPAIGN)
    getCharacterMock.mockResolvedValue(CHARACTER)
    getResumableSessionMock.mockResolvedValue(SESSION)

    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(screen.getByTestId('adventure-hub')).toBeInTheDocument()
    )
  })
})

describe('AdventurePage — ready state', () => {
  beforeEach(() => {
    getCampaignMock.mockResolvedValue(CAMPAIGN)
    getCharacterMock.mockResolvedValue(CHARACTER)
    getResumableSessionMock.mockResolvedValue(SESSION)
  })

  it('renders the AdventureHub when all data is loaded', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByTestId('adventure-hub')).toBeInTheDocument()
    )
  })

  it('uses an existing session instead of starting a new one', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('adventure-hub')).toBeInTheDocument())
    expect(startSessionMock).not.toHaveBeenCalled()
  })

  it('starts a new session when none is resumable', async () => {
    getResumableSessionMock.mockResolvedValue(null)
    startSessionMock.mockResolvedValue(SESSION)
    renderPage()
    await waitFor(() => expect(screen.getByTestId('adventure-hub')).toBeInTheDocument())
    expect(startSessionMock).toHaveBeenCalledWith('camp-1')
  })

  it('shows the campaign title in the status bar', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('adventure-hub')).toBeInTheDocument())
    // Scoped to the status bar: as of the Adventure Hub redesign, the
    // campaign title can also legitimately appear in the new
    // AdventureScenePanel's location title (see AdventureHub.test.tsx's
    // own equivalent fix for the full rationale).
    const statusBar = screen.getByTestId('adventure-status-bar')
    expect(within(statusBar).getByText(/The Shattered Throne/)).toBeInTheDocument()
  })

  it('shows the character name in the Character overlay (unified screen B1)', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId('adventure-hub'))
    // Since the unified Adventure screen, the character sheet opens as a
    // pause overlay over the world instead of a permanent sidebar.
    await user.click(screen.getByRole('tab', { name: /Character/i }))
    expect(screen.getAllByText('Aldric Sorn').length).toBeGreaterThan(0)
  })

  it('shows the session turn count', async () => {
    renderPage()
    await waitFor(() => screen.getByTestId('adventure-hub'))
    expect(screen.getByText('Turn 0')).toBeInTheDocument()
  })

  it('state persists on "refresh" — getResumableSession is the source of truth', async () => {
    // Simulates refresh: stores are empty, but getResumableSession finds the session
    renderPage()
    await waitFor(() => expect(screen.getByTestId('adventure-hub')).toBeInTheDocument())
    // Session was loaded from getResumableSession, not from a store
    expect(getResumableSessionMock).toHaveBeenCalledWith('camp-1')
    expect(startSessionMock).not.toHaveBeenCalled()
  })
})
