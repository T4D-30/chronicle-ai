/**
 * AppShell Tests — Phase 7
 * Skip link, main content landmark.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AppShell } from '@/components/layout/AppShell'

describe('AppShell', () => {
  it('renders a skip link', () => {
    render(<MemoryRouter><AppShell><div>content</div></AppShell></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Skip to main content/i })).toBeInTheDocument()
  })

  it('skip link points to #main-content', () => {
    render(<MemoryRouter><AppShell><div>content</div></AppShell></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Skip to main content/i })).toHaveAttribute('href', '#main-content')
  })

  it('renders an element with id=main-content', () => {
    render(<MemoryRouter><AppShell><div>content</div></AppShell></MemoryRouter>)
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })

  it('renders children inside main-content', () => {
    render(<MemoryRouter><AppShell><p>page content</p></AppShell></MemoryRouter>)
    expect(document.getElementById('main-content')).toContainElement(screen.getByText('page content'))
  })
})
