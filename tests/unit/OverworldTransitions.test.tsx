/**
 * Area Transition Tests — Presentation 3 (Playable Overworld)
 *
 * Walking onto the forest gate: emits the exit intent (grounded
 * named-location text through submitAction — the ONLY persistence
 * path), fades to black, swaps to the forest map at the destination
 * spawn, fades back, and restores movement. Also: the forest map is
 * valid and stepping onto its ambush tile fires the encounter intent.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import { TRANSITION_PHASE_MS } from '@/components/adventure/overworld/WorldTransition'
import { forestPath } from '@/components/adventure/overworld/maps/forestPath'
import { validateMap } from '@/components/adventure/overworld/overworldTypes'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

function makeState(): AdventureState {
  return {
    status: 'ready',
    campaign: {
      id: 'c1', userId: 'u1', title: 'Test', description: null, status: 'active',
      characterId: 'ch1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
      worldState: DEFAULT_WORLD_STATE, tone: 'heroic', difficulty: 'standard',
      createdAt: '', updatedAt: '',
    },
    character: null, session: {
      id: 's1', campaignId: 'c1', status: 'active', turnNumber: 0,
      currentMode: 'exploration', startedAt: '', endedAt: null,
    },
    turns: [], error: null, isActionInFlight: false,
    narrationStatus: 'idle', streamingText: '', suggestedActions: [],
    lastDirectorResult: null, combatState: null, lastCombatResult: null,
    readyToLevel: false, lastCheckResult: null, lastXpGain: 0,
  } as unknown as AdventureState
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
  act(() => {
    vi.advanceTimersByTime(STEP_MS + 10)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Forest Path fixture', () => {
  it('is a valid map with the return exit and one encounter trigger', () => {
    expect(validateMap(forestPath)).toEqual([])
    expect(forestPath.encounters).toHaveLength(1)
    expect(forestPath.exits[0].to).toBe('monastery-courtyard')
  })
})

describe('OverworldMode — area transitions', () => {
  function walkToGate() {
    // Spawn (7,8); gate at (6,0). Up the path: left 1, then up 8.
    step('ArrowLeft')
    for (let i = 0; i < 8; i++) step('ArrowUp')
  }

  it('walking onto the forest gate: exit intent → fade → forest map at the right spawn', () => {
    const actions = makeActions()
    render(
      <div style={{ width: 600, height: 400 }}>
        <OverworldMode state={makeState()} actions={actions} />
      </div>,
    )
    expect(screen.getByTestId('overworld-scene')).toHaveAttribute('data-map', 'monastery-courtyard')

    walkToGate()

    // Named-location persistence path: the grounded text via submitAction
    expect(actions.submitAction).toHaveBeenCalledWith(
      'I pass through the forest gate and follow the path into the woods.',
    )

    // Fading out over the courtyard
    expect(screen.getByTestId('world-transition')).toHaveAttribute('data-phase', 'out')

    // At full black: swap; then fade in
    act(() => {
      vi.advanceTimersByTime(TRANSITION_PHASE_MS + 5)
    })
    expect(screen.getByTestId('overworld-scene')).toHaveAttribute('data-map', 'forest-path')
    expect(screen.getByTestId('world-transition')).toHaveAttribute('data-phase', 'in')
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '5')
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '10')

    // Clear; movement restored
    act(() => {
      vi.advanceTimersByTime(TRANSITION_PHASE_MS + 5)
    })
    expect(screen.queryByTestId('world-transition')).not.toBeInTheDocument()
    step('ArrowUp')
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '9')
  })

  it('movement is locked during the fade', () => {
    const actions = makeActions()
    render(
      <div style={{ width: 600, height: 400 }}>
        <OverworldMode state={makeState()} actions={actions} />
      </div>,
    )
    walkToGate()
    // mid-fade — input ignored
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '0')
  })

  it('reaching the ambush tile in the forest fires the encounter through startCombat', () => {
    const actions = makeActions()
    render(
      <div style={{ width: 600, height: 400 }}>
        <OverworldMode state={makeState()} actions={actions} />
      </div>,
    )
    walkToGate()
    // Two acts: the 'in' timer is only scheduled once the swap commits.
    act(() => {
      vi.advanceTimersByTime(TRANSITION_PHASE_MS + 5)
    })
    act(() => {
      vi.advanceTimersByTime(TRANSITION_PHASE_MS + 5)
    })
    expect(screen.queryByTestId('world-transition')).not.toBeInTheDocument()
    expect(screen.getByTestId('overworld-scene')).toHaveAttribute('data-map', 'forest-path')

    // Forest spawn (5,10) → ambush at (3,3): navigate the winding path.
    for (let i = 0; i < 2; i++) step('ArrowUp')   // (5,8)
    step('ArrowLeft')                              // (4,8) grass? row8='T..ppp...T' → x4 = p ✓... walk plan below
    step('ArrowLeft')                              // (3,8)
    for (let i = 0; i < 5; i++) step('ArrowUp')    // (3,3)
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-x', '3')
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '3')
    expect(actions.startCombat).toHaveBeenCalledOnce()
  })
})
