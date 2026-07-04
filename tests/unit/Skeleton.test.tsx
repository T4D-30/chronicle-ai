/**
 * Skeleton Tests — Phase 7
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton, SkeletonText, SkeletonCard, SkeletonGrid } from '@/components/ui/Skeleton'

describe('Skeleton', () => {
  it('renders with presentation role and aria-hidden', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveAttribute('role', 'presentation')
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />)
    expect(container.firstChild).toHaveClass('h-8', 'w-32')
  })
})

describe('SkeletonText', () => {
  it('renders at default full width', () => {
    const { container } = render(<SkeletonText />)
    expect(container.firstChild).toHaveClass('w-full')
  })

  it('renders at specified width', () => {
    const { container } = render(<SkeletonText width="1/2" />)
    expect(container.firstChild).toHaveClass('w-1/2')
  })
})

describe('SkeletonCard', () => {
  it('renders with presentation role', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.firstChild).toHaveAttribute('role', 'presentation')
  })

  it('renders multiple skeleton lines', () => {
    const { container } = render(<SkeletonCard />)
    const skeletons = container.querySelectorAll('[role="presentation"]')
    expect(skeletons.length).toBeGreaterThan(1)
  })
})

describe('SkeletonGrid', () => {
  it('renders correct number of cards', () => {
    const { container } = render(<SkeletonGrid count={4} />)
    // SkeletonGrid contains SkeletonCards; the grid status div is the first child.
    // SkeletonCards have role="presentation" aria-hidden="true" as direct children of grid.
    const gridEl = container.querySelector('[role="status"]')
    // Each SkeletonCard is a direct child of the grid element (after the sr-only span)
    const cards = gridEl?.querySelectorAll(':scope > [role="presentation"]') ?? []
    expect(cards.length).toBe(4)
  })

  it('has accessible loading status', () => {
    render(<SkeletonGrid count={3} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('announces loading to screen readers', () => {
    render(<SkeletonGrid count={3} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('has aria-busy=true while loading', () => {
    render(<SkeletonGrid count={3} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})
