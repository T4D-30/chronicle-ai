import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/routes'
import { useAuthStore } from '@/store/authStore'
import '@fontsource/press-start-2p'
import '@fontsource/vt323'
import '@/styles/globals.css'
import '@/styles/pixel.css'

// Initialize auth before mounting
const initAuth = useAuthStore.getState().initialize

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('[Chronicle AI] Root element #root not found.')

// Boot auth, then render
void initAuth().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
})
