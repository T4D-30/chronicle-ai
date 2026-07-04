/**
 * ProtectedRoute Tests — Phase 10.0 audit
 *
 * No prior test coverage existed for this component despite it being the
 * security-relevant gate for every authenticated route in the app. Found
 * during the Phase 10.0 repository audit's "missing tests" pass and closed
 * directly (low-risk, small pure component) rather than only documented.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

const mockUseAuth = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderProtected(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute — loading state', () => {
  it('shows a loading spinner while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    renderProtected()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not render the protected content while loading', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    renderProtected()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  it('does not redirect to login while loading, even if unauthenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    renderProtected()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — authenticated', () => {
  it('renders the protected content (Outlet) when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    renderProtected()
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
  })
})

describe('ProtectedRoute — unauthenticated', () => {
  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    renderProtected()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })
})
