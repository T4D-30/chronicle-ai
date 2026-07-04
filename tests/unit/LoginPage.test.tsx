/**
 * LoginPage Tests — Phase 10.5
 *
 * No dedicated test file existed for this page before. Covers the
 * existing email/password flow (previously untested, real regression
 * coverage) and the new GoogleSignInButton integration.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInMock = vi.fn()
const signInWithGoogleMock = vi.fn()
const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    authService: {
      ...actual.authService,
      signIn: (...args: unknown[]) => signInMock(...args),
      signInWithGoogle: (...args: unknown[]) => signInWithGoogleMock(...args),
    },
  }
})

import LoginPage from '@/app/pages/LoginPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  signInMock.mockReset()
  signInWithGoogleMock.mockReset()
  navigateMock.mockReset()
})

describe('LoginPage — email/password sign-in', () => {
  it('calls authService.signIn with the entered credentials on submit', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({ user: null, session: null })
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => expect(signInMock).toHaveBeenCalledWith({ email: 'hero@chronicle.ai', password: 'hunter2hunter2' }))
  })

  it('navigates to /dashboard on successful sign-in', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({ user: null, session: null })
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows an error message and does not navigate when sign-in fails', async () => {
    const user = userEvent.setup()
    signInMock.mockRejectedValue(new Error('Invalid login credentials.'))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Invalid login credentials.')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows a loading state while signing in', async () => {
    const user = userEvent.setup()
    signInMock.mockReturnValue(new Promise(() => {}))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => expect(screen.getByText(/Signing in/i)).toBeInTheDocument())
  })

  it('has a link to the signup page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Create an account/i })).toHaveAttribute('href', '/signup')
  })
})

describe('LoginPage — Google sign-in integration', () => {
  it('renders the Google sign-in button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('calls authService.signInWithGoogle when the Google button is clicked, independent of the email form', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockReturnValue(new Promise(() => {}))
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(signInWithGoogleMock).toHaveBeenCalledOnce()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('shows a visual divider between Google sign-in and the email/password form', () => {
    renderPage()
    expect(screen.getByText('or')).toBeInTheDocument()
  })
})
