import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getCampaign,
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  getResumableSession,
  getRecentTurns,
  ServiceError,
} from '@/lib/supabase'
import type { Campaign, GameSession, NarrativeTurn } from '@/lib/supabase'
import { Button, LoadingSpinner, Badge } from '@/components/ui'

// ─── Session state machine ────────────────────────────────────────────────────

type PageStatus =
  | 'loading'        // loading campaign + checking for existing session
  | 'ready_to_start' // no existing session — offer "Start Session"
  | 'resuming'       // resume action in flight
  | 'active'         // session is live/paused — main UI
  | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export default function CampaignSessionPage() {
  const { id: campaignId } = useParams<{ id: string }>()

  const [pageStatus, setPageStatus]   = useState<PageStatus>('loading')
  const [campaign, setCampaign]       = useState<Campaign | null>(null)
  const [session, setSession]         = useState<GameSession | null>(null)
  const [turns, setTurns]             = useState<NarrativeTurn[]>([])
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [actionInFlight, setActionInFlight] = useState(false)

  const turnsEndRef = useRef<HTMLDivElement>(null)

  // ── Load campaign + check for existing session ─────────────────────────────

  const load = useCallback(async () => {
    if (!campaignId) { setErrorMsg('No campaign ID in URL.'); setPageStatus('error'); return }
    setPageStatus('loading')
    try {
      const [c, s] = await Promise.all([
        getCampaign(campaignId),
        getResumableSession(campaignId),
      ])
      setCampaign(c)
      if (s) {
        setSession(s)
        const recent = await getRecentTurns(s.id, 20)
        setTurns(recent)
        setPageStatus('active')
      } else {
        setPageStatus('ready_to_start')
      }
    } catch (err) {
      setErrorMsg(err instanceof ServiceError ? err.message : 'Failed to load session.')
      setPageStatus('error')
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (turnsEndRef.current && typeof turnsEndRef.current.scrollIntoView === 'function') { turnsEndRef.current.scrollIntoView({ behavior: 'smooth' }) }
  }, [turns])

  // ── Session actions ────────────────────────────────────────────────────────

  async function handleStart() {
    if (!campaignId) return
    setActionInFlight(true)
    setPageStatus('resuming')
    try {
      const s = await startSession(campaignId)
      setSession(s)
      setTurns([])
      setPageStatus('active')
    } catch (err) {
      setErrorMsg(err instanceof ServiceError ? err.message : 'Failed to start session.')
      setPageStatus('error')
    } finally { setActionInFlight(false) }
  }

  async function handleResume() {
    if (!session) return
    setActionInFlight(true)
    try {
      const s = await resumeSession(session.id)
      setSession(s)
    } catch (err) {
      setErrorMsg(err instanceof ServiceError ? err.message : 'Failed to resume session.')
    } finally { setActionInFlight(false) }
  }

  async function handlePause() {
    if (!session) return
    setActionInFlight(true)
    try {
      const s = await pauseSession(session.id)
      setSession(s)
    } catch (err) {
      setErrorMsg(err instanceof ServiceError ? err.message : 'Failed to pause session.')
    } finally { setActionInFlight(false) }
  }

  async function handleEnd() {
    if (!session) return
    setActionInFlight(true)
    try {
      const s = await endSession(session.id)
      setSession(s)
    } catch (err) {
      setErrorMsg(err instanceof ServiceError ? err.message : 'Failed to end session.')
    } finally { setActionInFlight(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const backLink = campaignId ? `/campaigns/${campaignId}` : '/campaigns'

  if (pageStatus === 'loading' || pageStatus === 'resuming') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label={pageStatus === 'resuming' ? 'Starting session…' : 'Loading…'} />
      </main>
    )
  }

  if (pageStatus === 'error' || !campaign) {
    return (
      <main className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="chr-panel p-8 text-center max-w-md">
          <p className="text-harm-400 mb-4">{errorMsg ?? 'Something went wrong.'}</p>
          <Link to={backLink}><Button variant="ghost">Go Back</Button></Link>
        </div>
      </main>
    )
  }

  if (pageStatus === 'ready_to_start') {
    return (
      <main className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="chr-panel-arcane p-10 text-center max-w-md w-full">
          <p className="stat-label text-arcane-500 mb-2">CHRONICLE AI</p>
          <h1 className="font-display text-2xl font-bold text-white mb-2">{campaign.title}</h1>
          {campaign.description && (
            <p className="text-void-400 text-sm mb-6">{campaign.description}</p>
          )}
          <p className="lore-text text-sm mb-8">
            "Your adventure is about to begin. Every choice matters."
          </p>
          <Button
            variant="arcane"
            className="w-full mb-3"
            onClick={() => void handleStart()}
            loading={actionInFlight}
          >
            Begin Session
          </Button>
          <Link to={backLink} className="text-void-500 hover:text-void-300 text-sm">
            Back to Campaign
          </Link>
        </div>
      </main>
    )
  }

  // pageStatus === 'active'
  const isSessionActive = session?.status === 'active'
  const isSessionPaused = session?.status === 'paused'
  const isSessionDone   = session?.status === 'completed'

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header bar */}
      <header className="border-b border-void-700/50 px-4 py-3 flex items-center justify-between gap-4 bg-void-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={backLink} className="text-void-400 hover:text-arcane-300 text-sm flex-shrink-0">
            ← Campaign
          </Link>
          <h1 className="font-display text-white truncate">{campaign.title}</h1>
          {session && (
            <Badge
              variant={isSessionActive ? 'spirit' : isSessionPaused ? 'arcane' : 'neutral'}
            >
              {isSessionActive ? 'Active' : isSessionPaused ? 'Paused' : 'Complete'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isSessionActive && (
            <Button
              type="button" variant="ghost" size="sm"
              onClick={() => void handlePause()}
              loading={actionInFlight}
            >
              Pause
            </Button>
          )}
          {isSessionPaused && (
            <Button
              type="button" variant="arcane" size="sm"
              onClick={() => void handleResume()}
              loading={actionInFlight}
            >
              Resume
            </Button>
          )}
          {!isSessionDone && (
            <Button
              type="button" variant="danger" size="sm"
              onClick={() => void handleEnd()}
              loading={actionInFlight}
            >
              End Session
            </Button>
          )}
        </div>
      </header>

      {/* Session body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="stat-label text-spirit-400">SESSION IN PROGRESS</p>
            <p className="lore-text text-void-400 max-w-sm">
              {isSessionPaused
                ? 'This session is paused. Resume to continue your adventure.'
                : isSessionDone
                  ? 'This session has ended.'
                  : 'AI narration will appear here as the adventure unfolds. (Coming in Phase 2 — AI Narration)'}
            </p>
            {isSessionDone && (
              <Link to={backLink}>
                <Button variant="ghost">Return to Campaign</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {turns.map((turn) => (
              <TurnEntry key={turn.id} turn={turn} />
            ))}
          </div>
        )}
        <div ref={turnsEndRef} />
      </div>

      {/* Session footer info */}
      {session && (
        <footer className="border-t border-void-700/50 px-4 py-2 bg-void-900/50 text-xs text-void-600 flex justify-between">
          <span>Turn {session.turnNumber}</span>
          <span>Session {session.id.slice(0, 8)}…</span>
        </footer>
      )}
    </main>
  )
}

function TurnEntry({ turn }: { turn: NarrativeTurn }) {
  return (
    <div className="chr-panel p-4 rounded-lg flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="stat-label text-void-500">Turn {turn.turnNumber}</span>
        <span className="stat-label text-void-700">{turn.mode}</span>
      </div>
      {turn.playerInput && (
        <p className="text-arcane-300 text-sm">&gt; {turn.playerInput}</p>
      )}
      {turn.aiNarration && (
        <p className="text-void-200 text-sm font-lore">{turn.aiNarration}</p>
      )}
    </div>
  )
}
