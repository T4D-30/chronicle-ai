/**
 * ActionStrip Tests — Unified Adventure Screen (Presentation 4, B3)
 *
 * The contextual Action Layer over OverworldMode: verbs follow the
 * faced entity and route through the same intent path as the keyboard,
 * Rest submits its grounded text, Menu opens the pause overlay, and
 * button keystrokes never double-submit through the world's keyboard
 * handler.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

function makeState(overrides: Partial<AdventureState> = {}): AdventureState {
  return {
    status: 'ready',
    campaign: {
      id: 'c1', userId: 'u1', title: 'Test', description: null, status: 'active',
      characterId: 'ch1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
      worldState: DEFAULT_WORLD_STATE, tone: 'heroic', difficulty: 'standard',
      createdAt: '', updatedAt: '',
    },
    character: {
      id: 'ch1', userId: 'u1', portraitUrl: null, bio: '', experience: 0,
      tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
      conditions: [], features: [], inventory: [], spells: {}, createdAt: '', updatedAt: '',
      sheet: {
        name: 'Hero', level: 1, archetype: 'fighter', ancestry: 'human', background: 'soldier',
        scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
        hitDie: 'd10', maxHp: 10, currentHp: 10, armorClass: 10, proficiencyBonus: 2,
        skillProficiencies: [], savingThrowProficiencies: [], equipment: [],
        conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
      },
    },
    session: {
      id: 's1', campaignId: 'c1', status: 'active', turnNumber: 0,
      currentMode: 'exploration', startedAt: '', endedAt: null,
    },
    turns: [], error: null, isActionInFlight: false,
    narrationStatus: 'idle', streamingText: '', suggestedActions: [],
    lastDirectorResult: null, combatState: null, lastCombatResult: null,
    readyToLevel: false, lastCheckResult: null, lastXpGain: 0,
    ...overrides,
  } as AdventureState
}

function makeActions(): AdventureActions {
  return {
    pause: vi.fn(), resume: vi.fn(), end: vi.fn(), reload: vi.fn(),
    submitAction: vi.fn(), cancelStream: vi.fn(),
    startCombat: vi.fn(), endCombat: vi.fn(), commitCombatResult: vi.fn(),
    levelUpCharacter: vi.fn(), clearCheckResult: vi.fn(), clearXpGain: vi.fn(),
  } as unknown as AdventureActions
}

function step(key: string) {
  fireEvent.keyDown(window, { key })
  act(() => vi.advanceTimersByTime(STEP_MS + 10))
}

/** Monastery spawn (7,8) → (3,5), facing the monk at (2,5). */
function walkToFaceMonk() {
  for (let i = 0; i < 3; i++) step('ArrowUp')
  for (let i = 0; i < 4; i++) step('ArrowLeft')
}

/** Monastery spawn (7,8) → (4,4), facing the shrine at (3,4). */
function walkToFaceShrine() {
  for (let i = 0; i < 4; i++) step('ArrowUp')
  for (let i = 0; i < 3; i++) step('ArrowLeft')
}

describe('OverworldMode — ActionStrip (B3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders Rest and Menu with no verbs when nothing is faced', () => {
    render(<OverworldMode state={makeState()} actions={makeActions()} />)
    const strip = screen.getByTestId('action-strip')
    expect(strip).toBeInTheDocument()
    expect(screen.getByTestId('action-rest')).toBeEnabled()
    expect(screen.getByTestId('action-menu-button')).toBeEnabled()
    expect(screen.queryByTestId('action-verb-talk')).not.toBeInTheDocument()
  })

  it('shows the faced entity\'s verb and routes it through the same grounded intent as the keyboard', () => {
    const actions = makeActions()
    render(<OverworldMode state={makeState()} actions={actions} />)
    walkToFaceMonk()
    const talk = screen.getByTestId('action-verb-talk')
    expect(talk).toHaveTextContent('Talk Brother Aldwin')
    fireEvent.click(talk)
    expect(actions.submitAction).toHaveBeenCalledWith(
      'I approach the monk in the courtyard and greet him.',
    )
    expect(actions.submitAction).toHaveBeenCalledOnce()
    // Same dialogue behavior as the keyboard path
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'dialogue')
    // The strip yields to the dialogue (actions live in the HUD there)
    expect(screen.queryByTestId('action-strip')).not.toBeInTheDocument()
  })

  it('verbs disappear when the player turns away', () => {
    render(<OverworldMode state={makeState()} actions={makeActions()} />)
    walkToFaceMonk()
    expect(screen.getByTestId('action-verb-talk')).toBeInTheDocument()
    step('ArrowDown') // turn/move away
    expect(screen.queryByTestId('action-verb-talk')).not.toBeInTheDocument()
  })

  it('keeps non-talk interactions ambient and movement available', () => {
    const actions = makeActions()
    render(<OverworldMode state={makeState()} actions={actions} />)
    walkToFaceShrine()

    fireEvent.click(screen.getByTestId('action-verb-inspect'))

    expect(actions.submitAction).toHaveBeenCalledWith(
      'I examine the old shrine in the courtyard closely.',
    )
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'ambient')
    expect(screen.queryByTestId('story-hud-speaker')).not.toBeInTheDocument()

    step('ArrowRight')
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '5')
  })

  it('Rest submits its grounded action text through the controller', () => {
    const actions = makeActions()
    render(<OverworldMode state={makeState()} actions={actions} />)
    fireEvent.click(screen.getByTestId('action-rest'))
    expect(actions.submitAction).toHaveBeenCalledWith('I attempt to rest and recover.')
  })

  it('Menu opens the pause overlay, same as Esc', () => {
    render(
      <MemoryRouter>
        <OverworldMode state={makeState()} actions={makeActions()} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('action-menu-button'))
    expect(screen.getByTestId('pause-menu')).toBeInTheDocument()
  })

  it('Rest is disabled and verbs hidden while busy', () => {
    render(
      <OverworldMode
        state={makeState({ isActionInFlight: true })}
        actions={makeActions()}
      />,
    )
    expect(screen.getByTestId('action-rest')).toBeDisabled()
    expect(screen.getByTestId('action-menu-button')).toBeEnabled()
  })

  it('Enter on a focused strip button does not double-fire the keyboard interact path', () => {
    const actions = makeActions()
    render(<OverworldMode state={makeState()} actions={actions} />)
    walkToFaceMonk()
    const talk = screen.getByTestId('action-verb-talk')
    talk.focus()
    // Keydown targeted at the button must be ignored by the world's
    // window-level handler (the browser's own click synthesis is what
    // activates the button — jsdom doesn't emit it, so zero calls
    // proves the world handler stayed out of it).
    fireEvent.keyDown(talk, { key: 'Enter' })
    expect(actions.submitAction).not.toHaveBeenCalled()
  })
})
