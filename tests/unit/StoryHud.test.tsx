/**
 * StoryHud Tests — Unified Adventure Screen (Presentation 4, B2)
 *
 * Component mechanics for both modes: dialogue (speaker, typewriter,
 * reduced motion, choices, free input, close) and ambient (current
 * beat, dismiss, collapsed input strip, movement-friendly semantics).
 * OverworldMode orchestration is covered in OverworldStoryHud.test.tsx.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StoryHud } from '@/components/adventure/overworld/StoryHud'

function renderHud(props: Partial<Parameters<typeof StoryHud>[0]> = {}) {
  const defaults = {
    speaker: null as string | null,
    text: '',
    streaming: false,
    suggestedActions: [] as string[],
    busy: false,
    onChoose: vi.fn(),
    onSubmitFree: vi.fn(),
    onClose: vi.fn(),
  }
  const merged = { ...defaults, ...props }
  return { ...render(<StoryHud {...merged} />), props: merged }
}

describe('StoryHud — dialogue mode', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows the speaker label and dialog role', () => {
    renderHud({ speaker: 'Brother Aldwin', text: 'Peace, traveler.' })
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'dialogue')
    expect(screen.getByRole('dialog', { name: 'Dialogue with Brother Aldwin' })).toBeInTheDocument()
    expect(screen.getByTestId('story-hud-speaker')).toHaveTextContent('Brother Aldwin')
  })

  it('typewrites completed text and can be skipped to full by clicking', () => {
    renderHud({ speaker: 'Brother Aldwin', text: 'Peace, traveler.' })
    expect(screen.getByTestId('story-hud-text')).not.toHaveTextContent('Peace, traveler.')
    act(() => vi.advanceTimersByTime(18 * 6))
    expect(screen.getByTestId('story-hud-text').textContent?.length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('story-hud-text'))
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('Peace, traveler.')
  })

  it('renders full text instantly under prefers-reduced-motion', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    renderHud({ speaker: 'Brother Aldwin', text: 'Peace, traveler.' })
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('Peace, traveler.')
    window.matchMedia = original
  })

  it('renders streaming text as-is without the typewriter', () => {
    renderHud({ speaker: 'Brother Aldwin', text: 'The monk considers…', streaming: true })
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('The monk considers…')
  })

  it('choices call onChoose; free-form submits via onSubmitFree', () => {
    const { props } = renderHud({
      speaker: 'Brother Aldwin',
      suggestedActions: ['Ask about the mill'],
      text: 'x',
    })
    fireEvent.click(screen.getByTestId('story-hud-text')) // reveal
    fireEvent.click(screen.getByRole('button', { name: 'Ask about the mill' }))
    expect(props.onChoose).toHaveBeenCalledWith('Ask about the mill')

    fireEvent.change(screen.getByTestId('story-hud-free-input'), { target: { value: 'I bow.' } })
    fireEvent.submit(screen.getByTestId('story-hud-free-input').closest('form')!)
    expect(props.onSubmitFree).toHaveBeenCalledWith('I bow.')
  })

  it('close button calls onClose', () => {
    const { props } = renderHud({ speaker: 'Brother Aldwin', text: 'x' })
    fireEvent.click(screen.getByTestId('story-hud-close'))
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})

describe('StoryHud — ambient mode', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is a non-modal region labeled Story, not a dialog', () => {
    renderHud({ text: 'The gate creaks open.' })
    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'ambient')
    expect(screen.getByRole('region', { name: 'Story' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the current beat with "The Story" label and a Dismiss control', () => {
    const { props } = renderHud({ text: 'The gate creaks open.' })
    expect(screen.getByTestId('story-hud-speaker')).toHaveTextContent('The Story')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss narration' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('collapses to just the free-input strip when there is no beat', () => {
    renderHud({ text: '' })
    expect(screen.queryByTestId('story-hud-text')).not.toBeInTheDocument()
    expect(screen.queryByTestId('story-hud-close')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('What do you do?')).toBeInTheDocument()
  })

  it('free-form action submits from the collapsed strip', () => {
    const { props } = renderHud({ text: '' })
    fireEvent.change(screen.getByTestId('story-hud-free-input'), { target: { value: 'I look around.' } })
    fireEvent.submit(screen.getByTestId('story-hud-free-input').closest('form')!)
    expect(props.onSubmitFree).toHaveBeenCalledWith('I look around.')
  })

  it('typewrites an ambient beat too, skippable by click', () => {
    renderHud({ text: 'A cold wind rises.' })
    fireEvent.click(screen.getByTestId('story-hud-text'))
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('A cold wind rises.')
  })

  it('shows choices for a completed beat and disables everything while busy', () => {
    const { props } = renderHud({
      text: 'A fork in the road.',
      suggestedActions: ['Take the left path'],
      busy: true,
    })
    expect(screen.getByRole('button', { name: 'Take the left path' })).toBeDisabled()
    expect(screen.getByTestId('story-hud-free-input')).toBeDisabled()
    expect(props.onChoose).not.toHaveBeenCalled()
  })

  it('shows no choices while streaming', () => {
    renderHud({ text: 'The wind ri', streaming: true, suggestedActions: ['Hide'] })
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument()
  })
})
