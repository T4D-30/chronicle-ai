/**
 * WorldRenderer Tests — UI 3.0 (Pixel RPG Experience)
 *
 * jsdom never completes image loads, so the asset-slot probe never
 * resolves here — every test deterministically exercises the
 * procedural fallback, which is exactly the state the app ships in
 * (no real environment art exists yet by design).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WorldRenderer } from '@/components/pixel/WorldRenderer'

describe('WorldRenderer — procedural fallback (no real art shipped)', () => {
  it('renders the renderer root with scene + tint metadata', () => {
    render(<WorldRenderer scene="night-camp" />)
    const root = screen.getByTestId('world-renderer')
    expect(root).toHaveAttribute('data-scene', 'night-camp')
    expect(root).toHaveAttribute('data-tint', 'night')
  })

  it('renders procedural scenery, not the asset image', () => {
    render(<WorldRenderer scene="dusk-vale" />)
    expect(screen.getByTestId('world-renderer-procedural')).toBeInTheDocument()
    expect(screen.queryByTestId('world-renderer-asset')).not.toBeInTheDocument()
  })

  it('is decorative: aria-hidden and pointer-events-none', () => {
    render(<WorldRenderer scene="night-camp" />)
    const root = screen.getByTestId('world-renderer')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.className).toContain('pointer-events-none')
  })

  it('tint prop overrides the scene default', () => {
    render(<WorldRenderer scene="night-camp" tint="dawn" />)
    expect(screen.getByTestId('world-renderer')).toHaveAttribute('data-tint', 'dawn')
  })

  it('parallax drift classes are present by default', () => {
    const { container } = render(<WorldRenderer scene="dusk-vale" />)
    expect(container.querySelectorAll('.world-band').length).toBeGreaterThan(0)
    expect(container.querySelector('.world-clouds')).toBeInTheDocument()
  })

  it('parallax={false} omits drift classes (still scene, no motion)', () => {
    const { container } = render(<WorldRenderer scene="dusk-vale" parallax={false} />)
    expect(container.querySelector('.world-band')).not.toBeInTheDocument()
    expect(container.querySelector('.world-clouds')).not.toBeInTheDocument()
  })

  it('renders the ambience layer internally when requested', () => {
    render(<WorldRenderer scene="night-camp" ambience="fireflies" />)
    expect(screen.getByTestId('ambient-fireflies')).toBeInTheDocument()
  })

  it('renders no ambience layer by default', () => {
    render(<WorldRenderer scene="night-camp" />)
    expect(screen.queryByTestId('ambient-fireflies')).not.toBeInTheDocument()
  })

  it('night scenes render a star field; dusk scenes do not', () => {
    const { container, rerender } = render(<WorldRenderer scene="night-camp" />)
    const starCount = container.querySelectorAll('.torch-flicker').length
    expect(starCount).toBeGreaterThan(0)
    rerender(<WorldRenderer scene="dusk-vale" />)
    expect(container.querySelectorAll('.torch-flicker').length).toBe(0)
  })
})
