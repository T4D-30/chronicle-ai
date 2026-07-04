/**
 * AuthCallbackPage Tests — Phase 10.5
 */
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import AuthCallbackPage from '@/app/pages/AuthCallbackPage'
import { useAuthStore } from '@/store/authStore'

function renderCallback(url = '/auth/callback') {
  window.history.pushState({}, '', url)
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthCallbackPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  window.history.pushState({}, '', '/auth/callback')
  useAuthStore.setState({ user: null, session: null, isAuthenticated: false, isLoading: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthCallbackPage — processing state', () => {
  it('shows a "Signing you in…" loading indicator while auth is still resolving', () => {
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    renderCallback()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not redirect while still loading', () => {
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    renderCallback()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('AuthCallbackPage — successful session restoration and routing', () => {
  it('redirects to /dashboard once the session resolves as authenticated', async () => {
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    const { rerender } = renderCallback()

    useAuthStore.setState({ isLoading: false, isAuthenticated: true })
    rerender(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('does not redirect if loading finishes but the user is still unauthenticated (no error either — an edge case, not a crash)', async () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: false })
    renderCallback()
    await new Promise((r) => setTimeout(r, 50))
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('AuthCallbackPage — OAuth error handling', () => {
  it('shows a friendly "cancelled" message for access_denied, the standard OAuth cancellation code', () => {
    renderCallback('/auth/callback?error=access_denied&error_description=User+denied+access')
    expect(screen.getByText(/Sign-in was cancelled/i)).toBeInTheDocument()
  })

  it('does not redirect to /dashboard when an OAuth error is present, even if auth resolves as unauthenticated', () => {
    renderCallback('/auth/callback?error=access_denied')
    useAuthStore.setState({ isLoading: false, isAuthenticated: false })
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows the raw error description for an unrecognized error code, rather than hiding it behind a generic message', () => {
    renderCallback('/auth/callback?error=weird_unrecognized_code&error_description=Something+specific+went+wrong')
    expect(screen.getByText(/Something specific went wrong/i)).toBeInTheDocument()
  })

  it('shows a specific message for server_error', () => {
    renderCallback('/auth/callback?error=server_error&error_description=oops')
    expect(screen.getByText(/sign-in service had a problem/i)).toBeInTheDocument()
  })

  it('provides a link back to the login page on error', () => {
    renderCallback('/auth/callback?error=access_denied')
    expect(screen.getByRole('link', { name: /Back to Sign In/i })).toHaveAttribute('href', '/login')
  })

  it('reads the error from the hash fragment too, not only the query string', () => {
    renderCallback('/auth/callback#error=access_denied&error_description=Denied+in+hash')
    expect(screen.getByText(/Sign-in was cancelled/i)).toBeInTheDocument()
  })

  it('renders the error as an alert for assistive technology', () => {
    renderCallback('/auth/callback?error=access_denied')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('AuthCallbackPage — stalled session timeout', () => {
  it('shows a timeout message if the session never resolves within the timeout window', () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    renderCallback()

    act(() => { vi.advanceTimersByTime(15_000) })
    expect(screen.getByText(/taking too long/i)).toBeInTheDocument()
  })

  it('does not show a timeout message before the window elapses', () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    renderCallback()

    act(() => { vi.advanceTimersByTime(5_000) })
    expect(screen.queryByText(/taking too long/i)).not.toBeInTheDocument()
  })

  it('does not show a timeout message once the session resolves successfully before the window elapses', () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    renderCallback()

    act(() => { useAuthStore.setState({ isLoading: false, isAuthenticated: true }) })
    act(() => { vi.advanceTimersByTime(15_000) })
    expect(screen.queryByText(/taking too long/i)).not.toBeInTheDocument()
  })

  it('provides a link back to login on timeout', () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })
    renderCallback()
    act(() => { vi.advanceTimersByTime(15_000) })
    expect(screen.getByRole('link', { name: /Back to Sign In/i })).toHaveAttribute('href', '/login')
  })
})
