/**
 * AdventurePage
 *
 * Route: /adventure/:campaignId
 *
 * This page does NOT use AppShell — the AdventureHub IS the shell.
 * The ProtectedRoute wraps it for auth but no nav wrapper renders.
 *
 * Three states:
 *   loading      → full-screen loading screen
 *   no_character → prompt to assign a character
 *   error        → error with retry
 *   ready        → AdventureHub (the game)
 */

import { useParams, Link } from 'react-router-dom'
import { Button, LoadingSpinner } from '@/components/ui'
import { AdventureHub } from '@/components/adventure/AdventureHub'
import { useAdventureSession } from '@/components/adventure/useAdventureSession'

export default function AdventurePage() {
  const { campaignId } = useParams<{ campaignId: string }>()

  if (!campaignId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-void-950">
        <div className="chr-panel p-8 text-center max-w-sm">
          <p className="text-harm-400 mb-4">No campaign specified.</p>
          <Link to="/campaigns"><Button variant="ghost">Go to Campaigns</Button></Link>
        </div>
      </div>
    )
  }

  return <AdventureLoader campaignId={campaignId} />
}

function AdventureLoader({ campaignId }: { campaignId: string }) {
  const [state, actions] = useAdventureSession(campaignId)

  if (state.status === 'loading') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-void-950 gap-6"
        role="status"
        aria-live="polite"
        data-testid="adventure-loading"
      >
        <div className="text-center">
          <p className="stat-label text-arcane-500 mb-2">CHRONICLE AI</p>
          <h1 className="font-display text-3xl font-bold text-white mb-6">
            {state.campaign?.title ?? 'Loading…'}
          </h1>
        </div>
        <LoadingSpinner size="lg" label="Preparing your adventure…" />
        <p className="text-void-600 text-xs animate-pulse">
          Loading campaign, character, and session…
        </p>
      </div>
    )
  }

  if (state.status === 'no_character') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-void-950 px-4">
        <div className="chr-panel-arcane p-8 text-center max-w-md w-full">
          <p className="stat-label text-arcane-500 mb-2">
            {state.campaign?.title ?? 'Campaign'}
          </p>
          <h2 className="font-display text-2xl font-bold text-white mb-3">
            No Character Assigned
          </h2>
          <p className="text-void-400 text-sm mb-6">
            Assign a character to this campaign before starting an adventure.
          </p>
          <div className="flex flex-col gap-3">
            <Link to={`/campaigns/${campaignId}`}>
              <Button variant="arcane" className="w-full">
                Go to Campaign — Assign Character
              </Button>
            </Link>
            <Link to="/campaigns">
              <Button variant="ghost" className="w-full">
                Back to Campaigns
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-void-950 px-4">
        <div className="chr-panel p-8 text-center max-w-md w-full">
          <p className="text-harm-400 text-sm mb-4">
            {state.error ?? 'Failed to load adventure.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="arcane" onClick={() => void actions.reload()}>
              Retry
            </Button>
            <Link to={`/campaigns/${campaignId}`}>
              <Button variant="ghost">Back to Campaign</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // status === 'ready'
  return <AdventureHub state={state} actions={actions} />
}
