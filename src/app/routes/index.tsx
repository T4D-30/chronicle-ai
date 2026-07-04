import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PublicRoute } from '@/components/layout/PublicRoute'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { lazy, Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui'
import NotFoundPage from '@/app/pages/NotFoundPage'

// ── Lazy-loaded pages (code-splitting per route) ──────────────────────────────
// Each page is its own dynamic chunk, loaded on-demand.
// The Suspense fallback is a full-screen spinner with accessible status role.

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" label="Loading page…" />
    </div>
  )
}

function lazyPage(importFn: () => Promise<{ default: React.ComponentType }>) {
  const LazyComponent = lazy(importFn)
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppShell><PublicRoute /></AppShell>,
    children: [
      { path: '/',       element: lazyPage(() => import('@/app/pages/LandingPage')) },
      { path: '/login',  element: lazyPage(() => import('@/app/pages/LoginPage')) },
      { path: '/signup', element: lazyPage(() => import('@/app/pages/SignupPage')) },
    ],
  },
  {
    // Standalone — deliberately NOT nested under PublicRoute or
    // ProtectedRoute. See AuthCallbackPage's own header comment for why:
    // PublicRoute would redirect an authenticated user away the instant
    // onAuthStateChange fires, before this page gets a chance to check
    // for an OAuth error or show its own "Signing you in…" state.
    path: '/auth/callback',
    element: <AppShell>{lazyPage(() => import('@/app/pages/AuthCallbackPage'))}</AppShell>,
  },
  {
    element: <AppShell><ProtectedRoute /></AppShell>,
    children: [
      { path: '/dashboard',
        element: lazyPage(() => import('@/app/pages/DashboardPage')) },
      { path: '/characters',
        element: lazyPage(() => import('@/app/pages/CharacterLibraryPage')) },
      { path: '/characters/new',
        element: lazyPage(() => import('@/app/pages/CharacterCreatePage')) },
      { path: '/characters/import',
        element: lazyPage(() => import('@/app/pages/CharacterImportPage')) },
      { path: '/characters/:id',
        element: lazyPage(() => import('@/app/pages/CharacterSheetPage')) },
      { path: '/campaigns',
        element: lazyPage(() => import('@/app/pages/CampaignLibraryPage')) },
      { path: '/campaigns/new',
        element: lazyPage(() => import('@/app/pages/CampaignCreatePage')) },
      { path: '/campaigns/import',
        element: lazyPage(() => import('@/app/pages/CampaignImportPage')) },
      { path: '/campaigns/:id',
        element: lazyPage(() => import('@/app/pages/CampaignDetailPage')) },
      { path: '/campaigns/:id/session',
        element: lazyPage(() => import('@/app/pages/CampaignSessionPage')) },
    ],
  },
  // Adventure Hub — full-viewport game shell, no AppShell wrapper.
  // ErrorBoundary wraps it separately since it's the most complex panel.
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/adventure/:campaignId',
        element: lazyPage(() => import('@/app/pages/AdventurePage')) },
    ],
  },
  {
    path: '*',
    element: <AppShell><NotFoundPage /></AppShell>,
  },
])
