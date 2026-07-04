import type { User, Session } from '@supabase/supabase-js'

export type AuthUser = User
export type AuthSession = Session

export interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends SignInCredentials {
  displayName?: string
}
