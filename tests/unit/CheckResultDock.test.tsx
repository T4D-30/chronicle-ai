/**
 * CheckResultDock Tests — Unified Check Result Feedback
 *
 * Full dice transparency (Law 6) restored on the unified Adventure
 * screen. Ports the dice-popup suite that covered StoryPanel's
 * CheckResultPopup before the unified-screen cleanup: real engine
 * summaries (never hand-typed fixtures), the spoken roll math, crit/
 * fumble markers, the 4200 ms auto-dismiss window, and the new manual
 * dismiss. Plus OverworldMode integration: the dock renders over the
 * world from the existing lastCheckResult state and never locks
 * movement.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CheckResultDock, CHECK_RESULT_DISMISS_MS } from '@/components/adventure/overworld/CheckResultDock'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import { buildCharacter, resolveCharacterAction, summariseCharacterAction, setRng, resetRng } from '@/lib/engine'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

/** Builds a real ResolutionSummary via the actual engine resolver — not a
    hand-typed fixture — so dock tests exercise genuine data shapes. */
function makeCheckResult(rngValue: number) {
  setRng(() => rngValue)
  const character = buildCharacter({
    name: 'Aldric Sorn', level: 3, archetype: 'rogue', ancestry: 'human',
    background: 'criminal',
    scores: { strength: 10, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 },
  })
  const result = resolveCharacterAction({
    character, intent: 'I sneak past the guards', dc: 15,
  })
  resetRng()
  return summariseCharacterAction(result.resolution!)
}

describe('CheckResultDock', () => {
  it('renders the real resolved stat, DC, and total — not invented numbers', () => {
    const checkResult = makeCheckResult(0.5)
    render(<CheckResultDock result={checkResult} onDismiss={vi.fn()} />)

    expect(screen.getByText('DEX Check')).toBeInTheDocument()
    expect(screen.getByText(`DC ${checkResult.dc}`)).toBeInTheDocument()
    expect(screen.getByText(String(checkResult.roll.total))).toBeInTheDocument()
  })

  it('shows the outcome label from the real resolution, not a guess', () => {
    const checkResult = makeCheckResult(0.5)
    render(<CheckResultDock result={checkResult} onDismiss={vi.fn()} />)
    expect(screen.getByText(new RegExp(checkResult.outcomeLabel))).toBeInTheDocument()
  })

  it('shows Critical styling text on a natural 20', () => {
    const checkResult = makeCheckResult(0.999) // forces d20 face 20
    render(<CheckResultDock result={checkResult} onDismiss={vi.fn()} />)
    expect(screen.getByText(/Critical!/i)).toBeInTheDocument()
  })

  it('shows Fumble styling text on a natural 1', () => {
    const checkResult = makeCheckResult(0.001) // forces d20 face 1
    render(<CheckResultDock result={checkResult} onDismiss={vi.fn()} />)
    expect(screen.getByText(/Fumble\./i)).toBeInTheDocument()
  })

  it('has a full accessible description with all the roll math (dice transparency for screen readers)', () => {
    const checkResult = makeCheckResult(0.5)
    render(<CheckResultDock result={checkResult} onDismiss={vi.fn()} />)
    const dock = screen.getByRole('status', { name: new RegExp(`DEX check.*DC ${checkResult.dc}`, 'i') })
    expect(dock).toBeInTheDocument()
  })

  it('auto-dismisses via onDismiss after its display window, not before', () => {
    vi.useFakeTimers()
    try {
      const onDismiss = vi.fn()
      render(<CheckResultDock result={makeCheckResult(0.5)} onDismiss={onDismiss} />)

      vi.advanceTimersByTime(CHECK_RESULT_DISMISS_MS - 200)
      expect(onDismiss).not.toHaveBeenCalled()
      vi.advanceTimersByTime(300)
      expect(onDismiss).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('the dismiss button is keyboard-reachable and calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(<CheckResultDock result={makeCheckResult(0.5)} onDismiss={onDismiss} />)
    const btn = screen.getByRole('button', { name: 'Dismiss check result' })
    btn.focus()
    expect(btn).toHaveFocus()
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

// ─── OverworldMode integration ───────────────────────────────────────────────

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

describe('OverworldMode — check-result dock integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders the dock over the world when lastCheckResult is set, and nothing when null', () => {
    const { rerender } = render(
      <OverworldMode state={makeState()} actions={makeActions()} />,
    )
    expect(screen.queryByTestId('check-result-dock')).not.toBeInTheDocument()

    rerender(
      <OverworldMode state={makeState({ lastCheckResult: makeCheckResult(0.5) })} actions={makeActions()} />,
    )
    expect(screen.getByTestId('check-result-dock')).toBeInTheDocument()
    // The world stays mounted and primary
    expect(screen.getByTestId('overworld-scene')).toBeInTheDocument()
  })

  it('does not lock movement while the dock is visible', () => {
    render(
      <OverworldMode state={makeState({ lastCheckResult: makeCheckResult(0.5) })} actions={makeActions()} />,
    )
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '7')
  })

  it('dismissal routes through the existing actions.clearCheckResult contract', () => {
    const actions = makeActions()
    render(
      <OverworldMode state={makeState({ lastCheckResult: makeCheckResult(0.5) })} actions={actions} />,
    )
    fireEvent.click(screen.getByTestId('check-result-dismiss'))
    expect(actions.clearCheckResult).toHaveBeenCalledOnce()
  })
})
