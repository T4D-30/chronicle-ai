/**
 * MainMenuPage Tests — UI 3.0 (renamed from DashboardPage, Phase 10.5)
 *
 * Same contract as before the JRPG main-menu rebuild: the signed-in
 * email is visible, real links point at /campaigns and /characters, and
 * the Sign Out button is wired to the real store's signOut (thoroughly
 * tested in isolation in authStore.test.ts). Plus the UI 3.0 additions:
 * a New Chronicle link and arrow-key menu selection.
 */
import { render, screen, fireEvent } from '@testing-library/react'
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

import MainMenuPage from '@/app/pages/MainMenuPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <MainMenuPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  signOutMock.mockReset()
})

describe('MainMenuPage — rendering', () => {
  it('shows the signed-in user’s email', () => {
    renderPage()
    expect(screen.getByText('hero@chronicle.ai')).toBeInTheDocument()
  })

  it('has links to campaigns and characters', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Continue/i })).toHaveAttribute('href', '/campaigns')
    expect(screen.getByRole('link', { name: /My Characters/i })).toHaveAttribute('href', '/characters')
  })

  it('has a New Chronicle link to campaign creation', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /New Chronicle/i })).toHaveAttribute('href', '/campaigns/new')
  })

  it('does not use dashboard language anywhere', () => {
    renderPage()
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument()
  })
})

describe('MainMenuPage — JRPG menu selection', () => {
  it('ArrowDown moves focus/selection to the next menu item', () => {
    renderPage()
    const nav = screen.getByRole('navigation', { name: /Main menu/i })
    const continueLink = screen.getByRole('link', { name: /Continue/i })
    continueLink.focus()
    fireEvent.keyDown(nav, { key: 'ArrowDown' })
    expect(screen.getByRole('link', { name: /New Chronicle/i })).toHaveFocus()
  })
})

describe('MainMenuPage — logout flow', () => {
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
