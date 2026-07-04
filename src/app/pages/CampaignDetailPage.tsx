import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getCampaign,
  updateCampaign,
  getResumableSession,
  ServiceError,
} from '@/lib/supabase'
import type { Campaign, GameSession } from '@/lib/supabase'
import { useCampaignStore } from '@/store/campaignStore'
import { useCharacterStore } from '@/store/characterStore'
import { useAuth } from '@/hooks/useAuth'
import {
  Button, LoadingSpinner, Badge, Input, Textarea, ConfirmDialog,
} from '@/components/ui'
import {
  statusLabel, statusVariant, toneLabel, difficultyLabel, rulesStyleLabel,
} from '@/components/campaign/campaignContent'
import { DirectorDocumentsPanel } from '@/components/campaign/DirectorDocumentsPanel'

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const upsertCampaign   = useCampaignStore((s) => s.upsertCampaign)
  const { characters, fetchCharacters } = useCharacterStore()

  const [campaign, setCampaign]       = useState<Campaign | null>(null)
  const [session, setSession]         = useState<GameSession | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [isSaving, setIsSaving]       = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

  // Inline edit state
  const [editingTitle, setEditingTitle]       = useState(false)
  const [titleDraft, setTitleDraft]           = useState('')
  const [editingDesc, setEditingDesc]         = useState(false)
  const [descDraft, setDescDraft]             = useState('')
  const [editingCharacter, setEditingCharacter] = useState(false)

  const [pendingDelete, setPendingDelete]     = useState(false)
  const removeCampaign = useCampaignStore((s) => s.removeCampaign)

  useEffect(() => {
    if (!id) { setLoadError('No campaign selected.'); setIsLoading(false); return }
    let mounted = true

    async function load() {
      if (!id) { setLoadError('No campaign selected.'); setIsLoading(false); return }
      setIsLoading(true)
      try {
        const [c, s] = await Promise.all([
          getCampaign(id),
          getResumableSession(id),
        ])
        if (!mounted) return
        setCampaign(c)
        setSession(s)
      } catch (err) {
        if (mounted) setLoadError(err instanceof ServiceError ? err.message : 'Failed to load campaign.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [id])

  // Fetch characters so we can display the assigned character's name
  useEffect(() => {
    if (user?.id) void fetchCharacters(user.id)
  }, [user?.id, fetchCharacters])

  async function saveTitle() {
    if (!campaign || !id) return
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === campaign.title) { setEditingTitle(false); return }
    setIsSaving(true); setSaveError(null)
    try {
      const updated = await updateCampaign(id, { title: trimmed })
      setCampaign(updated); upsertCampaign(updated); setEditingTitle(false)
    } catch (err) {
      setSaveError(err instanceof ServiceError ? err.message : 'Save failed.')
    } finally { setIsSaving(false) }
  }

  async function saveDescription() {
    if (!campaign || !id) return
    setIsSaving(true); setSaveError(null)
    try {
      const updated = await updateCampaign(id, { description: descDraft })
      setCampaign(updated); upsertCampaign(updated); setEditingDesc(false)
    } catch (err) {
      setSaveError(err instanceof ServiceError ? err.message : 'Save failed.')
    } finally { setIsSaving(false) }
  }

  async function saveCharacter(characterId: string | null) {
    if (!campaign || !id) return
    setIsSaving(true); setSaveError(null)
    try {
      const updated = await updateCampaign(id, { characterId })
      setCampaign(updated); upsertCampaign(updated); setEditingCharacter(false)
    } catch (err) {
      setSaveError(err instanceof ServiceError ? err.message : 'Save failed.')
    } finally { setIsSaving(false) }
  }

  async function handleDelete() {
    if (!id) return
    await removeCampaign(id)
    navigate('/campaigns')
  }

  if (isLoading) return (
    <main className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" label="Loading campaign…" />
    </main>
  )

  if (loadError || !campaign) return (
    <main className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="chr-panel p-8 text-center max-w-md">
        <p className="text-harm-400 mb-4">{loadError ?? 'Campaign not found.'}</p>
        <Link to="/campaigns"><Button variant="ghost">Back to Campaigns</Button></Link>
      </div>
    </main>
  )

  const assignedCharacter = campaign.characterId
    ? characters.find((c) => c.id === campaign.characterId)
    : null

  // Primary CTA links to the Adventure Hub for full gameplay
  // The legacy /session page remains for backward-compat
  const adventureButtonLabel =
    session?.status === 'active' ? 'Continue Adventure' :
    session?.status === 'paused' ? 'Resume Adventure'   :
    'Begin Adventure'

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <Link to="/campaigns" className="text-void-400 hover:text-arcane-300 text-sm">
            ← Back to Campaigns
          </Link>
          {saveError && <p className="text-harm-400 text-xs">{saveError}</p>}
        </div>

        <div className="chr-panel-arcane p-6 md:p-8 flex flex-col gap-6">
          {/* Title */}
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={120}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              />
              <Button variant="arcane" size="sm" onClick={() => void saveTitle()} loading={isSaving}>Save</Button>
              <Button variant="ghost"  size="sm" onClick={() => setEditingTitle(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-3xl font-bold text-white">{campaign.title}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant={statusVariant(campaign.status)}>{statusLabel(campaign.status)}</Badge>
                  <Badge variant="neutral">{toneLabel(campaign.tone ?? 'heroic')}</Badge>
                  <Badge variant="neutral">{difficultyLabel(campaign.difficulty)}</Badge>
                  <Badge variant="neutral">{rulesStyleLabel(campaign.directorConfig.rulesStyle ?? 'standard')}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setTitleDraft(campaign.title); setEditingTitle(true) }}>
                Edit
              </Button>
            </div>
          )}

          {/* Description / premise */}
          {editingDesc ? (
            <div className="flex flex-col gap-2">
              <Textarea
                label="Premise"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                rows={4}
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="arcane" size="sm" onClick={() => void saveDescription()} loading={isSaving}>Save</Button>
                <Button variant="ghost"  size="sm" onClick={() => setEditingDesc(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <p className="flex-1 text-void-400 text-sm">
                {campaign.description ?? <span className="italic">No premise set.</span>}
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setDescDraft(campaign.description ?? ''); setEditingDesc(true) }}>
                Edit
              </Button>
            </div>
          )}

          <div className="chr-divider" />

          {/* Character */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="stat-label text-void-500">Character</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingCharacter((v) => !v)}
              >
                {editingCharacter ? 'Cancel' : 'Change'}
              </Button>
            </div>

            {editingCharacter ? (
              <div className="flex flex-col gap-2">
                {campaign.characterId && (
                  <button
                    type="button"
                    onClick={() => void saveCharacter(null)}
                    className="text-xs text-harm-400 hover:text-harm-300 text-left"
                  >
                    Remove character assignment
                  </button>
                )}
                {characters.length === 0 ? (
                  <p className="text-void-500 text-sm">No characters available.</p>
                ) : (
                  characters.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveCharacter(char.id)}
                      className={[
                        'flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg border transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                        char.id === campaign.characterId
                          ? 'bg-arcane-900/40 border-arcane-500'
                          : 'bg-void-900 border-void-700/50 hover:border-void-500',
                        isSaving ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-void-800 border border-void-700 flex items-center justify-center">
                        {char.portraitUrl ? (
                          <img src={char.portraitUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-xs text-void-500">
                            {char.sheet.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-body font-semibold text-white">{char.sheet.name}</p>
                        <p className="text-void-400 text-xs capitalize">
                          Level {char.sheet.level} {char.sheet.ancestry} {char.sheet.archetype}
                        </p>
                      </div>
                      {char.id === campaign.characterId && (
                        <span className="ml-auto text-arcane-300 text-xs font-mono">✓ Current</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            ) : campaign.characterId ? (
              assignedCharacter ? (
                <Link to={`/characters/${campaign.characterId}`} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-void-800 border border-void-700 flex items-center justify-center">
                    {assignedCharacter.portraitUrl ? (
                      <img src={assignedCharacter.portraitUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-void-500">
                        {assignedCharacter.sheet.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-body font-semibold text-white group-hover:text-arcane-300 transition-colors">
                      {assignedCharacter.sheet.name}
                    </p>
                    <p className="text-void-400 text-xs capitalize">
                      Level {assignedCharacter.sheet.level} {assignedCharacter.sheet.ancestry} {assignedCharacter.sheet.archetype}
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-void-400 text-sm">Character ID: {campaign.characterId}</p>
              )
            ) : (
              <p className="text-void-500 text-sm italic">
                No character assigned.{' '}
                <button
                  type="button"
                  className="text-arcane-400 hover:text-arcane-300 underline"
                  onClick={() => setEditingCharacter(true)}
                >
                  Assign one
                </button>
              </p>
            )}
          </div>

          <div className="chr-divider" />

          {/* Session CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="stat-label text-void-500 mb-1">Session</p>
              {session ? (
                <p className="text-sm text-void-300">
                  {session.status === 'active' ? 'A session is in progress.' :
                   session.status === 'paused' ? 'A session is paused.' :
                   'No active session.'}
                </p>
              ) : (
                <p className="text-sm text-void-500">No session started yet.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {campaign.status !== 'completed' && (
                <Link to={`/adventure/${campaign.id}`}>
                  <Button variant="arcane">{adventureButtonLabel}</Button>
                </Link>
              )}
              <Button variant="danger" size="sm" onClick={() => setPendingDelete(true)}>Delete</Button>
            </div>
          </div>
        </div>

        {user?.id && (
          <div className="mt-6">
            <DirectorDocumentsPanel campaignId={campaign.id} userId={user.id} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete}
        title="Delete this campaign?"
        description={`"${campaign.title}" and all its sessions will be permanently deleted.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(false)}
      />
    </main>
  )
}
