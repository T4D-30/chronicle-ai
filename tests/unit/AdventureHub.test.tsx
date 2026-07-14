/**
 * AdventureHub Tests — Unified Adventure Screen (Presentation 4, B1)
 *
 * Covers:
 *  - Layout rendering (status bar, world surface, tab nav)
 *  - The unified screen: one Adventure surface, no separate Story/World tabs
 *  - Panel tabs opening the pause overlay OVER the still-mounted world
 *  - Session controls (pause, resume, end)
 *  - Level Up via the Journal overlay
 *  - Combat handoff and exact-position return
 *  - Error banner rendering
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { AdventureHub } from '@/components/adventure/AdventureHub'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import { initCombat } from '@/lib/engine'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import { TRANSITION_PHASE_MS } from '@/components/adventure/overworld/WorldTransition'

const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true'

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
    const statusBar = screen.getByTestId('adventure-status-bar')
    expect(statusBar).toBeInTheDocument()
    expect(within(statusBar).getByText(/The Shattered Throne/)).toBeInTheDocument()
  })

  it('renders turn count in the status bar', () => {
    renderHub()
    expect(screen.getByText('Turn 3')).toBeInTheDocument()
  })

  it('renders the bottom tab nav', () => {
    renderHub()
    expect(screen.getByRole('tablist', { name: 'Adventure panels' })).toBeInTheDocument()
  })

  it('renders the expected bottom panel tabs for the current debug flag', () => {
    renderHub()
    const tabNav = screen.getByRole('tablist', { name: 'Adventure panels' })
    const tabs = within(tabNav).getAllByRole('tab')
    expect(tabs).toHaveLength(DEBUG_ENABLED ? 8 : 7)
  })

  it('renders the panel area', () => {
    renderHub()
    expect(screen.getByTestId('adventure-panel-area')).toBeInTheDocument()
  })
})

describe('AdventureHub — unified adventure screen (B1)', () => {
  it('starts on the unified Adventure surface with the world as the primary view', () => {
    renderHub()
    expect(screen.getByRole('tab', { name: /Adventure/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('overworld-mode')).toBeInTheDocument()
    expect(screen.getByTestId('overworld-scene')).toBeInTheDocument()
  })

  it('has no separate Story or World tabs anymore', () => {
    renderHub()
    const tabNav = screen.getByTestId('adventure-tab-nav')
    expect(within(tabNav).queryByRole('tab', { name: /Story/i })).not.toBeInTheDocument()
    expect(within(tabNav).queryByRole('tab', { name: /^World$/i })).not.toBeInTheDocument()
  })

  it('does not render the old dashboard side columns', () => {
    renderHub()
    expect(screen.queryByTestId('adventure-left-sidebar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('adventure-right-sidebar-wrapper')).not.toBeInTheDocument()
  })
})

describe('AdventureHub — panel tabs open the pause overlay over the world', () => {
  it('opens the Character overlay without unmounting the world', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Character/i }))
    const overlay = screen.getByTestId('pause-menu')
    expect(within(overlay).getAllByText('Aldric Sorn').length).toBeGreaterThan(0)
    // The world stays mounted behind the overlay
    expect(screen.getByTestId('overworld-scene')).toBeInTheDocument()
  })

  it('opens the Dice overlay with the real DicePanel', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Dice/i }))
    const overlay = screen.getByTestId('pause-menu')
    expect(within(overlay).getByText('Roll Mode')).toBeInTheDocument()
  })

  it('opens the Journal overlay with the real JournalPanel', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    const overlay = screen.getByTestId('pause-menu')
    expect(within(overlay).getByText('SESSION JOURNAL')).toBeInTheDocument()
  })

  it('marks the overlay tab selected and the Adventure tab unselected while open', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Dice/i }))
    expect(screen.getByRole('tab', { name: /Dice/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Adventure/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('the Adventure tab closes the overlay and returns to the world', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Quests/i }))
    expect(screen.getByTestId('pause-menu')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Adventure/i }))
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Adventure/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('Escape closes a bottom-nav-opened overlay too (one overlay, two doors)', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Atlas/i }))
    expect(screen.getByTestId('pause-menu')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Adventure/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('switching pause-menu tabs from inside the overlay keeps the bottom nav in sync', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Character/i }))
    await user.click(screen.getByTestId('pause-tab-codex'))
    expect(screen.getByRole('tab', { name: /Codex/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Character/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('opening and closing an overlay preserves the player position and facing', () => {
    vi.useFakeTimers()
    try {
      renderHub()
      const step = (key: string) => {
        fireEvent.keyDown(window, { key })
        act(() => { vi.advanceTimersByTime(STEP_MS + 10) })
      }
      step('ArrowLeft')
      step('ArrowUp')
      const player = screen.getByTestId('overworld-player')
      expect(player).toHaveAttribute('data-x', '6')
      expect(player).toHaveAttribute('data-y', '7')

      fireEvent.click(screen.getByRole('tab', { name: /Journal/i }))
      expect(screen.getByTestId('pause-menu')).toBeInTheDocument()
      // Movement is frozen while the overlay is open
      step('ArrowUp')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '7')

      fireEvent.click(screen.getByRole('tab', { name: /Adventure/i }))
      expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '6')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '7')
      step('ArrowUp')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '6')
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders the Debug tab only when VITE_ENABLE_DEBUG_PANEL is true', () => {
    renderHub()
    const tabNav = screen.getByRole('tablist', { name: 'Adventure panels' })
    const debugTab = within(tabNav).queryByRole('tab', { name: /Debug/i })
    if (DEBUG_ENABLED) {
      expect(debugTab).toBeInTheDocument()
    } else {
      expect(debugTab).not.toBeInTheDocument()
    }
  })
})

describe('AdventureHub — level up via the Journal overlay', () => {
  it('clicking the Journal overlay Level Up button opens the confirmation modal and confirming calls levelUpCharacter', async () => {
    const user = userEvent.setup()
    const levelUpCharacter = vi.fn().mockResolvedValue(undefined)
    renderHub({ readyToLevel: true }, { levelUpCharacter })

    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    await user.click(screen.getByRole('button', { name: 'Level Up' }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-level-up'))

    expect(levelUpCharacter).toHaveBeenCalledOnce()
    const [patch] = levelUpCharacter.mock.calls[0]
    expect(patch).toHaveProperty('level')
    expect(patch).toHaveProperty('currentHp')
  })

  it('level-up button is absent when readyToLevel is false', async () => {
    const user = userEvent.setup()
    renderHub({ readyToLevel: false })
    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    expect(screen.queryByRole('button', { name: 'Level Up' })).not.toBeInTheDocument()
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

describe('AdventureHub — combat (Law 5)', () => {
  function mockCombatState() {
    const enemy = {
      id: 'forest-wolf',
      name: 'Forest Wolf',
      isPlayer: false as const,
      maxHp: 11,
      currentHp: 11,
      armorClass: 13,
      attackBonus: 4,
      damageDie: 'd6' as const,
      damageBonus: 2,
      dexMod: 2,
    }
    return initCombat(
      { id: 'player', name: MOCK_CHARACTER.sheet.name, isPlayer: true as const, sheet: MOCK_CHARACTER.sheet },
      [enemy],
    )
  }

  it('disables the overlay tabs during combat (combat keeps its own visual mode)', () => {
    renderHub({ combatState: mockCombatState() })
    expect(screen.getByTestId('combat-panel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Character/i })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /Journal/i })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /Adventure/i })).not.toBeDisabled()
  })

  it('closes an open overlay when combat starts, so it cannot silently reopen after', () => {
    const actions = makeActions()
    const { rerender } = render(
      <MemoryRouter>
        <AdventureHub state={makeState()} actions={actions} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Journal/i }))
    expect(screen.getByTestId('pause-menu')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <AdventureHub state={makeState({ combatState: mockCombatState() })} actions={actions} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('combat-panel')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <AdventureHub state={makeState({ combatState: null })} actions={actions} />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('overworld-mode')).toBeInTheDocument()
  })

  it('hands an overworld encounter to combat and restores the exact position and movement afterward', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const actions = makeActions()
    const combatState = mockCombatState()

    try {
      const { rerender } = render(
        <MemoryRouter>
          <AdventureHub state={makeState()} actions={actions} />
        </MemoryRouter>,
      )

      const step = (key: string) => {
        fireEvent.keyDown(window, { key })
        act(() => {
          vi.advanceTimersByTime(STEP_MS + 10)
        })
      }

      // The unified screen starts on the world — no tab click needed.
      expect(screen.getByTestId('overworld-mode')).toBeInTheDocument()

      // Monastery spawn (7,8) -> forest gate (6,0).
      step('ArrowLeft')
      for (let i = 0; i < 8; i++) step('ArrowUp')
      act(() => {
        vi.advanceTimersByTime(TRANSITION_PHASE_MS + 5)
      })
      act(() => {
        vi.advanceTimersByTime(TRANSITION_PHASE_MS + 5)
      })
      expect(screen.getByTestId('overworld-scene')).toHaveAttribute('data-map', 'forest-path')

      // Forest spawn (5,10) -> ambush (3,3). The real encounter adapter
      // must hand the fixture enemy to the existing combat action.
      for (let i = 0; i < 2; i++) step('ArrowUp')
      step('ArrowLeft')
      step('ArrowLeft')
      for (let i = 0; i < 5; i++) step('ArrowUp')
      expect(actions.startCombat).toHaveBeenCalledOnce()
      expect(actions.startCombat).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'wolf-1', name: 'Forest Wolf' }),
      ])

      rerender(
        <MemoryRouter>
          <AdventureHub state={makeState({ combatState })} actions={actions} />
        </MemoryRouter>,
      )
      expect(screen.getByTestId('combat-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('overworld-mode')).not.toBeInTheDocument()

      rerender(
        <MemoryRouter>
          <AdventureHub state={makeState({ combatState: null })} actions={actions} />
        </MemoryRouter>,
      )
      expect(screen.getByTestId('overworld-mode')).toBeInTheDocument()
      expect(screen.getByTestId('overworld-scene')).toHaveAttribute('data-map', 'forest-path')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '3')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '3')
      expect(actions.startCombat).toHaveBeenCalledOnce()

      step('ArrowUp')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '2')
      expect(actions.startCombat).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
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
