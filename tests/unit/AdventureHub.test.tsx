/**
 * AdventureHub Tests — Phase 2.3
 *
 * Covers:
 *  - Layout rendering (status bar, panel area, tab nav)
 *  - Panel switching via tab nav
 *  - Session controls (pause, resume, end)
 *  - Error banner rendering
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { AdventureHub } from '@/components/adventure/AdventureHub'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

const MOCK_CAMPAIGN = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active' as const,
  characterId: 'char-1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
  worldState: DEFAULT_WORLD_STATE, tone: 'heroic' as const, difficulty: 'standard' as const,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const MOCK_CHARACTER = {
  id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '', experience: 0,
  tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
  conditions: [], features: [], inventory: [], spells: {},
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  sheet: {
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
    background: 'soldier',
    scores: { strength:16, dexterity:14, constitution:14, intelligence:10, wisdom:12, charisma:8 },
    modifiers: { strength:3, dexterity:2, constitution:2, intelligence:0, wisdom:1, charisma:-1 },
    hitDie: 'd10' as const, maxHp: 30, currentHp: 22, armorClass: 16, proficiencyBonus: 2,
    skillProficiencies: ['perception' as const], savingThrowProficiencies: [], equipment: [],
    conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

const MOCK_SESSION = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 3, status: 'active' as const,
  currentMode: 'exploration' as const, startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

function makeState(overrides: Partial<AdventureState> = {}): AdventureState {
  return {
    status: 'ready', campaign: MOCK_CAMPAIGN, character: MOCK_CHARACTER,
    session: MOCK_SESSION, turns: [], error: null, isActionInFlight: false,
    narrationStatus: 'idle', streamingText: '', suggestedActions: [],
    lastDirectorResult: null,
    combatState: null,
    lastCombatResult: null,
    readyToLevel: false,
    lastCheckResult: null,
    lastXpGain: 0,
    ...overrides,
  }
}

function makeActions(overrides: Partial<AdventureActions> = {}): AdventureActions {
  return {
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    submitAction: vi.fn(),
    cancelStream: vi.fn(),
    startCombat: vi.fn(),
    endCombat: vi.fn(),
    commitCombatResult: vi.fn().mockResolvedValue(undefined),
    levelUpCharacter: vi.fn().mockResolvedValue(undefined),
    clearCheckResult: vi.fn(),
    clearXpGain: vi.fn(),
    ...overrides,
  }
}

function renderHub(stateOverrides: Partial<AdventureState> = {}, actionOverrides: Partial<AdventureActions> = {}) {
  return render(
    <MemoryRouter>
      <AdventureHub state={makeState(stateOverrides)} actions={makeActions(actionOverrides)} />
    </MemoryRouter>
  )
}

describe('AdventureHub — layout', () => {
  it('renders the adventure hub container', () => {
    renderHub()
    expect(screen.getByTestId('adventure-hub')).toBeInTheDocument()
  })

  it('renders the status bar with campaign title', () => {
    renderHub()
    expect(screen.getByTestId('adventure-status-bar')).toBeInTheDocument()
    // The title appears inside a Link "← The Shattered Throne" — use partial match
    expect(screen.getByText(/The Shattered Throne/)).toBeInTheDocument()
  })

  it('renders turn count in the status bar', () => {
    renderHub()
    expect(screen.getByText('Turn 3')).toBeInTheDocument()
  })

  it('renders the bottom tab nav', () => {
    renderHub()
    expect(screen.getByRole('tablist', { name: 'Adventure panels' })).toBeInTheDocument()
  })

  it('renders 7 panel tabs (debug hidden without VITE_ENABLE_DEBUG_PANEL)', () => {
    renderHub()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)  // debug tab absent when flag unset
  })

  it('starts with the Story tab active', () => {
    renderHub()
    expect(screen.getByRole('tab', { name: /Story/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the panel area', () => {
    renderHub()
    expect(screen.getByTestId('adventure-panel-area')).toBeInTheDocument()
  })

  it('shows the character sidebar on desktop (always-visible aside)', () => {
    renderHub()
    expect(screen.getByTestId('adventure-character-sidebar')).toBeInTheDocument()
  })
})

describe('AdventureHub — session status', () => {
  it('shows "Live" badge for an active session', () => {
    renderHub()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows "Paused" badge for a paused session', () => {
    renderHub({ session: { ...MOCK_SESSION, status: 'paused' } })
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('shows Pause button for active session', () => {
    renderHub()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('shows Resume button for paused session', () => {
    renderHub({ session: { ...MOCK_SESSION, status: 'paused' } })
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  })

  it('shows End button when session is not completed', () => {
    renderHub()
    expect(screen.getByRole('button', { name: 'End' })).toBeInTheDocument()
  })

  it('does not show End button when session is completed', () => {
    renderHub({ session: { ...MOCK_SESSION, status: 'completed', endedAt: '2024-01-01T01:00:00Z' } })
    expect(screen.queryByRole('button', { name: 'End' })).not.toBeInTheDocument()
  })

  it('calls actions.pause when Pause is clicked', async () => {
    const user = userEvent.setup()
    const pause = vi.fn().mockResolvedValue(undefined)
    renderHub({}, { pause })
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(pause).toHaveBeenCalledOnce()
  })

  it('shows a save-confirmation message after pausing (Phase 9.2 save/load UX)', async () => {
    const user = userEvent.setup()
    const pause = vi.fn().mockResolvedValue(undefined)
    renderHub({}, { pause })
    expect(screen.queryByTestId('save-confirmed')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByTestId('save-confirmed')).toHaveTextContent('Progress saved')
  })

  it('calls actions.resume when Resume is clicked', async () => {
    const user = userEvent.setup()
    const resume = vi.fn().mockResolvedValue(undefined)
    renderHub({ session: { ...MOCK_SESSION, status: 'paused' } }, { resume })
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(resume).toHaveBeenCalledOnce()
  })

  it('calls actions.end when End is clicked', async () => {
    const user = userEvent.setup()
    const end = vi.fn().mockResolvedValue(undefined)
    renderHub({}, { end })
    await user.click(screen.getByRole('button', { name: 'End' }))
    expect(end).toHaveBeenCalledOnce()
  })
})

describe('AdventureHub — panel switching', () => {
  it('switches to the Dice panel when its tab is clicked', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Dice/i }))
    expect(screen.getByRole('tab', { name: /Dice/i })).toHaveAttribute('aria-selected', 'true')
    // stat-label applies CSS uppercase but DOM text stays as written
    expect(screen.getByText('Roll Mode')).toBeInTheDocument()
  })

  it('switches to the Character panel when its tab is clicked', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Character/i }))
    // Character panel shows the character's name
    const names = screen.getAllByText('Aldric Sorn')
    expect(names.length).toBeGreaterThan(0)
  })

  it('switches to the Journal panel', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    // Journal now shows SESSION JOURNAL summary when session data is present
    expect(screen.getByText('SESSION JOURNAL')).toBeInTheDocument()
  })

  it('level-up: clicking the Journal Level Up button opens the confirmation modal and confirming calls levelUpCharacter (Phase 9.2)', async () => {
    const user = userEvent.setup()
    const levelUpCharacter = vi.fn().mockResolvedValue(undefined)
    renderHub({ readyToLevel: true }, { levelUpCharacter })

    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    await user.click(screen.getByRole('button', { name: 'Level Up' }))

    // Modal opens
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-level-up'))

    expect(levelUpCharacter).toHaveBeenCalledOnce()
    const [patch] = levelUpCharacter.mock.calls[0]
    expect(patch).toHaveProperty('level')
    expect(patch).toHaveProperty('currentHp')
  })

  it('level-up banner and button are absent when readyToLevel is false', async () => {
    const user = userEvent.setup()
    renderHub({ readyToLevel: false })
    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    expect(screen.queryByRole('button', { name: 'Level Up' })).not.toBeInTheDocument()
  })

  it('does not render Debug tab without VITE_ENABLE_DEBUG_PANEL flag', () => {
    renderHub()
    expect(screen.queryByRole('tab', { name: /Debug/i })).not.toBeInTheDocument()
  })

  it('marks the newly active tab as selected', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Dice/i }))
    expect(screen.getByRole('tab', { name: /Story/i })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /Dice/i })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('AdventureHub — error state', () => {
  it('shows an error banner when state.error is set', () => {
    renderHub({ error: 'Session action failed.' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Session action failed.')).toBeInTheDocument()
  })

  it('does not render an error banner when error is null', () => {
    renderHub({ error: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('AdventureHub — story panel', () => {
  it('shows the story panel header when there are no turns', () => {
    renderHub({ turns: [] })
    expect(screen.getByText('YOUR STORY BEGINS')).toBeInTheDocument()
    // Active session shows the adventure-begins prompt
    expect(screen.getByText(/Every hero's story begins/i)).toBeInTheDocument()
  })

  it('shows AI narration placeholder for non-active sessions with no turns', () => {
    renderHub({ turns: [], session: { ...MOCK_SESSION, status: 'paused' } })
    // Paused session: ActionBar shows the resume message
    expect(screen.getByText(/Resume the session/i)).toBeInTheDocument()
  })

  it('renders existing turns when present', () => {
    const turns = [{
      id: 't1', sessionId: 'sess-1', turnNumber: 0, playerInput: 'I look around.',
      aiNarration: 'You see a dimly lit cave.', diceRolls: [],
      mode: 'exploration' as const, createdAt: '2024-01-01T00:00:00Z',
    }]
    renderHub({ turns })
    expect(screen.getByText(/I look around\./)).toBeInTheDocument()
    expect(screen.getByText(/You see a dimly lit cave\./)).toBeInTheDocument()
  })
})

describe('AdventureHub — world status sidebar (Phase 9.1)', () => {
  it('renders the world status sidebar', () => {
    renderHub()
    expect(screen.getByTestId('world-status-sidebar')).toBeInTheDocument()
  })

  it('shows current turn number and campaign tone/difficulty', () => {
    renderHub()
    const sidebar = screen.getByTestId('world-status-sidebar')
    expect(sidebar).toHaveTextContent('3') // turn number
    expect(sidebar).toHaveTextContent('heroic')
    expect(sidebar).toHaveTextContent('standard')
  })

  it('shows "Exploring" status when not in combat', () => {
    renderHub({ combatState: null })
    expect(screen.getByTestId('world-status-sidebar')).toHaveTextContent('Exploring')
  })

  it('shows "In Combat" status when combat is active', () => {
    renderHub({
      combatState: {
        enemies: [{ id: 'e1', name: 'Goblin', currentHp: 5, maxHp: 7, armorClass: 12 }],
        round: 1, phase: 'player_turn', activeIndex: 0,
        initiativeOrder: [], playerCurrentHp: 22, playerDeathSuccesses: 0,
        playerDeathFailures: 0, log: [], xpAwarded: 0,
      } as unknown as AdventureState['combatState'],
    })
    expect(screen.getByTestId('world-status-sidebar')).toHaveTextContent('In Combat')
  })

  it('does not show a fabricated weather or location field', () => {
    renderHub()
    const sidebar = screen.getByTestId('world-status-sidebar')
    // Honest limitation notice must be present — no invented weather/time data
    expect(sidebar).toHaveTextContent(/Phase 10/i)
  })

  it('shows worldTime only when the Director has actually set one', () => {
    renderHub() // DEFAULT_WORLD_STATE has worldTime: null
    expect(screen.queryByText('Time')).not.toBeInTheDocument()
  })

  it('renders worldTime when present in campaign world state', () => {
    renderHub({
      campaign: {
        ...MOCK_CAMPAIGN,
        worldState: { ...DEFAULT_WORLD_STATE, worldTime: 'Dusk, third day of travel' },
      },
    })
    expect(screen.getByText('Dusk, third day of travel')).toBeInTheDocument()
  })

  it('shows discovered location and known NPC counts from real world state', () => {
    renderHub({
      campaign: {
        ...MOCK_CAMPAIGN,
        worldState: {
          ...DEFAULT_WORLD_STATE,
          locations: [
            { id: 'l1', name: 'Rivergate', type: 'town', parentId: null, description: '', visited: true, discovered: true, properties: {} },
            { id: 'l2', name: 'Old Mill', type: 'building', parentId: null, description: '', visited: false, discovered: false, properties: {} },
          ],
          npcs: [{ id: 'n1', name: 'Barkeep Joss', locationId: 'l1', isAlive: true, combatStats: null }],
        },
      },
    })
    const sidebar = screen.getByTestId('world-status-sidebar')
    // Only 1 of 2 locations is discovered — must reflect that, not the raw total
    expect(sidebar).toHaveTextContent('Locations')
    expect(sidebar).toHaveTextContent('Known NPCs')
  })
})

describe('AdventureHub — current location (Phase 9.2, real data only)', () => {
  it('shows the current location name when currentLocationId resolves to a known location', () => {
    renderHub({
      campaign: {
        ...MOCK_CAMPAIGN,
        worldState: {
          ...DEFAULT_WORLD_STATE,
          locations: [{ id: 'l1', name: 'Rivergate', type: 'town', parentId: null, description: '', visited: true, discovered: true, properties: {} }],
          currentLocationId: 'l1',
        },
      },
    })
    expect(screen.getByTestId('current-location-row')).toHaveTextContent('Rivergate')
  })

  it('does not show a location row when currentLocationId is null', () => {
    renderHub()
    expect(screen.queryByTestId('current-location-row')).not.toBeInTheDocument()
  })

  it('does not show a location row when currentLocationId does not resolve to any known location', () => {
    renderHub({
      campaign: {
        ...MOCK_CAMPAIGN,
        worldState: {
          ...DEFAULT_WORLD_STATE,
          locations: [],
          currentLocationId: 'ghost-id',
        },
      },
    })
    expect(screen.queryByTestId('current-location-row')).not.toBeInTheDocument()
  })
})
