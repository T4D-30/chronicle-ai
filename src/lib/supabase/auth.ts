import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from './client'
import type { SignInCredentials, SignUpCredentials } from '@/types/auth'

type AuthStateCallback = (event: AuthChangeEvent, session: Session | null) => void

export const authService = {
  async signUp({ email, password, displayName }: SignUpCredentials) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName ?? '' },
      },
    })
    if (error) throw error
    return data
  },

  async signIn({ email, password }: SignInCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  /**
   * Google OAuth sign-in. Code-complete, wired against the standard
   * Supabase `signInWithOAuth` flow — but genuinely unverified against a
   * live Google identity, since this environment has no Google Cloud
   * project or OAuth credentials to test against. See
   * docs/DEPLOYMENT.md's "Google OAuth Setup" section for the exact
   * manual steps a deployer must complete before this works end-to-end:
   * creating the OAuth client in Google Cloud Console, and enabling +
   * configuring the Google provider in the Supabase Dashboard.
   *
   * redirectTo points at a dedicated /auth/callback route (AuthCallbackPage)
   * rather than relying solely on the Supabase client's automatic
   * detectSessionInUrl token consumption (already enabled in client.ts) —
   * an explicit callback route gives the user a stable "Signing you
   * in..." moment and a single place to redirect to /dashboard from,
   * rather than depending on timing between the redirect landing and the
   * auth store's onAuthStateChange listener picking up the new session.
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  },

  onAuthStateChange(callback: AuthStateCallback) {
    return supabase.auth.onAuthStateChange(callback)
  },
}
