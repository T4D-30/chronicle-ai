/**
 * AdventureLeftNav Tests — Phase 11.5 (Adventure Hub redesign)
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { AdventureLeftNav } from '@/components/adventure/AdventureLeftNav'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign, GameSession } from '@/lib/supabase'

const MOCK_CAMPAIGN: Campaign = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active', characterId: 'char-1',
  directorConfig: DEFAULT_DIRECTOR_CONFIG, worldState: DEFAULT_WORLD_STATE,
  tone: 'heroic', difficulty: 'standard',
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const MOCK_SESSION: GameSession = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 3, status: 'active',
  currentMode: 'exploration', startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

function renderNav(props: Partial<React.ComponentProps<typeof AdventureLeftNav>> = {}) {
  return render(
    <MemoryRouter>
      <AdventureLeftNav
        campaign={MOCK_CAMPAIGN}
        session={MOCK_SESSION}
        activePanel="story"
        onSelectPanel={vi.fn()}
        onEndSession={vi.fn()}
        isSessionDone={false}
        isActionInFlight={false}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('AdventureLeftNav — rendering', () => {
  it('renders the Chronicle AI title', () => {
    renderNav()
    expect(screen.getByText('CHRONICLE AI')).toBeInTheDocument()
  })

  it('renders all required navigation items', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /Home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Characters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Journal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quests/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Codex/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Inventory/i })).toBeInTheDocument()
  })

  it('renders the current objective card', () => {
    renderNav()
    expect(screen.getByTestId('current-objective-card')).toBeInTheDocument()
  })

  it('renders the world status card', () => {
    renderNav()
    expect(screen.getByTestId('world-status-card')).toBeInTheDocument()
  })

  it('renders the End Session button when the session is not done', () => {
    renderNav()
    expect(screen.getByRole('button', { name: 'End Session' })).toBeInTheDocument()
  })

  it('does not render the End Session button when the session is done', () => {
    renderNav({ isSessionDone: true })
    expect(screen.queryByRole('button', { name: 'End Session' })).not.toBeInTheDocument()
  })
})

describe('AdventureLeftNav — Settings placeholder (no real route exists)', () => {
  it('renders Settings as a disabled button, not a link to a nonexistent route', () => {
    renderNav()
    const settingsButton = screen.getByRole('button', { name: /Settings/i })
    expect(settingsButton).toBeDisabled()
  })

  it('does not render a Settings link', () => {
    renderNav()
    expect(screen.queryByRole('link', { name: /Settings/i })).not.toBeInTheDocument()
  })
})

describe('AdventureLeftNav — navigation calls onSelectPanel', () => {
  it('calls onSelectPanel with "story" when Home is clicked', async () => {
    const user = userEvent.setup()
    const onSelectPanel = vi.fn()
    renderNav({ onSelectPanel })
    await user.click(screen.getByRole('button', { name: /Home/i }))
    expect(onSelectPanel).toHaveBeenCalledWith('story')
  })

  it('calls onSelectPanel with "journal" when Journal is clicked', async () => {
    const user = userEvent.setup()
    const onSelectPanel = vi.fn()
    renderNav({ onSelectPanel })
    await user.click(screen.getByRole('button', { name: /Journal/i }))
    expect(onSelectPanel).toHaveBeenCalledWith('journal')
  })

  it('marks the active panel\'s nav item with aria-current', () => {
    renderNav({ activePanel: 'quests' })
    expect(screen.getByRole('button', { name: /Quests/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark an inactive panel\'s nav item with aria-current', () => {
    renderNav({ activePanel: 'quests' })
    expect(screen.getByRole('button', { name: /Home/i })).not.toHaveAttribute('aria-current')
  })
})

describe('AdventureLeftNav — End Session', () => {
  it('calls onEndSession when the End Session button is clicked', async () => {
    const user = userEvent.setup()
    const onEndSession = vi.fn()
    renderNav({ onEndSession })
    await user.click(screen.getByRole('button', { name: 'End Session' }))
    expect(onEndSession).toHaveBeenCalledOnce()
  })
})

describe('AdventureLeftNav — current objective (real PlotThread data)', () => {
  it('shows the honest empty state when there are no active threads', () => {
    renderNav()
    expect(screen.getByText('No active objective yet.')).toBeInTheDocument()
  })

  it('shows a real active plot thread\'s title and description', () => {
    renderNav({
      campaign: {
        ...MOCK_CAMPAIGN,
        directorConfig: {
          ...DEFAULT_DIRECTOR_CONFIG,
          activeThreads: [{
            id: 'thread-1', title: 'Find the Lost Amulet', description: 'The amulet was last seen in the old ruins.',
            status: 'active', startedAtTurn: 1, resolvedAtTurn: null, isHidden: false,
          }],
        },
      },
    })
    expect(screen.getByText('Find the Lost Amulet')).toBeInTheDocument()
    expect(screen.getByText(/last seen in the old ruins/)).toBeInTheDocument()
  })

  it('does not show a hidden thread as the current objective', () => {
    renderNav({
      campaign: {
        ...MOCK_CAMPAIGN,
        directorConfig: {
          ...DEFAULT_DIRECTOR_CONFIG,
          activeThreads: [{
            id: 'thread-1', title: 'Secret Hidden Plot', description: 'Should not show.',
            status: 'active', startedAtTurn: 1, resolvedAtTurn: null, isHidden: true,
          }],
        },
      },
    })
    expect(screen.queryByText('Secret Hidden Plot')).not.toBeInTheDocument()
    expect(screen.getByText('No active objective yet.')).toBeInTheDocument()
  })

  it('does not show a resolved thread as the current objective', () => {
    renderNav({
      campaign: {
        ...MOCK_CAMPAIGN,
        directorConfig: {
          ...DEFAULT_DIRECTOR_CONFIG,
          activeThreads: [{
            id: 'thread-1', title: 'Already Done', description: 'Resolved already.',
            status: 'resolved', startedAtTurn: 1, resolvedAtTurn: 5, isHidden: false,
          }],
        },
      },
    })
    expect(screen.queryByText('Already Done')).not.toBeInTheDocument()
  })
})

describe('AdventureLeftNav — world status card (real data, no fabricated weather)', () => {
  it('shows the real turn number', () => {
    renderNav()
    const card = screen.getByTestId('world-status-card')
    expect(card).toHaveTextContent('3')
  })

  it('does not mention weather anywhere', () => {
    renderNav()
    const card = screen.getByTestId('world-status-card')
    expect(card).not.toHaveTextContent(/weather|sunny|rain|clear skies/i)
  })

  it('shows worldTime only when the Director has actually set one', () => {
    renderNav()
    const card = screen.getByTestId('world-status-card')
    expect(card).not.toHaveTextContent('Time')
  })

  it('shows the real worldTime when set', () => {
    renderNav({
      campaign: { ...MOCK_CAMPAIGN, worldState: { ...DEFAULT_WORLD_STATE, worldTime: 'Dawn' } },
    })
    const card = screen.getByTestId('world-status-card')
    expect(card).toHaveTextContent('Dawn')
  })
})
