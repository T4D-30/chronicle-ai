/**
 * PublicRoute Tests — Phase 10.0 audit
 *
 * Same coverage gap as ProtectedRoute — found and closed together during
 * the Phase 10.0 repository audit.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { PublicRoute } from '@/components/layout/PublicRoute'

const mockUseAuth = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderPublic(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<div>Login Page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard Content</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicRoute — loading state', () => {
  it('shows a loading spinner while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    renderPublic()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not render the public content while loading', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    renderPublic()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('does not redirect to dashboard while loading, even if authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: true })
    renderPublic()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })
})

describe('PublicRoute — unauthenticated', () => {
  it('renders the public content (Outlet) when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    renderPublic()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})

describe('PublicRoute — authenticated', () => {
  it('redirects to /dashboard when already authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    renderPublic()
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})
