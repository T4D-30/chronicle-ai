import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-generated'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Chronicle AI] Missing Supabase environment variables.\n' +
      'Copy .env.example to .env.local and fill in your project credentials.',
  )
}

/**
 * The Supabase client instance, fully typed against the generated Database schema.
 *
 * Types are generated from the live local schema via `npm run db:types`.
 * JSONB columns are typed as `Json` (the supabase-js canonical type) at the DB
 * boundary. Service modules cast to domain types (ActiveCondition[], etc.)
 * after reads, and to Json before writes. This is the standard Supabase pattern.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export type SupabaseClient = typeof supabase
