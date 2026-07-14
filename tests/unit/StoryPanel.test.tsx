/**
 * StoryPanel Tests — Phase 2.4 / Phase 8.3
 *
 * StoryPanel is now a pure narrative display component.
 * Input, suggested actions, and session-status gating moved to ActionBar.
 * Tests cover: empty state, turn rendering, streaming indicator.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StoryPanel } from '@/components/adventure/panels/StoryPanel'
import type { Campaign, NarrativeTurn } from '@/lib/supabase'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { NarrationStatus } from '@/components/adventure/useAdventureSession'
import { buildCharacter, resolveCharacterAction, summariseCharacterAction, setRng, resetRng } from '@/lib/engine'

const CAMPAIGN: Campaign = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active', characterId: 'char-1',
  directorConfig: DEFAULT_DIRECTOR_CONFIG, worldState: DEFAULT_WORLD_STATE,
  tone: 'heroic', difficulty: 'standard',
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const TURN: NarrativeTurn = {
  id: 't1', sessionId: 'sess-1', turnNumber: 1,
  playerInput: 'I search for hidden doors.',
  aiNarration: 'Your fingers trace a seam in the stone — a door, carefully hidden.',
  diceRolls: [], mode: 'exploration',
  createdAt: '2024-01-01T00:00:00Z',
}

/** Builds a real ResolutionSummary via the actual engine resolver — not a
    hand-typed fixture — so popup tests exercise genuine data shapes. */
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

function renderPanel({
  turns = [] as NarrativeTurn[],
  narrationStatus = 'idle' as NarrationStatus,
  streamingText = '',
  onCancelStream = vi.fn(),
  lastCheckResult = null as ReturnType<typeof summariseCharacterAction> | null,
  onClearCheckResult = vi.fn(),
} = {}) {
  return render(
    <StoryPanel
      campaign={CAMPAIGN}
      turns={turns}
      narrationStatus={narrationStatus}
      streamingText={streamingText}
      onCancelStream={onCancelStream}
      lastCheckResult={lastCheckResult}
      onClearCheckResult={onClearCheckResult}
    />
  )
}

