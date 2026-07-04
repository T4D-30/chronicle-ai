/**
 * authService Tests — Phase 10.5
 *
 * Tests the REAL authService implementation (src/lib/supabase/auth.ts)
 * against the global Supabase client mock (tests/setup.ts) — unlike
 * LoginPage/SignupPage/GoogleSignInButton's tests, which mock authService
 * itself to isolate component behavior, this file verifies the service
 * layer's own logic: correct argument passing to the underlying
 * supabase-js calls, and correct error propagation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase/client'
import { authService } from '@/lib/supabase/auth'

describe('authService.signIn', () => {
  it('calls supabase.auth.signInWithPassword with the given credentials', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null }, error: null,
    } as never)
    await authService.signIn({ email: 'hero@chronicle.ai', password: 'hunter2' })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'hero@chronicle.ai', password: 'hunter2',
    })
  })

  it('throws the underlying error on failure', async () => {
    const authError = { message: 'Invalid login credentials.', name: 'AuthApiError' }
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null }, error: authError,
    } as never)
    await expect(authService.signIn({ email: 'hero@chronicle.ai', password: 'wrong' }))
      .rejects.toEqual(authError)
  })
})

describe('authService.signUp', () => {
  it('calls supabase.auth.signUp with email, password, and display_name in options.data', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null }, error: null,
    } as never)
    await authService.signUp({ email: 'hero@chronicle.ai', password: 'hunter2', displayName: 'Aldric Sorn' })
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'hero@chronicle.ai',
      password: 'hunter2',
      options: { data: { display_name: 'Aldric Sorn' } },
    })
  })

  it('defaults display_name to an empty string when not provided', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null }, error: null,
    } as never)
    await authService.signUp({ email: 'hero@chronicle.ai', password: 'hunter2' })
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'hero@chronicle.ai',
      password: 'hunter2',
      options: { data: { display_name: '' } },
    })
  })

  it('throws the underlying error on failure', async () => {
    const authError = { message: 'Email already registered.', name: 'AuthApiError' }
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null }, error: authError,
    } as never)
    await expect(authService.signUp({ email: 'hero@chronicle.ai', password: 'hunter2' }))
      .rejects.toEqual(authError)
  })
})

describe('authService.signInWithGoogle', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'https://chronicle.example.com' })
  })

  it('calls supabase.auth.signInWithOAuth with provider: google', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/...' }, error: null,
    } as never)
    await authService.signInWithGoogle()
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })

  it('sets redirectTo to the app origin plus /auth/callback', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/...' }, error: null,
    } as never)
    await authService.signInWithGoogle()
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://chronicle.example.com/auth/callback' },
    })
  })

  it('returns the data returned by signInWithOAuth on success', async () => {
    const responseData = { provider: 'google' as const, url: 'https://accounts.google.com/o/oauth2/...' }
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({ data: responseData, error: null } as never)
    const result = await authService.signInWithGoogle()
    expect(result).toEqual(responseData)
  })

  it('throws the underlying error when signInWithOAuth fails (e.g. provider not configured)', async () => {
    const authError = { message: 'Unsupported provider: provider is not enabled', name: 'AuthApiError' }
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google', url: '' }, error: authError,
    } as never)
    await expect(authService.signInWithGoogle()).rejects.toEqual(authError)
  })
})

describe('authService.signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })
    await authService.signOut()
    expect(supabase.auth.signOut).toHaveBeenCalledOnce()
  })

  it('throws the underlying error on failure', async () => {
    const authError = { message: 'Network error during sign out.', name: 'AuthApiError' }
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: authError } as never)
    await expect(authService.signOut()).rejects.toEqual(authError)
  })
})

describe('authService.getSession', () => {
  it('returns the session from supabase.auth.getSession', async () => {
    const fakeSession = { access_token: 'abc', user: { id: 'user-1' } }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: fakeSession }, error: null,
    } as never)
    const session = await authService.getSession()
    expect(session).toEqual(fakeSession)
  })

  it('returns null when there is no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    const session = await authService.getSession()
    expect(session).toBeNull()
  })

  it('throws the underlying error on failure', async () => {
    const authError = { message: 'Session lookup failed.', name: 'AuthApiError' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: authError } as never)
    await expect(authService.getSession()).rejects.toEqual(authError)
  })
})

describe('authService.getUser', () => {
  it('returns the user from supabase.auth.getUser', async () => {
    const fakeUser = { id: 'user-1', email: 'hero@chronicle.ai' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: fakeUser }, error: null } as never)
    const user = await authService.getUser()
    expect(user).toEqual(fakeUser)
  })

  it('throws the underlying error on failure', async () => {
    const authError = { message: 'Expired session.', name: 'AuthApiError' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: authError } as never)
    await expect(authService.getUser()).rejects.toEqual(authError)
  })
})

describe('authService.onAuthStateChange', () => {
  it('delegates directly to supabase.auth.onAuthStateChange with the given callback', () => {
    const callback = vi.fn()
    authService.onAuthStateChange(callback)
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(callback)
  })
})
