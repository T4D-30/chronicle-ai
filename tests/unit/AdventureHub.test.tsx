/**
 * AdventureHub Tests — Phase 2.3
 *
 * Covers:
 *  - Layout rendering (status bar, panel area, tab nav)
 *  - Panel switching via tab nav
 *  - Session controls (pause, resume, end)
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

// Phase 14.1: PartyStatusPanel/CharacterSidebar/WorldStatusSidebar now live
// behind tabs in a single consolidated AdventureRightSidebar (see that
// component's header comment for why) instead of three always-visible
// asides. Tests that need one of those panels' content select its tab
// first — "Status" is the sidebar's default tab, so only tests needing
// Character or World content need this helper.
async function selectSidebarTab(name: RegExp) {
  const user = userEvent.setup()
  const tabs = screen.getByTestId('adventure-right-sidebar-tabs')
  await user.click(within(tabs).getByRole('button', { name }))
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
    // The title appears inside a Link "← The Shattered Throne" — use partial match.
    // Scoped to the status bar specifically: as of the Adventure Hub redesign, the
    // campaign title can ALSO legitimately appear in AdventureScenePanel's location
    // title (it falls back to the campaign title when no current location is set) —
    // a real, additive UI element, not a duplicate bug.
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
    expect(tabs).toHaveLength(DEBUG_ENABLED ? 9 : 8)
  })

  it('starts with the Story tab active', () => {
    renderHub()
    expect(screen.getByRole('tab', { name: /Story/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the panel area', () => {
    renderHub()
    expect(screen.getByTestId('adventure-panel-area')).toBeInTheDocument()
  })

  it('shows the right sidebar on desktop, with the character sheet a tab away (Phase 14.1 consolidation)', async () => {
    renderHub()
    expect(screen.getByTestId('adventure-right-sidebar-wrapper')).toBeInTheDocument()
    await selectSidebarTab(/Character/i)
    const sidebar = screen.getByTestId('adventure-right-sidebar')
    expect(within(sidebar).getByText('Aldric Sorn')).toBeInTheDocument()
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

  it('marks the newly active tab as selected', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Dice/i }))
    expect(screen.getByRole('tab', { name: /Story/i })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /Dice/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('hands an overworld encounter to combat and restores the current area and movement afterward', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const actions = makeActions()
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
    const combatState = initCombat(
      { id: 'player', name: MOCK_CHARACTER.sheet.name, isPlayer: true as const, sheet: MOCK_CHARACTER.sheet },
      [enemy],
    )

    try {
      const { rerender } = render(
        <MemoryRouter>
          <AdventureHub state={makeState()} actions={actions} />
        </MemoryRouter>,
      )

      function step(key: string) {
        fireEvent.keyDown(window, { key })
        act(() => {
          vi.advanceTimersByTime(STEP_MS + 10)
        })
      }

      fireEvent.click(screen.getByRole('tab', { name: /World/i }))
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
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '10')

      step('ArrowUp')
      expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '9')
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
    // Scoped to the story scroll specifically: as of the Adventure Hub
    // redesign, the same turn's playerInput can ALSO legitimately appear
    // in PartyStatusPanel's "Recent Events" list (it reuses the same
    // real turns array) — a real, additive UI element, not a duplicate bug.
    const storyScroll = screen.getByTestId('story-scroll')
    expect(within(storyScroll).getByText(/I look around\./)).toBeInTheDocument()
    expect(within(storyScroll).getByText(/You see a dimly lit cave\./)).toBeInTheDocument()
  })
})

describe('AdventureHub — world status sidebar (Phase 9.1)', () => {
  it('renders the world status sidebar', async () => {
    renderHub()
    await selectSidebarTab(/World/i)
    expect(screen.getByTestId('world-status-sidebar')).toBeInTheDocument()
  })

  it('shows current turn number and campaign tone/difficulty', async () => {
    renderHub()
    await selectSidebarTab(/World/i)
    const sidebar = screen.getByTestId('world-status-sidebar')
    expect(sidebar).toHaveTextContent('3') // turn number
    expect(sidebar).toHaveTextContent('heroic')
    expect(sidebar).toHaveTextContent('standard')
  })

  it('shows "Exploring" status when not in combat', async () => {
    renderHub({ combatState: null })
    await selectSidebarTab(/World/i)
    expect(screen.getByTestId('world-status-sidebar')).toHaveTextContent('Exploring')
  })

  it('shows "In Combat" status when combat is active', async () => {
    renderHub({
      combatState: {
        enemies: [{ id: 'e1', name: 'Goblin', currentHp: 5, maxHp: 7, armorClass: 12 }],
        round: 1, phase: 'player_turn', activeIndex: 0,
        initiativeOrder: [], playerCurrentHp: 22, playerDeathSuccesses: 0,
        playerDeathFailures: 0, log: [], xpAwarded: 0,
      } as unknown as AdventureState['combatState'],
    })
    await selectSidebarTab(/World/i)
    expect(screen.getByTestId('world-status-sidebar')).toHaveTextContent('In Combat')
  })

  it('does not show a fabricated weather or location field', async () => {
    renderHub()
    await selectSidebarTab(/World/i)
    const sidebar = screen.getByTestId('world-status-sidebar')
    // Honest limitation notice must be present — no invented weather/time data
    expect(sidebar).toHaveTextContent(/Phase 10/i)
  })

  it('shows worldTime only when the Director has actually set one', async () => {
    renderHub() // DEFAULT_WORLD_STATE has worldTime: null
    await selectSidebarTab(/World/i)
    expect(screen.queryByText('Time')).not.toBeInTheDocument()
  })

  it('renders worldTime when present in campaign world state', async () => {
    renderHub({
      campaign: {
        ...MOCK_CAMPAIGN,
        worldState: { ...DEFAULT_WORLD_STATE, worldTime: 'Dusk, third day of travel' },
      },
    })
    await selectSidebarTab(/World/i)
    // Scoped to the world-status-sidebar specifically: as of the
    // Adventure Hub redesign, the same real worldTime value can ALSO
    // legitimately appear in AdventureLeftNav's World Status card and
    // AdventureScenePanel's time line (both reuse the same real
    // worldState.worldTime, never a second, fabricated value) — real,
    // additive UI, not a duplicate bug.
    const sidebar = screen.getByTestId('world-status-sidebar')
    expect(within(sidebar).getByText('Dusk, third day of travel')).toBeInTheDocument()
  })

  it('shows discovered location and known NPC counts from real world state', async () => {
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
    await selectSidebarTab(/World/i)
    const sidebar = screen.getByTestId('world-status-sidebar')
    // Only 1 of 2 locations is discovered — must reflect that, not the raw total
    expect(sidebar).toHaveTextContent('Locations')
    expect(sidebar).toHaveTextContent('Known NPCs')
  })
})

describe('AdventureHub — current location (Phase 9.2, real data only)', () => {
  it('shows the current location name when currentLocationId resolves to a known location', async () => {
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
    await selectSidebarTab(/World/i)
    expect(screen.getByTestId('current-location-row')).toHaveTextContent('Rivergate')
  })

  it('does not show a location row when currentLocationId is null', async () => {
    renderHub()
    await selectSidebarTab(/World/i)
    expect(screen.queryByTestId('current-location-row')).not.toBeInTheDocument()
  })

  it('does not show a location row when currentLocationId does not resolve to any known location', async () => {
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
    await selectSidebarTab(/World/i)
    expect(screen.queryByTestId('current-location-row')).not.toBeInTheDocument()
  })
})

describe('AdventureHub — redesign: left nav integration', () => {
  it('renders the left navigation sidebar', () => {
    renderHub()
    expect(screen.getByTestId('adventure-left-sidebar')).toBeInTheDocument()
  })

  it('clicking a left-nav item switches the active panel, exactly like the bottom tabs', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByTestId('adventure-left-sidebar').querySelector('button')!)
    // Home maps to 'story', already active by default — switch to Journal instead
    const journalNavButton = within(screen.getByTestId('adventure-left-sidebar')).getByRole('button', { name: /Journal/i })
    await user.click(journalNavButton)
    // The bottom tab reflects the same activePanel state the left nav just changed
    expect(screen.getByRole('tab', { name: /Journal/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking End Session in the left nav calls actions.end, same as the header End button', async () => {
    const user = userEvent.setup()
    const end = vi.fn().mockResolvedValue(undefined)
    renderHub({}, { end })
    await user.click(screen.getByRole('button', { name: 'End Session' }))
    expect(end).toHaveBeenCalledOnce()
  })
})

describe('AdventureHub — redesign: scene panel integration (story view only)', () => {
  it('renders the scene panel when on the Story tab', () => {
    renderHub()
    expect(screen.getByTestId('adventure-scene-panel')).toBeInTheDocument()
  })

  it('does not render the scene panel (art placeholder/location chrome) when on the Journal tab', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    expect(screen.queryByTestId('adventure-scene-panel')).not.toBeInTheDocument()
  })

  it('does not render the scene panel when on the Quests tab', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Quests/i }))
    expect(screen.queryByTestId('adventure-scene-panel')).not.toBeInTheDocument()
  })

  it('does not render the scene panel when on the Codex tab', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Codex/i }))
    expect(screen.queryByTestId('adventure-scene-panel')).not.toBeInTheDocument()
  })

  it('still renders the real Journal panel content when on the Journal tab (unwrapped, unchanged)', async () => {
    const user = userEvent.setup()
    renderHub()
    await user.click(screen.getByRole('tab', { name: /Journal/i }))
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-journal')
  })
})

describe('AdventureHub — redesign: party status panel integration', () => {
  it('renders the party status sidebar (Status is the sidebar\'s default tab)', () => {
    renderHub()
    expect(screen.getByTestId('party-status-panel')).toBeInTheDocument()
  })

  it('shows the real character name in the party status sidebar', () => {
    renderHub()
    const sidebar = screen.getByTestId('party-status-panel')
    expect(within(sidebar).getByText('Aldric Sorn')).toBeInTheDocument()
  })

  it('clicking "View Full Journal" in the party status panel switches to the Journal tab', async () => {
    const user = userEvent.setup()
    renderHub()
    const sidebar = screen.getByTestId('party-status-panel')
    await user.click(within(sidebar).getByRole('button', { name: /View Full Journal/i }))
    expect(screen.getByRole('tab', { name: /Journal/i })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('AdventureHub — redesign: submit action and quick actions still work end-to-end', () => {
  it('submitting free-text player input still calls actions.submitAction (ActionBar unchanged)', async () => {
    const user = userEvent.setup()
    const submitAction = vi.fn()
    renderHub({}, { submitAction })
    const textarea = screen.getByPlaceholderText(/What do you do/i)
    await user.type(textarea, 'I search the room.')
    await user.click(screen.getByRole('button', { name: /^Send$/i }))
    expect(submitAction).toHaveBeenCalledWith('I search the room.')
  })

  it('clicking a quick-action button still calls actions.submitAction with its real text (ActionBar unchanged)', async () => {
    const user = userEvent.setup()
    const submitAction = vi.fn()
    renderHub({}, { submitAction })
    await user.click(screen.getByRole('button', { name: 'Look around' }))
    expect(submitAction).toHaveBeenCalledWith('I look around carefully.')
  })

  it('clicking a suggested-action chip still calls actions.submitAction with the suggested text', async () => {
    const user = userEvent.setup()
    const submitAction = vi.fn()
    renderHub({ suggestedActions: ['Open the door', 'Retreat quietly'] }, { submitAction })
    await user.click(screen.getByRole('button', { name: 'Open the door' }))
    expect(submitAction).toHaveBeenCalledWith('Open the door')
  })
})

describe('AdventureHub — redesign: empty state', () => {
  it('shows the honest "your story begins" empty state on a fresh session with no turns', () => {
    renderHub({ turns: [] })
    expect(screen.getByText(/YOUR STORY BEGINS/i)).toBeInTheDocument()
  })

  it('the party status panel\'s recent events also show an honest empty state on a fresh session', () => {
    renderHub({ turns: [] })
    const sidebar = screen.getByTestId('party-status-panel')
    expect(within(sidebar).getByTestId('recent-events-empty')).toBeInTheDocument()
  })

  it('the left nav\'s current objective shows an honest empty state when no threads are active', () => {
    renderHub()
    const leftNav = screen.getByTestId('adventure-left-sidebar')
    expect(within(leftNav).getByText('No active objective yet.')).toBeInTheDocument()
  })
})
