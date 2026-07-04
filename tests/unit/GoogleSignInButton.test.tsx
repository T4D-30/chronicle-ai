/**
 * GoogleSignInButton Tests — Phase 10.5
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithGoogleMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    authService: {
      ...actual.authService,
      signInWithGoogle: (...args: unknown[]) => signInWithGoogleMock(...args),
    },
  }
})

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

beforeEach(() => {
  signInWithGoogleMock.mockReset()
})

describe('GoogleSignInButton — rendering', () => {
  it('renders a button with the accessible name "Sign in with Google"', () => {
    render(<GoogleSignInButton />)
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('shows "Continue with Google" as the visible button text', () => {
    render(<GoogleSignInButton />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
  })

  it('has an accessible label reflecting the login context by default', () => {
    render(<GoogleSignInButton />)
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('has an accessible label reflecting the signup context when specified', () => {
    render(<GoogleSignInButton context="signup" />)
    expect(screen.getByRole('button', { name: 'Sign up with Google' })).toBeInTheDocument()
  })
})

describe('GoogleSignInButton — initiating sign-in', () => {
  it('calls authService.signInWithGoogle when clicked', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockReturnValue(new Promise(() => {}))
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(signInWithGoogleMock).toHaveBeenCalledOnce()
  })

  it('shows a "Redirecting to Google…" loading state after clicking', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockReturnValue(new Promise(() => {}))
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    await waitFor(() => expect(screen.getByText(/Redirecting to Google/i)).toBeInTheDocument())
  })

  it('disables the button while redirecting, to prevent duplicate clicks', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockReturnValue(new Promise(() => {}))
    render(<GoogleSignInButton />)
    const button = screen.getByRole('button', { name: 'Sign in with Google' })
    await user.click(button)
    await waitFor(() => expect(button).toBeDisabled())
  })
})

describe('GoogleSignInButton — error handling', () => {
  it('shows a friendly error message when signInWithGoogle rejects with a generic error', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockRejectedValue(new Error('Provider not configured.'))
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider not configured.')
  })

  it('shows a specific, actionable message for a network-shaped error', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockRejectedValue(new Error('Failed to fetch'))
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/check your connection/i)
  })

  it('shows a generic fallback message for a non-Error rejection', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockRejectedValue('a raw string rejection')
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not start Google sign-in/i)
  })

  it('re-enables the button after a failure, so the player can retry', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockRejectedValue(new Error('Something went wrong.'))
    render(<GoogleSignInButton />)
    const button = screen.getByRole('button', { name: 'Sign in with Google' })
    await user.click(button)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(button).not.toBeDisabled()
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument()
  })

  it('clears a previous error on a retry click', async () => {
    const user = userEvent.setup()
    signInWithGoogleMock.mockRejectedValueOnce(new Error('First failure.'))
    signInWithGoogleMock.mockReturnValueOnce(new Promise(() => {}))
    render(<GoogleSignInButton />)
    const button = screen.getByRole('button', { name: 'Sign in with Google' })

    await user.click(button)
    await waitFor(() => expect(screen.getByText('First failure.')).toBeInTheDocument())

    await user.click(button)
    await waitFor(() => expect(screen.queryByText('First failure.')).not.toBeInTheDocument())
  })
})
