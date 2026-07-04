import { create } from 'zustand'
import type { AuthState } from '@/types/auth'
import { authService } from '@/lib/supabase'

interface AuthStore extends AuthState {
  setUser: (user: AuthState['user']) => void
  setSession: (session: AuthState['session']) => void
  setLoading: (isLoading: boolean) => void
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    set({ isLoading: true })
    try {
      const session = await authService.getSession()
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session?.user,
        isLoading: false,
      })

      authService.onAuthStateChange((_event, newSession) => {
        set({
          session: newSession,
          user: newSession?.user ?? null,
          isAuthenticated: !!newSession?.user,
        })
      })
    } catch {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    await authService.signOut()
    set({ user: null, session: null, isAuthenticated: false })
  },
}))