describe('StoryPanel — empty state', () => {
  it('shows the adventure-begins prompt when no turns exist', () => {
    renderPanel()
    expect(screen.getByText(/Every hero's story begins/i)).toBeInTheDocument()
  })

  it('shows campaign title', () => {
    renderPanel()
    expect(screen.getByText('THE SHATTERED THRONE')).toBeInTheDocument()
  })

  it('shows campaign description when present', () => {
    renderPanel()
    expect(screen.getByText('A kingdom in turmoil.')).toBeInTheDocument()
  })
})

describe('StoryPanel — turn rendering', () => {
  it('renders player input from a turn', () => {
    renderPanel({ turns: [TURN] })
    expect(screen.getByText('I search for hidden doors.')).toBeInTheDocument()
  })

  it('renders AI narration from a turn', () => {
    renderPanel({ turns: [TURN] })
    expect(screen.getByText(/Your fingers trace a seam/i)).toBeInTheDocument()
  })

  it('renders turn number', () => {
    renderPanel({ turns: [TURN] })
    expect(screen.getByText('Turn 1')).toBeInTheDocument()
  })

  it('renders multiple turns', () => {
    const t2: NarrativeTurn = { ...TURN, id: 't2', turnNumber: 2, playerInput: 'I push the door.' }
    renderPanel({ turns: [TURN, t2] })
    expect(screen.getByText('I search for hidden doors.')).toBeInTheDocument()
    expect(screen.getByText('I push the door.')).toBeInTheDocument()
  })
})

describe('StoryPanel — streaming indicator', () => {
  it('shows streaming text when narrationStatus is streaming', () => {
    renderPanel({ narrationStatus: 'streaming', streamingText: 'The door swings open…' })
    expect(screen.getByText(/The door swings open/i)).toBeInTheDocument()
  })

  it('shows loading dots when streaming but no text yet', () => {
    renderPanel({ narrationStatus: 'streaming', streamingText: '' })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a cancel button during streaming', async () => {
    const user = userEvent.setup()
    const onCancelStream = vi.fn()
    renderPanel({ narrationStatus: 'streaming', streamingText: 'Text…', onCancelStream })
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancelStream).toHaveBeenCalledOnce()
  })
})

describe('StoryPanel — dice check popup (Phase 10.1, full dice transparency)', () => {
  it('does not render a popup when lastCheckResult is null', () => {
    renderPanel({ turns: [TURN], lastCheckResult: null })
    expect(screen.queryByRole('status', { name: /check:/i })).not.toBeInTheDocument()
  })

  it('renders the real resolved stat, DC, and total — not invented numbers', () => {
    const checkResult = makeCheckResult(0.5)
    renderPanel({ turns: [TURN], lastCheckResult: checkResult })

    expect(screen.getByText('DEX Check')).toBeInTheDocument()
    expect(screen.getByText(`DC ${checkResult.dc}`)).toBeInTheDocument()
    expect(screen.getByText(String(checkResult.roll.total))).toBeInTheDocument()
  })

  it('shows the outcome label from the real resolution, not a guess', () => {
    const checkResult = makeCheckResult(0.5)
    renderPanel({ turns: [TURN], lastCheckResult: checkResult })
    expect(screen.getByText(new RegExp(checkResult.outcomeLabel))).toBeInTheDocument()
  })

  it('shows Critical styling text on a natural 20', () => {
    const checkResult = makeCheckResult(0.999) // forces d20 face 20
    renderPanel({ turns: [TURN], lastCheckResult: checkResult })
    expect(screen.getByText(/Critical!/i)).toBeInTheDocument()
  })

  it('shows Fumble styling text on a natural 1', () => {
    const checkResult = makeCheckResult(0.001) // forces d20 face 1
    renderPanel({ turns: [TURN], lastCheckResult: checkResult })
    expect(screen.getByText(/Fumble\./i)).toBeInTheDocument()
  })

  it('has a full accessible description with all the roll math (dice transparency for screen readers)', () => {
    const checkResult = makeCheckResult(0.5)
    renderPanel({ turns: [TURN], lastCheckResult: checkResult })
    const popup = screen.getByRole('status', { name: new RegExp(`DEX check.*DC ${checkResult.dc}`, 'i') })
    expect(popup).toBeInTheDocument()
  })

  it('auto-dismisses via onClearCheckResult after its display window', () => {
    vi.useFakeTimers()
    const onClearCheckResult = vi.fn()
    const checkResult = makeCheckResult(0.5)
    renderPanel({ turns: [TURN], lastCheckResult: checkResult, onClearCheckResult })

    expect(onClearCheckResult).not.toHaveBeenCalled()
    vi.advanceTimersByTime(4200)
    expect(onClearCheckResult).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not call onClearCheckResult before the display window elapses', () => {
    vi.useFakeTimers()
    const onClearCheckResult = vi.fn()
    const checkResult = makeCheckResult(0.5)
    renderPanel({ turns: [TURN], lastCheckResult: checkResult, onClearCheckResult })

    vi.advanceTimersByTime(2000)
    expect(onClearCheckResult).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('StoryPanel — reader-aware scrolling (dialogue-readability pass)', () => {
  /** jsdom reports zero layout, so fake a scrollable region: 1000px of
   *  content in a 400px container. scrollTop is freely settable. */
  function makeScrollable(el: HTMLElement, { scrollHeight = 1000, clientHeight = 400 } = {}) {
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  }

  function turnN(n: number): NarrativeTurn {
    return { ...TURN, id: `t${n}`, turnNumber: n, playerInput: `Action ${n}` }
  }

  function rerenderWithTurns(
    rerender: (ui: React.ReactElement) => void,
    turns: NarrativeTurn[],
  ) {
    rerender(
      <StoryPanel
        campaign={CAMPAIGN}
        turns={turns}
        narrationStatus="idle"
        streamingText=""
        onCancelStream={vi.fn()}
      />,
    )
  }

  it('auto-follows new narration when the reader is at the bottom', () => {
    const { rerender } = renderPanel({ turns: [turnN(1)] })
    const scroll = screen.getByTestId('story-scroll')
    makeScrollable(scroll)

    // Reader sits at the bottom (1000 - 600 - 400 = 0 from bottom)
    scroll.scrollTop = 600
    fireEvent.scroll(scroll)

    rerenderWithTurns(rerender, [turnN(1), turnN(2)])
    expect(scroll.scrollTop).toBe(1000) // jumped to scrollHeight
  })

  it('preserves the reader’s position when they have scrolled up to reread', () => {
    const { rerender } = renderPanel({ turns: [turnN(1)] })
    const scroll = screen.getByTestId('story-scroll')
    makeScrollable(scroll)

    // Reader scrolled well above the 40px follow threshold
    scroll.scrollTop = 100
    fireEvent.scroll(scroll)

    rerenderWithTurns(rerender, [turnN(1), turnN(2)])
    expect(scroll.scrollTop).toBe(100) // untouched — no yank
  })

  it('resumes following once the reader returns near the bottom', () => {
    const { rerender } = renderPanel({ turns: [turnN(1)] })
    const scroll = screen.getByTestId('story-scroll')
    makeScrollable(scroll)

    scroll.scrollTop = 100
    fireEvent.scroll(scroll) // stopped following
    scroll.scrollTop = 570   // 30px from bottom — inside the 40px threshold
    fireEvent.scroll(scroll) // following again

    rerenderWithTurns(rerender, [turnN(1), turnN(2)])
    expect(scroll.scrollTop).toBe(1000)
  })

  it('follows by default on short content that has never been scrolled', () => {
    const { rerender } = renderPanel({ turns: [turnN(1)] })
    const scroll = screen.getByTestId('story-scroll')
    makeScrollable(scroll, { scrollHeight: 300, clientHeight: 400 })

    rerenderWithTurns(rerender, [turnN(1), turnN(2)])
    expect(scroll.scrollTop).toBe(300) // clamped by the browser in reality
  })
})
