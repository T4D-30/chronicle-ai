/**
 * OverworldScene Tests — Presentation 3 (Playable Overworld)
 *
 * Movement, collision, facing, and the input lock — exercised through
 * real keyboard events against the real Monastery Courtyard fixture.
 * The step timer is bypassed with fake timers where needed.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OverworldScene } from '@/components/adventure/overworld/OverworldScene'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import { monasteryCourtyard } from '@/components/adventure/overworld/maps/monasteryCourtyard'

function renderScene(props: Partial<Parameters<typeof OverworldScene>[0]> = {}) {
  return render(
    <div style={{ width: 600, height: 400 }}>
      <OverworldScene map={monasteryCourtyard} spawnId="start" {...props} />
    </div>,
  )
}

function player() {
  return screen.getByTestId('overworld-player')
}

function pressAndSettle(key: string) {
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

describe('OverworldScene — rendering', () => {
  it('renders the map, entities, exit marker, and the player at the spawn', () => {
    renderScene()
    expect(screen.getByTestId('overworld-tilemap')).toBeInTheDocument()
    expect(screen.getByTestId('overworld-entity-monk')).toBeInTheDocument()
    expect(screen.getByTestId('overworld-entity-shrine')).toBeInTheDocument()
    expect(screen.getByTestId('overworld-entity-herb-patch')).toBeInTheDocument()
    expect(screen.getByTestId('overworld-exit-forest-gate')).toBeInTheDocument()
    expect(player()).toHaveAttribute('data-x', '7')
    expect(player()).toHaveAttribute('data-y', '8')
    expect(player()).toHaveAttribute('data-facing', 'up')
  })

  it('the player renders the real character sprite', () => {
    renderScene()
    expect(screen.getByTestId('player-sprite')).toBeInTheDocument()
  })
})

describe('OverworldScene — movement (4-direction, grid-stepped)', () => {
  it('moves one tile per keypress on walkable ground (arrows and WASD)', () => {
    renderScene()
    pressAndSettle('ArrowUp')
    expect(player()).toHaveAttribute('data-y', '7')
    pressAndSettle('w')
    expect(player()).toHaveAttribute('data-y', '6')
    pressAndSettle('ArrowLeft')
    expect(player()).toHaveAttribute('data-x', '6')
    pressAndSettle('d')
    expect(player()).toHaveAttribute('data-x', '7')
  })

  it('gates repeated input to one step per step-window', () => {
    renderScene()
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowUp' }) // within the same window
    expect(player()).toHaveAttribute('data-y', '7')
    act(() => {
      vi.advanceTimersByTime(STEP_MS + 10)
    })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(player()).toHaveAttribute('data-y', '6')
  })

  it('collides with walls — turns but does not move', () => {
    renderScene()
    // Walk to the left wall: x from 7 down to 1
    for (let i = 0; i < 6; i++) pressAndSettle('ArrowLeft')
    expect(player()).toHaveAttribute('data-x', '1')
    pressAndSettle('ArrowLeft') // wall at x=0
    expect(player()).toHaveAttribute('data-x', '1')
    expect(player()).toHaveAttribute('data-facing', 'left')
  })

  it('collides with blocking entities (the shrine)', () => {
    renderScene()
    // Path from (7,8): up 4 → (7,4); left 3 → (4,4); shrine at (3,4)
    for (let i = 0; i < 4; i++) pressAndSettle('ArrowUp')
    for (let i = 0; i < 3; i++) pressAndSettle('ArrowLeft')
    expect(player()).toHaveAttribute('data-x', '4')
    expect(player()).toHaveAttribute('data-y', '4')
    pressAndSettle('ArrowLeft')
    expect(player()).toHaveAttribute('data-x', '4') // blocked by shrine
    expect(player()).toHaveAttribute('data-facing', 'left') // but faced it
  })

  it('locked freezes movement and turning entirely', () => {
    renderScene({ locked: true })
    pressAndSettle('ArrowLeft')
    expect(player()).toHaveAttribute('data-x', '7')
    expect(player()).toHaveAttribute('data-facing', 'up') // spawn facing kept
  })
})

describe('OverworldScene — camera', () => {
  it('renders the clamped scrolling camera around the world', () => {
    renderScene()
    expect(screen.getByTestId('overworld-viewport')).toBeInTheDocument()
    expect(screen.getByTestId('overworld-camera')).toBeInTheDocument()
  })
})

describe('OverworldScene — interactions (typed intents only)', () => {
  function walkToMonk() {
    // Spawn (7,8) → up 3 to (7,5) → left toward monk at (2,5); stop at (3,5)
    for (let i = 0; i < 3; i++) pressAndSettle('ArrowUp')
    for (let i = 0; i < 4; i++) pressAndSettle('ArrowLeft')
  }

  it('shows the interaction prompt when facing an entity, hides it otherwise', () => {
    renderScene()
    expect(screen.queryByTestId('interaction-prompt')).not.toBeInTheDocument()
    walkToMonk()
    expect(player()).toHaveAttribute('data-x', '3')
    expect(player()).toHaveAttribute('data-facing', 'left')
    expect(screen.getByTestId('interaction-prompt')).toHaveTextContent('Talk')
    expect(screen.getByTestId('overworld-entity-monk')).toHaveAttribute('data-faced', 'true')
  })

  it('pressing E while facing the monk emits a talk intent with the fixture text', () => {
    const onIntent = vi.fn()
    renderScene({ onIntent })
    walkToMonk()
    fireEvent.keyDown(window, { key: 'e' })
    expect(onIntent).toHaveBeenCalledWith({
      type: 'interact',
      verb: 'talk',
      entityId: 'monk',
      entityName: 'Brother Aldwin',
      text: 'I approach the monk in the courtyard and greet him.',
    })
  })

  it('Enter and Space also interact; nothing emits when facing empty ground', () => {
    const onIntent = vi.fn()
    renderScene({ onIntent })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: ' ' })
    expect(onIntent).not.toHaveBeenCalled() // facing empty path at spawn
    walkToMonk()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onIntent).toHaveBeenCalledTimes(1)
  })

  it('locked suppresses interaction and the prompt', () => {
    const onIntent = vi.fn()
    const { rerender } = render(
      <div style={{ width: 600, height: 400 }}>
        <OverworldScene map={monasteryCourtyard} spawnId="start" onIntent={onIntent} />
      </div>,
    )
    walkToMonk()
    rerender(
      <div style={{ width: 600, height: 400 }}>
        <OverworldScene map={monasteryCourtyard} spawnId="start" onIntent={onIntent} locked />
      </div>,
    )
    expect(screen.queryByTestId('interaction-prompt')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'e' })
    expect(onIntent).not.toHaveBeenCalled()
  })

  it('the herb patch primary verb is collect', () => {
    // Spawn (7,8) → up 4 to (7,4) → right toward herb at (10,4); stop at (9,4)
    renderScene({ onIntent: vi.fn() })
    for (let i = 0; i < 4; i++) pressAndSettle('ArrowUp')
    for (let i = 0; i < 2; i++) pressAndSettle('ArrowRight')
    expect(player()).toHaveAttribute('data-x', '9')
    expect(screen.getByTestId('interaction-prompt')).toHaveTextContent('Collect')
  })
})
