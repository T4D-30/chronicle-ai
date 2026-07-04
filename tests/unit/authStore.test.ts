/**
 * authStore Tests — Phase 10.5
 *
 * Mocks authService (not the low-level Supabase client) to isolate the
 * store's own logic — how it reacts to what authService returns — from
 * authService's own implementation (covered separately in
 * authService.test.ts). Supersedes the old, much thinner auth.test.ts
 * (setUser-only coverage); this file covers the same store comprehensively,
 * including initialize()'s session restoration and onAuthStateChange
 * subscription, and signOut()'s full state-clearing behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const signOutMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    authService: {
      ...actual.authService,
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  }
})

import { useAuthStore } from '@/store/authStore'

const FAKE_USER = { id: 'user-1', email: 'hero@chronicle.ai' }
const FAKE_SESSION = {
  access_token: 'fake-token',
  user: FAKE_USER,
} as never

function resetStore() {
  useAuthStore.setState({ user: null, session: null, isLoading: true, isAuthenticated: false })
}

beforeEach(() => {
  getSessionMock.mockReset()
  onAuthStateChangeMock.mockReset()
  signOutMock.mockReset()
  onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  resetStore()
})

describe('authStore — initial state', () => {
  it('starts with no user', () => {
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('starts as not authenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('authStore — direct setters', () => {
  it('setUser updates user and derives isAuthenticated: true for a real user', () => {
    const store = useAuthStore.getState()
    store.setUser({ id: 'test-123', email: 'hero@chronicle.ai' } as never)
    expect(useAuthStore.getState().user).toEqual({ id: 'test-123', email: 'hero@chronicle.ai' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('setUser(null) derives isAuthenticated: false', () => {
    const store = useAuthStore.getState()
    store.setUser({ id: 'test-123' } as never)
    store.setUser(null)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('setSession updates session independently of user/isAuthenticated', () => {
    const store = useAuthStore.getState()
    store.setSession(FAKE_SESSION)
    expect(useAuthStore.getState().session).toEqual(FAKE_SESSION)
  })

  it('setLoading toggles isLoading', () => {
    const store = useAuthStore.getState()
    store.setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
    store.setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
  })
})

describe('authStore.initialize — session restoration (returning user)', () => {
  it('restores an existing session on initialize', async () => {
    getSessionMock.mockResolvedValue(FAKE_SESSION)
    await useAuthStore.getState().initialize()
    const state = useAuthStore.getState()
    expect(state.session).toEqual(FAKE_SESSION)
    expect(state.user).toEqual(FAKE_USER)
    expect(state.isAuthenticated).toBe(true)
  })

  it('sets isLoading to false once the session resolves', async () => {
    getSessionMock.mockResolvedValue(FAKE_SESSION)
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('sets isLoading to true at the start of initialize (before getSession resolves)', () => {
    getSessionMock.mockReturnValue(new Promise(() => {}))
    useAuthStore.setState({ isLoading: false })
    void useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isLoading).toBe(true)
  })

  it('subscribes to onAuthStateChange after restoring the session', async () => {
    getSessionMock.mockResolvedValue(FAKE_SESSION)
    await useAuthStore.getState().initialize()
    expect(onAuthStateChangeMock).toHaveBeenCalledOnce()
  })
})

describe('authStore.initialize — no existing session (new/logged-out user)', () => {
  it('leaves user null and isAuthenticated false when there is no session', async () => {
    getSessionMock.mockResolvedValue(null)
    await useAuthStore.getState().initialize()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('still subscribes to onAuthStateChange even with no existing session — this is how a fresh Google OAuth callback session gets picked up', async () => {
    getSessionMock.mockResolvedValue(null)
    await useAuthStore.getState().initialize()
    expect(onAuthStateChangeMock).toHaveBeenCalledOnce()
  })
})

describe('authStore.initialize — error handling', () => {
  it('sets isLoading to false even if getSession throws, rather than hanging forever', async () => {
    getSessionMock.mockRejectedValue(new Error('Network error.'))
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('does not throw out of initialize() itself when getSession fails', async () => {
    getSessionMock.mockRejectedValue(new Error('Network error.'))
    await expect(useAuthStore.getState().initialize()).resolves.not.toThrow()
  })

  it('leaves user/session unset when getSession fails', async () => {
    getSessionMock.mockRejectedValue(new Error('Network error.'))
    await useAuthStore.getState().initialize()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})

describe('authStore — onAuthStateChange subscription (drives OAuth callback session pickup)', () => {
  it('updates user/session/isAuthenticated when the subscribed callback fires with a new session', async () => {
    getSessionMock.mockResolvedValue(null)
    let capturedCallback: ((event: string, session: unknown) => void) | undefined
    onAuthStateChangeMock.mockImplementation((cb) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    capturedCallback?.('SIGNED_IN', FAKE_SESSION)

    const state = useAuthStore.getState()
    expect(state.session).toEqual(FAKE_SESSION)
    expect(state.user).toEqual(FAKE_USER)
    expect(state.isAuthenticated).toBe(true)
  })

  it('clears user/session/isAuthenticated when the subscribed callback fires with a null session (e.g. token expiry)', async () => {
    getSessionMock.mockResolvedValue(FAKE_SESSION)
    let capturedCallback: ((event: string, session: unknown) => void) | undefined
    onAuthStateChangeMock.mockImplementation((cb) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    capturedCallback?.('SIGNED_OUT', null)

    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})

describe('authStore.signOut — logout', () => {
  it('calls authService.signOut', async () => {
    signOutMock.mockResolvedValue(undefined)
    useAuthStore.setState({ user: { id: 'user-1' } as never, session: FAKE_SESSION, isAuthenticated: true })
    await useAuthStore.getState().signOut()
    expect(signOutMock).toHaveBeenCalledOnce()
  })

  it('clears user, session, and isAuthenticated after a successful sign-out', async () => {
    signOutMock.mockResolvedValue(undefined)
    useAuthStore.setState({ user: { id: 'user-1' } as never, session: FAKE_SESSION, isAuthenticated: true })
    await useAuthStore.getState().signOut()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('propagates an error from authService.signOut rather than silently clearing state', async () => {
    signOutMock.mockRejectedValue(new Error('Network error during sign out.'))
    useAuthStore.setState({ user: { id: 'user-1' } as never, session: FAKE_SESSION, isAuthenticated: true })
    await expect(useAuthStore.getState().signOut()).rejects.toThrow('Network error during sign out.')
  })

  it('does not clear state if signOut fails — the user is still genuinely signed in', async () => {
    signOutMock.mockRejectedValue(new Error('Network error.'))
    useAuthStore.setState({ user: { id: 'user-1' } as never, session: FAKE_SESSION, isAuthenticated: true })
    await useAuthStore.getState().signOut().catch(() => {})
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).not.toBeNull()
  })
})
