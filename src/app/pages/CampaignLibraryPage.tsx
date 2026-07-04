import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCampaignStore } from '@/store/campaignStore'
import { Button, Input, ConfirmDialog, SkeletonGrid } from '@/components/ui'
import { CampaignCard } from '@/components/campaign/CampaignCard'

export default function CampaignLibraryPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const {
    campaigns,
    isLoading,
    error,
    fetchCampaigns,
    removeCampaign,
    clearError,
  } = useCampaignStore()

  const [search, setSearch]               = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting]       = useState(false)

  useEffect(() => {
    if (user?.id) void fetchCampaigns(user.id)
  }, [user?.id, fetchCampaigns])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      (c.description ?? '').toLowerCase().includes(q) ||
      (c.tone ?? '').toLowerCase().includes(q) ||
      c.difficulty.toLowerCase().includes(q),
    )
  }, [campaigns, search])

  async function confirmDelete() {
    if (!pendingDeleteId) return
    setIsDeleting(true)
    await removeCampaign(pendingDeleteId)
    setIsDeleting(false)
    setPendingDeleteId(null)
  }

  const pendingCampaign = campaigns.find((c) => c.id === pendingDeleteId)

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="stat-label text-arcane-500 mb-1">CHRONICLE AI</p>
            <h1 className="font-display text-3xl font-bold text-white">Campaigns</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/campaigns/import">
              <Button variant="ghost">Import Campaign</Button>
            </Link>
            <Link to="/campaigns/new">
              <Button variant="arcane">+ New Campaign</Button>
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <Input
            placeholder="Search by title, tone, or difficulty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search campaigns"
          />
        </div>

        {error && (
          <div className="chr-panel p-4 rounded-lg border-harm-600/40 mb-6 flex items-center justify-between gap-4">
            <p className="text-harm-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
          </div>
        )}

        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={search.trim().length > 0} hasAnyCampaigns={campaigns.length > 0} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onOpen={(id) => navigate(`/campaigns/${id}`)}
                onDelete={(id) => setPendingDeleteId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this campaign?"
        description={
          pendingCampaign
            ? `"${pendingCampaign.title}" and all its sessions will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  )
}

function EmptyState({ hasSearch, hasAnyCampaigns }: { hasSearch: boolean; hasAnyCampaigns: boolean }) {
  if (hasSearch) {
    return (
      <div className="chr-panel p-8 rounded-lg text-center">
        <p className="text-void-400">No campaigns match your search.</p>
      </div>
    )
  }
  if (hasAnyCampaigns) return null
  return (
    <div className="chr-panel-arcane p-10 rounded-lg text-center">
      <p className="font-lore text-void-300 italic mb-4">
        "Every great adventure begins with a single decision."
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link to="/campaigns/new">
          <Button variant="arcane">Start Your First Campaign</Button>
        </Link>
        <Link to="/campaigns/import">
          <Button variant="ghost">Import a Document</Button>
        </Link>
      </div>
    </div>
  )
}
