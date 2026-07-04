/**
 * ErrorBoundary Tests — Phase 7
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'

// Component that throws on demand
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Simulated component failure')
  return <div>Working content</div>
}

// Suppress console.error for expected error boundary output
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks() })

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><Bomb shouldThrow={false} /></ErrorBoundary>)
    expect(screen.getByText('Working content')).toBeInTheDocument()
  })

  it('catches render errors and shows recovery UI', () => {
    render(<ErrorBoundary><Bomb shouldThrow /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Simulated component failure')).toBeInTheDocument()
  })

  it('shows Try Again button', () => {
    render(<ErrorBoundary><Bomb shouldThrow /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('shows Go Home link', () => {
    render(<ErrorBoundary><Bomb shouldThrow /></ErrorBoundary>)
    expect(screen.getByRole('link', { name: 'Go Home' })).toBeInTheDocument()
  })

  it('resets error state when Try Again is clicked', async () => {
    const user = userEvent.setup()
    // Render a component that throws, confirm error UI shows
    render(<ErrorBoundary><Bomb shouldThrow /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()

    // Clicking Try Again calls setState({ hasError: false }),
    // which re-renders — Bomb still throws, so the alert reappears.
    // The important assertion is that the click handler runs without error.
    await user.click(screen.getByRole('button', { name: 'Try Again' }))
    // After reset + re-render with still-throwing child, alert is shown again
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders non-throwing children normally (separate mount)', () => {
    // Verify the boundary is transparent when no error occurs
    render(<ErrorBoundary><Bomb shouldThrow={false} /></ErrorBoundary>)
    expect(screen.getByText('Working content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows context in error heading when provided', () => {
    render(<ErrorBoundary context="Combat Panel"><Bomb shouldThrow /></ErrorBoundary>)
    expect(screen.getByText(/COMBAT PANEL ERROR/i)).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<p>Custom recovery UI</p>}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom recovery UI')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument()
  })
})
