/**
 * LoadingSpinner Tests — Phase 7
 * Covers reduced-motion fallback, accessible label, role=status.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('has role=status', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders a screen-reader label', () => {
    render(<LoadingSpinner label="Fetching data…" />)
    expect(screen.getByText('Fetching data…')).toBeInTheDocument()
  })

  it('uses default label "Loading…" when no label prop given', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('label is sr-only (visually hidden)', () => {
    render(<LoadingSpinner label="Fetching" />)
    expect(screen.getByText('Fetching')).toHaveClass('sr-only')
  })

  it('spinning SVG is aria-hidden', () => {
    const { container } = render(<LoadingSpinner />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the reduced-motion static dot element', () => {
    const { container } = render(<LoadingSpinner />)
    // The motion-reduce:block div is always present in DOM but hidden via CSS class.
    // We verify the element exists and carries the motion-reduce:block class.
    const dot = container.querySelector('.motion-reduce\\:block')
    expect(dot).toBeInTheDocument()
  })

  it('spinning SVG carries motion-reduce:hidden class', () => {
    const { container } = render(<LoadingSpinner />)
    const svg = container.querySelector('svg')
    // className is a string on SVG elements — use includes check
    expect(svg?.className.baseVal ?? svg?.getAttribute('class') ?? '').toContain('motion-reduce:hidden')
  })

  it('accepts sm/md/lg sizes without throwing', () => {
    expect(() => render(<LoadingSpinner size="sm" />)).not.toThrow()
    expect(() => render(<LoadingSpinner size="md" />)).not.toThrow()
    expect(() => render(<LoadingSpinner size="lg" />)).not.toThrow()
  })
})
