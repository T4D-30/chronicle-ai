import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCampaignStore } from '@/store/campaignStore'
import { CampaignWizard } from '@/components/campaign/CampaignWizard'
import { LoadingSpinner } from '@/components/ui'
import type { Campaign } from '@/lib/supabase'

export default function CampaignCreatePage() {
  const { user }        = useAuth()
  const navigate         = useNavigate()
  const upsertCampaign   = useCampaignStore((s) => s.upsertCampaign)

  function handleCreated(campaign: Campaign) {
    upsertCampaign(campaign)
    navigate(`/campaigns/${campaign.id}`)
  }

  if (!user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Loading…" />
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <CampaignWizard
        userId={user.id}
        onCreated={handleCreated}
        onCancel={() => navigate('/campaigns')}
      />
    </main>
  )
}
