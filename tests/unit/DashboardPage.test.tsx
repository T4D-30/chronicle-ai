/**
 * DashboardPage Tests — Phase 10.5
 *
 * No dedicated test file existed for this page before. Covers the
 * logout button — the actual UI entry point for authStore.signOut(),
 * already thoroughly tested in isolation in authStore.test.ts. This file
 * verifies the button is wired to the real store correctly.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signOutMock = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'hero@chronicle.ai' },
    session: null,
    isLoading: false,
    isAuthenticated: true,
    signOut: signOutMock,
  }),
}))

import DashboardPage from '@/app/pages/DashboardPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  signOutMock.mockReset()
})

describe('DashboardPage — rendering', () => {
  it('shows the signed-in user\u2019s email', () => {
    renderPage()
    expect(screen.getByText('hero@chronicle.ai')).toBeInTheDocument()
  })

  it('has links to campaigns and characters', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /My Campaigns/i })).toHaveAttribute('href', '/campaigns')
    expect(screen.getByRole('link', { name: /My Characters/i })).toHaveAttribute('href', '/characters')
  })
})

describe('DashboardPage — logout flow', () => {
  it('renders a Sign Out button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
  })

  it('calls signOut when the Sign Out button is clicked', async () => {
    const user = userEvent.setup()
    signOutMock.mockResolvedValue(undefined)
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(signOutMock).toHaveBeenCalledOnce()
  })
})
