import { useAuthStore } from '@/store/authStore'

/**
 * Primary auth hook. All components that need auth state should use this.
 * Wraps Zustand store to provide a clean, stable API.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const signOut = useAuthStore((s) => s.signOut)

  return { user, session, isLoading, isAuthenticated, signOut }
}
