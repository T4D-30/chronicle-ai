/**
 * Dialogue Mode Tests — Presentation 3 (Playable Overworld)
 *
 * DialogueWindow mechanics (typewriter, reduced-motion fallback,
 * choices, free-form, close) and OverworldMode orchestration (interact
 * opens dialogue + locks the scene; closing restores movement).
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DialogueWindow } from '@/components/adventure/overworld/DialogueWindow'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

// ─── DialogueWindow ───────────────────────────────────────────────────────────

function renderWindow(props: Partial<Parameters<typeof DialogueWindow>[0]> = {}) {
  const defaults = {
    speaker: 'Brother Aldwin',
    text: 'Peace, traveler.',
    streaming: false,
    suggestedActions: [] as string[],
    busy: false,
    onChoose: vi.fn(),
    onSubmitFree: vi.fn(),
    onClose: vi.fn(),
  }
  const merged = { ...defaults, ...props }
  return { ...render(<DialogueWindow {...merged} />), props: merged }
}

describe('DialogueWindow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows the speaker label', () => {
    renderWindow()
    expect(screen.getByTestId('dialogue-speaker')).toHaveTextContent('Brother Aldwin')
  })

  it('typewrites completed text and can be skipped to full by clicking', () => {
    renderWindow({ text: 'Peace, traveler.' })
    expect(screen.getByTestId('dialogue-text')).not.toHaveTextContent('Peace, traveler.')
    act(() => vi.advanceTimersByTime(18 * 6))
    expect(screen.getByTestId('dialogue-text').textContent?.length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('dialogue-text'))
    expect(screen.getByTestId('dialogue-text')).toHaveTextContent('Peace, traveler.')
  })

  it('renders full text instantly under prefers-reduced-motion', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    renderWindow({ text: 'Peace, traveler.' })
    expect(screen.getByTestId('dialogue-text')).toHaveTextContent('Peace, traveler.')
    window.matchMedia = original
  })

  it('renders streaming text as-is without the typewriter', () => {
    renderWindow({ text: 'The monk considers…', streaming: true })
    expect(screen.getByTestId('dialogue-text')).toHaveTextContent('The monk considers…')
  })

  it('choices call onChoose; free-form submits via onSubmitFree', () => {
    const { props } = renderWindow({
      suggestedActions: ['Ask about the mill'],
      text: 'x',
    })
    fireEvent.click(screen.getByTestId('dialogue-text')) // reveal
    fireEvent.click(screen.getByRole('button', { name: 'Ask about the mill' }))
    expect(props.onChoose).toHaveBeenCalledWith('Ask about the mill')

    fireEvent.change(screen.getByTestId('dialogue-free-input'), { target: { value: 'I bow.' } })
    fireEvent.submit(screen.getByTestId('dialogue-free-input').closest('form')!)
    expect(props.onSubmitFree).toHaveBeenCalledWith('I bow.')
  })

  it('close button calls onClose', () => {
    const { props } = renderWindow()
    fireEvent.click(screen.getByTestId('dialogue-close'))
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})

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
    expect(screen.getByTestId('dialogue-window')).toBeInTheDocument()
    expect(screen.getByTestId('dialogue-speaker')).toHaveTextContent('Brother Aldwin')

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
    fireEvent.click(screen.getByTestId('dialogue-close'))
    expect(screen.queryByTestId('dialogue-window')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '4')
  })
})
