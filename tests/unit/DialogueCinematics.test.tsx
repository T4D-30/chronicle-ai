/**
 * Dialogue Cinematics Transition Tests — v1 (B2)
 *
 * The two new animation hooks: the portrait's stepped enter and the
 * dialogue-advance settle on completed beats — including that
 * streaming token growth never replays the advance animation, and
 * that both classes are registered in pixel.css's reduced-motion
 * kill-list (UI_VISION rule: every new keyframe joins the kill-list
 * in the same commit).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { StoryHud } from '@/components/adventure/overworld/StoryHud'
import { SpeakerPortrait } from '@/components/adventure/overworld/SpeakerPortrait'

const base = {
  text: 'Peace, traveler.',
  streaming: false,
  suggestedActions: [] as string[],
  busy: false,
  onChoose: vi.fn(),
  onSubmitFree: vi.fn(),
  onClose: vi.fn(),
}

describe('dialogue cinematics — transition classes (B2)', () => {
  it('the portrait carries the stepped enter animation class', () => {
    render(<SpeakerPortrait name="Brother Aldwin" glyph="🧑‍🦲" />)
    expect(screen.getByTestId('speaker-portrait')).toHaveClass('dialogue-portrait-enter')
  })

  it('a completed beat carries the advance-settle class', () => {
    render(<StoryHud {...base} speaker="Brother Aldwin" />)
    expect(screen.getByTestId('story-hud-text')).toHaveClass('dialogue-advance')
  })

  it('streaming token growth does not remount the text block (no animation replay)', () => {
    const { rerender } = render(<StoryHud {...base} streaming text="The wind" />)
    const before = screen.getByTestId('story-hud-text')
    rerender(<StoryHud {...base} streaming text="The wind rises over" />)
    // Same DOM node → same key → the advance animation never replays mid-stream.
    expect(screen.getByTestId('story-hud-text')).toBe(before)
  })

  it('a NEW completed beat remounts the text block so the settle plays once', () => {
    const { rerender } = render(<StoryHud {...base} text="First beat." />)
    const before = screen.getByTestId('story-hud-text')
    rerender(<StoryHud {...base} text="Second beat." />)
    expect(screen.getByTestId('story-hud-text')).not.toBe(before)
  })

  it('both new animation classes are in the pixel.css reduced-motion kill-list', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/pixel.css'), 'utf8')
    const killList = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(killList).toContain('.dialogue-portrait-enter')
    expect(killList).toContain('.dialogue-advance')
  })
})
