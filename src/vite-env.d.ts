/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production'
  readonly VITE_ENABLE_DEBUG_PANEL: string
  /** Reserved for future React DevTools / performance overlay integration. Currently unused in source. */
  readonly VITE_ENABLE_DEV_TOOLS: string
  readonly VITE_ENABLE_MOCK_AI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
