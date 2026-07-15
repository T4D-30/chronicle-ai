/**
 * Dialogue Mode Tests — Unified Adventure Screen
 *
 * OverworldMode orchestration through the StoryHud surface: a talk
 * intent opens dialogue and locks the scene; closing restores
 * movement; ambient beats never lock movement and old turns never
 * replay as fresh. (StoryHud's own component mechanics live in
 * StoryHud.test.tsx; the superseded DialogueWindow and its block were
 * removed in the unified-screen cleanup.)
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

// ─── OverworldMode orchestration ─────────────────────────────────────────────

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

describe('OverworldMode — dialogue orchestration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => { vi.useRealTimers() })

  function walkToMonkAndTalk() {
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: 'ArrowUp' })
      act(() => vi.advanceTimersByTime(STEP_MS + 10))
    }
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      act(() => vi.advanceTimersByTime(STEP_MS + 10))
    }
    fireEvent.keyDown(window, { key: 'e' })
  }

  it('a talk intent submits the grounded text, opens dialogue, and locks movement', () => {
    const actions = makeActions()
    render(
      <div style={{ width: 600, height: 400 }}>
        <OverworldMode state={makeState()} actions={actions} />
      </div>,
    )
    walkToMonkAndTalk()
    expect(actions.submitAction).toHaveBeenCalledWith(
      'I approach the monk in the courtyard and greet him.',
    )
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'dialogue')
    expect(screen.getByTestId('story-hud-speaker')).toHaveTextContent('Brother Aldwin')

    // Movement is frozen while the dialogue is open
    const before = screen.getByTestId('overworld-player').getAttribute('data-x')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', before!)
  })

  it('closing the dialogue restores movement', () => {
    const actions = makeActions()
    render(
      <div style={{ width: 600, height: 400 }}>
        <OverworldMode state={makeState()} actions={actions} />
      </div>,
    )
    walkToMonkAndTalk()
    fireEvent.click(screen.getByTestId('story-hud-close'))
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'ambient')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '4')
  })
})

// ─── StoryHud ambient orchestration (B2) ─────────────────────────────────────

describe('OverworldMode — ambient story beats (B2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => { vi.useRealTimers() })

  const TURN = {
    id: 't1', sessionId: 's1', turnNumber: 0, playerInput: 'I head out.',
    aiNarration: 'The gate creaks open onto the forest path.', diceRolls: [],
    mode: 'exploration' as const, createdAt: '',
  }

  it('the HUD is always present, collapsed to the input strip when idle', () => {
    render(<OverworldMode state={makeState()} actions={makeActions()} />)
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'ambient')
    expect(screen.queryByTestId('story-hud-text')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('What do you do?')).toBeInTheDocument()
  })

  it('does NOT replay turns that existed at mount as fresh narration', () => {
    render(<OverworldMode state={makeState({ turns: [TURN] })} actions={makeActions()} />)
    expect(screen.queryByTestId('story-hud-text')).not.toBeInTheDocument()
  })

  it('shows a turn that arrives after mount as the current beat, without locking movement', () => {
    const actions = makeActions()
    const { rerender } = render(<OverworldMode state={makeState()} actions={actions} />)
    rerender(<OverworldMode state={makeState({ turns: [TURN] })} actions={actions} />)

    fireEvent.click(screen.getByTestId('story-hud-text')) // skip typewriter
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent(
      'The gate creaks open onto the forest path.',
    )
    // Ambient narration must NOT freeze the player
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '7')
  })

  it('dismissing a beat collapses the HUD and the beat does not return', () => {
    const actions = makeActions()
    const { rerender } = render(<OverworldMode state={makeState()} actions={actions} />)
    rerender(<OverworldMode state={makeState({ turns: [TURN] })} actions={actions} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss narration' }))
    expect(screen.queryByTestId('story-hud-text')).not.toBeInTheDocument()
    rerender(<OverworldMode state={makeState({ turns: [TURN] })} actions={actions} />)
    expect(screen.queryByTestId('story-hud-text')).not.toBeInTheDocument()
  })

  it('shows streaming text live in the ambient HUD (movement locked by busy rule)', () => {
    render(
      <OverworldMode
        state={makeState({ narrationStatus: 'streaming', streamingText: 'A cold wind ri' })}
        actions={makeActions()}
      />,
    )
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('A cold wind ri')
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '8')
  })

  it('free-form actions from the HUD submit through the controller contract', () => {
    const actions = makeActions()
    render(<OverworldMode state={makeState()} actions={actions} />)
    fireEvent.change(screen.getByTestId('story-hud-free-input'), { target: { value: 'I listen at the door.' } })
    fireEvent.submit(screen.getByTestId('story-hud-free-input').closest('form')!)
    expect(actions.submitAction).toHaveBeenCalledWith('I listen at the door.')
  })

  it('typing movement keys into the HUD input does not move the player', () => {
    render(<OverworldMode state={makeState()} actions={makeActions()} />)
    const input = screen.getByTestId('story-hud-free-input')
    input.focus()
    fireEvent.keyDown(input, { key: 'w' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '8')
  })
})
