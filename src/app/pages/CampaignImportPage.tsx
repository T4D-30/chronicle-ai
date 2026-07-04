/**
 * CampaignImportPage — Phase 10.2
 *
 * Pipeline: Upload → (provider.parse()) → Review (existing CampaignWizard,
 * seeded with the converted draft, landing on the Review step) → Save.
 * Mirrors CharacterImportPage (Phase 10.1) exactly.
 *
 * The review/correction/save steps are NOT duplicated here — they're the
 * exact same CampaignWizard + CampaignReviewStep + createCampaign() path
 * manual creation already uses. This page's only real job is: accept a
 * file, hand it to the active provider, convert the result to a draft,
 * and get out of the way.
 *
 * Note: a campaign still requires a character to be assigned (existing,
 * unmodified validation — see CampaignReviewStep). Import does not (and
 * architecturally cannot, since it has no character context) pre-fill
 * this — the player selects a character during Review like any other
 * campaign, imported or not.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCampaignStore } from '@/store/campaignStore'
import { CampaignWizard } from '@/components/campaign/CampaignWizard'
import { CampaignImportUpload } from '@/components/campaign/CampaignImportUpload'
import { LoadingSpinner, Badge } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import { campaignImportResultToDraft } from '@/lib/campaignImport'
import type { CampaignImportResult } from '@/lib/campaignImport'
import type { CampaignDraft } from '@/components/campaign/useCampaignDraft'
import type { Campaign } from '@/lib/supabase'

export default function CampaignImportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const upsertCampaign = useCampaignStore((s) => s.upsertCampaign)

  const [importedDraft, setImportedDraft] = useState<Partial<CampaignDraft> | null>(null)
  const [importSummary, setImportSummary] = useState<{ providerName: string; notes: string[] } | null>(null)

  function handleParsed(_file: File, result: CampaignImportResult) {
    const { draft, notes, providerName } = campaignImportResultToDraft(result)
    setImportedDraft(draft)
    setImportSummary({ providerName, notes })
  }

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
      <div className="w-full max-w-3xl mx-auto mb-6">
        <Link to="/campaigns" className="text-void-400 hover:text-arcane-300 text-sm">
          ← Back to Campaigns
        </Link>
      </div>

      {!importedDraft ? (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
          <div>
            <p className="stat-label text-arcane-500 mb-1">CHRONICLE AI</p>
            <h1 className="font-display text-3xl font-bold text-white">Import Campaign Document</h1>
            <p className="text-void-400 text-sm mt-2">
              Upload a PDF, DOCX, TXT, Markdown, or JSON document — a campaign bible,
              adventure module, or your own notes. You'll review and confirm every
              field before anything is saved — nothing is created automatically.
            </p>
          </div>
          <CampaignImportUpload onParsed={handleParsed} />
        </div>
      ) : (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
          {importSummary && (
            <PixelPanel variant={importSummary.notes.length > 0 ? 'harm' : 'spirit'} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={importSummary.notes.length > 0 ? 'harm' : 'spirit'}>
                  {importSummary.providerName}
                </Badge>
                <span className="font-pixel-display text-[8px] text-void-400 uppercase">Import Result</span>
              </div>
              {importSummary.notes.length > 0 ? (
                importSummary.notes.map((note, i) => (
                  <p key={i} className="text-void-300 text-sm">{note}</p>
                ))
              ) : (
                <p className="text-void-300 text-sm">
                  Review every field below carefully before saving — automatic extraction can make mistakes.
                </p>
              )}
            </PixelPanel>
          )}
          <CampaignWizard
            userId={user.id}
            initialDraft={importedDraft}
            initialStep="review"
            onCreated={handleCreated}
            onCancel={() => navigate('/campaigns')}
          />
        </div>
      )}
    </main>
  )
}
