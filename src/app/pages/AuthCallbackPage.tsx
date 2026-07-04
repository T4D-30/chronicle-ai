/**
 * AuthCallbackPage — Phase 10.5
 *
 * Where Google (via Supabase) redirects back to after the OAuth consent
 * screen. Mounted as a STANDALONE top-level route (/auth/callback), NOT
 * nested under PublicRoute or ProtectedRoute — this matters:
 * PublicRoute redirects any authenticated user straight to /dashboard,
 * which would fire the instant onAuthStateChange detects the new session
 * (mid-flow), before this page ever gets to render its own "Signing you
 * in…" state or check for an OAuth error. A standalone route keeps full
 * control over the timing and the redirect target.
 *
 * HOW SESSION RESTORATION ACTUALLY HAPPENS HERE: this page does NOT call
 * supabase.auth.exchangeCodeForSession() itself. That's only necessary
 * for server-side/SSR auth flows. For a pure client-side SPA (this app),
 * the supabase-js client's own constructor-time _initialize() already
 * detects the PKCE code (or implicit tokens) in the URL and exchanges it
 * for a session automatically — this is exactly what
 * `detectSessionInUrl: true` (client.ts) enables.
 *
 * Verified precisely (by reading @supabase/auth-js's own GoTrueClient
 * source, not assumed): `getSession()`'s very first line is
 * `await this.initializePromise` — every call to getSession() genuinely
 * waits for _initialize()'s URL-based session exchange to finish first.
 * Since authStore.initialize() (called once, at app boot, in main.tsx —
 * awaited there before the router even renders) calls
 * authService.getSession() as its first step, the session it receives is
 * ALREADY the freshly-exchanged Google session by the time isLoading
 * first becomes false on this page — this page's redirect-on-
 * authenticated effect does not depend on catching a later
 * onAuthStateChange event's timing, though the same store also
 * subscribes to onAuthStateChange for any subsequent auth changes during
 * the session's lifetime (unrelated to this specific callback moment).
 *
 * ERROR DETECTION: the client's own internal error handling
 * (AuthImplicitGrantRedirectError, thrown inside _initialize()) is
 * swallowed internally and logged via _debug — it does NOT propagate to
 * application code or the auth store. This page independently checks
 * window.location for error/error_description/error_code itself,
 * checking both the query string and the hash fragment since Supabase's
 * parseParametersFromURL reads both (confirmed by inspecting
 * @supabase/auth-js's own GoTrueClient source during development — see
 * docs/DEPLOYMENT.md's Google OAuth Setup section).
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner, Button } from '@/components/ui'

/** How long to wait for the session to resolve before treating it as a stalled/failed callback. */
const CALLBACK_TIMEOUT_MS = 15_000

interface OAuthCallbackError {
  code: string
  description: string
}

/**
 * Reads error/error_description/error_code from both the query string and
 * the hash fragment — Google/Supabase can surface an OAuth failure in
 * either location depending on flow type, and checking only one would
 * silently miss real errors.
 */
function readOAuthError(): OAuthCallbackError | null {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  const code = query.get('error_code') ?? hash.get('error_code') ?? query.get('error') ?? hash.get('error')
  const description = query.get('error_description') ?? hash.get('error_description')

  if (!code) return null
  return { code, description: description ?? 'Google sign-in did not complete.' }
}

/** Maps known OAuth error codes to a friendly, specific message. Falls back to the raw description for anything unrecognized, rather than a generic message that hides real information. */
function friendlyCallbackError({ code, description }: OAuthCallbackError): string {
  switch (code) {
    case 'access_denied':
      return 'Sign-in was cancelled.'
    case 'server_error':
      return 'Google\u2019s sign-in service had a problem. Please try again in a moment.'
    case 'temporarily_unavailable':
      return 'Google sign-in is temporarily unavailable. Please try again shortly.'
    default:
      return description.replace(/\+/g, ' ')
  }
}

type CallbackStatus = 'processing' | 'error' | 'timed_out'

export default function AuthCallbackPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<CallbackStatus>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const oauthError = readOAuthError()
    if (oauthError) {
      setErrorMessage(friendlyCallbackError(oauthError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (status === 'error') return
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isLoading, isAuthenticated, status, navigate])

  // Failure-mode safety net: if no error was detected in the URL AND the
  // session never resolves within a reasonable window (a stalled network
  // request, an expired/already-consumed auth code, or any other silent
  // failure inside the client's own internal exchange), don't leave the
  // player staring at a spinner forever. Depends on isAuthenticated (not
  // just status) so the timer is explicitly cleared the moment
  // authentication succeeds — relying solely on component unmount via
  // the navigate() effect above would still be correct in the real app
  // (unmounting runs this effect's cleanup too), but this makes the
  // guarantee explicit rather than incidental to render/navigation
  // timing.
  useEffect(() => {
    if (status !== 'processing' || isAuthenticated) return
    const timer = window.setTimeout(() => {
      setStatus((current) => (current === 'processing' ? 'timed_out' : current))
    }, CALLBACK_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [status, isAuthenticated])

  if (status === 'error' || status === 'timed_out') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="chr-panel-arcane w-full max-w-sm p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white mb-3">
            {status === 'timed_out' ? 'Sign-in is taking too long' : 'Sign-in didn\u2019t complete'}
          </h1>
          <p role="alert" className="text-harm-400 text-sm mb-6">
            {status === 'timed_out'
              ? 'This is taking longer than expected. Your connection may be slow, or the session may not have been restored correctly.'
              : errorMessage}
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/login">
              <Button type="button" variant="arcane" className="w-full">Back to Sign In</Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoadingSpinner size="lg" label="Signing you in…" />
    </main>
  )
}
