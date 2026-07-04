import { Badge, Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import { statusLabel, statusVariant, toneLabel, difficultyLabel } from './campaignContent'
import type { Campaign } from '@/lib/supabase'

interface CampaignCardProps {
  campaign: Campaign
  onOpen:   (id: string) => void
  onDelete: (id: string) => void
}

/** Save-slot presentation — Phase 9.1 retro RPG integration. */
export function CampaignCard({ campaign, onOpen, onDelete }: CampaignCardProps) {
  const canContinue = campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'idle'

  return (
    <PixelPanel
      variant={campaign.status === 'active' ? 'arcane' : 'default'}
      glow={campaign.status === 'active'}
      className="p-4 flex flex-col gap-3 transition-colors"
    >
      <button
        type="button"
        onClick={() => onOpen(campaign.id)}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
      >
        <p className="font-pixel-display text-[7px] text-void-600 uppercase mb-1">Save File</p>
        <h3 className="font-display text-lg text-white truncate">{campaign.title}</h3>
        {campaign.description && (
          <p className="font-pixel-body text-base text-void-400 line-clamp-2 mt-0.5">{campaign.description}</p>
        )}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(campaign.status)}>{statusLabel(campaign.status)}</Badge>
        <Badge variant="neutral">{toneLabel(campaign.tone ?? 'heroic')}</Badge>
        <Badge variant="neutral">{difficultyLabel(campaign.difficulty)}</Badge>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <Button
          type="button"
          variant={canContinue ? 'arcane' : 'ghost'}
          size="sm"
          onClick={() => onOpen(campaign.id)}
        >
          {campaign.status === 'idle' ? 'Open' : campaign.status === 'completed' ? 'View' : 'Continue'}
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => onDelete(campaign.id)}
        >
          Delete
        </Button>
      </div>
    </PixelPanel>
  )
}
