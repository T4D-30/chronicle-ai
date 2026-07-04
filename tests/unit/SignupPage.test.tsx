/**
 * SignupPage Tests — Phase 10.5
 *
 * No dedicated test file existed for this page before. Covers the
 * existing email/password flow (previously untested, real regression
 * coverage) and the new GoogleSignInButton integration.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signUpMock = vi.fn()
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
      signUp: (...args: unknown[]) => signUpMock(...args),
      signInWithGoogle: (...args: unknown[]) => signInWithGoogleMock(...args),
    },
  }
})

import SignupPage from '@/app/pages/SignupPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  signUpMock.mockReset()
  signInWithGoogleMock.mockReset()
  navigateMock.mockReset()
})

describe('SignupPage — email/password sign-up', () => {
  it('calls authService.signUp with the entered fields on submit', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({ user: null, session: null })
    renderPage()

    await user.type(screen.getByLabelText('Display Name'), 'Aldric Sorn')
    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith({
      email: 'hero@chronicle.ai', password: 'hunter2hunter2', displayName: 'Aldric Sorn',
    }))
  })

  it('navigates to /dashboard on successful sign-up', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({ user: null, session: null })
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows an error message and does not navigate when sign-up fails', async () => {
    const user = userEvent.setup()
    signUpMock.mockRejectedValue(new Error('Email already registered.'))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('Email already registered.')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows a loading state while signing up', async () => {
    const user = userEvent.setup()
    signUpMock.mockReturnValue(new Promise(() => {}))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'hero@chronicle.ai')
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(screen.getByText(/Creating account/i)).toBeInTheDocument())
  })

  it('has a link to the login page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', '/login')
  })
})

describe('SignupPage — Google sign-in integration', () => {
  it('renders the Google sign-in button with signup-context accessible label', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Sign up with Google' })).toBeInTheDocument()
  })

  it('calls authService.signInWithGoogle when the Google button is clicked, independent of the signup form', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockReturnValue(new Promise(() => {}))
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Sign up with Google' }))
    expect(signInWithGoogleMock).toHaveBeenCalledOnce()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('shows a visual divider between Google sign-in and the signup form', () => {
    renderPage()
    expect(screen.getByText('or')).toBeInTheDocument()
  })
})
