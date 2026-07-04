/**
 * GoogleSignInButton — Phase 10.5
 *
 * Reusable "Continue with Google" button, used on both LoginPage and
 * SignupPage. Wraps authService.signInWithGoogle() (src/lib/supabase/auth.ts),
 * which itself wraps the standard supabase-js signInWithOAuth() call.
 *
 * WHY A SEPARATE COMPONENT RATHER THAN INLINING THE CALL ON EACH PAGE:
 * the button's own internal state (loading, error) is identical on both
 * pages — "Continue with Google" means the same thing whether the player
 * arrived via /login or /signup (Google OAuth doesn't distinguish sign-in
 * from sign-up; Supabase provisions a new user automatically on first
 * Google login via the profiles trigger — see migration
 * 0007_google_oauth_provisioning.sql). Sharing one implementation avoids
 * two copies of the same error-handling logic drifting apart over time.
 *
 * REDIRECT-BASED FLOW, NOT A POPUP: signInWithOAuth() with no popup
 * option navigates the whole page to Google's consent screen and back —
 * this is the flow supabase-js implements by default and the one this
 * app's Supabase client is configured for (detectSessionInUrl: true in
 * client.ts). Because of this, "popup blocked" is not a real failure mode
 * for this specific implementation (there is no popup) — the error
 * handling below still accounts for it in case a user's browser extension
 * or corporate policy blocks the navigation/redirect itself, surfaced as
 * the same generic network/redirect failure category.
 *
 * CANCELLATION: if the player closes the Google consent screen or clicks
 * back before completing sign-in, no error is thrown by
 * signInWithOAuth() itself (the promise resolves once the redirect to
 * Google is initiated, not once the user finishes on Google's side) — the
 * user simply lands back wherever they were, or Google redirects back to
 * this app's callback URL with an error/error_description query param.
 * The latter case is handled by AuthCallbackPage, not this button; this
 * button's own error state only ever covers a failure to INITIATE the
 * redirect (e.g. a network error reaching Supabase, or Supabase itself
 * returning an error before ever redirecting to Google).
 */

import { useState } from 'react'
import { Button } from '@/components/ui'
import { authService } from '@/lib/supabase'

interface GoogleSignInButtonProps {
  /** Adjusts the accessible label slightly for context — otherwise identical behavior. */
  context?: 'login' | 'signup'
}

function friendlyGoogleSignInError(err: unknown): string {
  if (err instanceof Error) {
    if (/fetch|network/i.test(err.message)) {
      return 'Could not reach the sign-in service. Check your connection and try again.'
    }
    return err.message
  }
  return 'Could not start Google sign-in. Please try again.'
}

export function GoogleSignInButton({ context = 'login' }: GoogleSignInButtonProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setIsRedirecting(true)
    try {
      // Navigates the browser away to Google on success — this component
      // effectively unmounts mid-flow in the happy path. isRedirecting
      // only resets to false in the catch branch; there is no "success"
      // state to return to here.
      await authService.signInWithGoogle()
    } catch (err) {
      setError(friendlyGoogleSignInError(err))
      setIsRedirecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        size="lg"
        loading={isRedirecting}
        onClick={() => { void handleClick() }}
        className="w-full"
        aria-label={context === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
      >
        {!isRedirecting && <GoogleIcon />}
        {isRedirecting ? 'Redirecting to Google…' : 'Continue with Google'}
      </Button>
      {error && (
        <p role="alert" className="text-harm-400 text-sm text-center">
          {error}
        </p>
      )}
    </div>
  )
}

/** Google's standard multi-color "G" mark, inline so no external asset/icon-font dependency is needed. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="flex-shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}
