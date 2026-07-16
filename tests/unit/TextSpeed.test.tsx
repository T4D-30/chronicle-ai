/**
 * Text Speed Tests — Dialogue Cinematics v1 (B3)
 *
 * The persisted uiSettingsStore, StoryHud's speed application (with
 * reduced-motion precedence unchanged), and the pause-overlay Settings
 * control (keyboard-operable segmented buttons).
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StoryHud } from '@/components/adventure/overworld/StoryHud'
import { TextSettingsPanel } from '@/components/pixel'
import { useUiSettingsStore, TEXT_SPEED_CHAR_MS } from '@/store/uiSettingsStore'

const base = {
  speaker: null,
  text: 'Peace, traveler.',
  streaming: false,
  suggestedActions: [] as string[],
  busy: false,
  onChoose: vi.fn(),
  onSubmitFree: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  window.localStorage.clear()
  useUiSettingsStore.setState({ textSpeed: 'normal' })
})

describe('uiSettingsStore', () => {
  it('defaults to normal — the exact pre-setting reveal rate (18 ms/char)', () => {
    expect(useUiSettingsStore.getState().textSpeed).toBe('normal')
    expect(TEXT_SPEED_CHAR_MS.normal).toBe(18)
  })

  it('persists the chosen speed to localStorage under the versioned key', () => {
    useUiSettingsStore.getState().setTextSpeed('fast')
    const raw = window.localStorage.getItem('chronai-ui-settings-v1')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).state.textSpeed).toBe('fast')
  })
})

describe('StoryHud — player-adjustable reveal rate', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('reveals at the chosen rate (fast shows more characters sooner than slow)', () => {
    useUiSettingsStore.setState({ textSpeed: 'fast' })
    const { unmount } = render(<StoryHud {...base} />)
    act(() => vi.advanceTimersByTime(8 * 6 + 4))
    const fastShown = screen.getByTestId('story-hud-text').textContent!.length
    unmount()

    useUiSettingsStore.setState({ textSpeed: 'slow' })
    render(<StoryHud {...base} />)
    act(() => vi.advanceTimersByTime(8 * 6 + 4))
    const slowShown = screen.getByTestId('story-hud-text').textContent!.length

    expect(fastShown).toBeGreaterThan(slowShown)
  })

  it('instant renders the complete text with no timer', () => {
    useUiSettingsStore.setState({ textSpeed: 'instant' })
    render(<StoryHud {...base} />)
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('Peace, traveler.')
  })

  it('prefers-reduced-motion still outranks any speed setting', () => {
    useUiSettingsStore.setState({ textSpeed: 'slow' })
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    render(<StoryHud {...base} />)
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('Peace, traveler.')
    window.matchMedia = original
  })

  it('click-to-skip still reveals full text at any speed', () => {
    useUiSettingsStore.setState({ textSpeed: 'slow' })
    render(<StoryHud {...base} />)
    fireEvent.click(screen.getByTestId('story-hud-text'))
    expect(screen.getByTestId('story-hud-text')).toHaveTextContent('Peace, traveler.')
  })
})

describe('TextSettingsPanel — Settings control', () => {
  it('renders all four speeds with the active one pressed', () => {
    render(<TextSettingsPanel />)
    expect(screen.getByTestId('text-speed-normal')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('text-speed-fast')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a speed updates the store and the pressed state', () => {
    render(<TextSettingsPanel />)
    fireEvent.click(screen.getByTestId('text-speed-instant'))
    expect(useUiSettingsStore.getState().textSpeed).toBe('instant')
    expect(screen.getByTestId('text-speed-instant')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('text-speed-normal')).toHaveAttribute('aria-pressed', 'false')
  })

  it('the controls are keyboard-reachable buttons in a labeled group', () => {
    render(<TextSettingsPanel />)
    const group = screen.getByRole('group', { name: 'Text Speed' })
    expect(group).toBeInTheDocument()
    const btn = screen.getByTestId('text-speed-fast')
    btn.focus()
    expect(btn).toHaveFocus()
  })
})
