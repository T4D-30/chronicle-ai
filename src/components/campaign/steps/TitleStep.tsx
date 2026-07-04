import { Input } from '@/components/ui'
import type { CampaignDraft } from '../useCampaignDraft'
import { CAMPAIGN_TITLE_MAX_LENGTH } from '../useCampaignDraft'

interface TitleStepProps {
  draft: CampaignDraft
  onChange: (patch: Partial<CampaignDraft>) => void
}

export function TitleStep({ draft, onChange }: TitleStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Campaign Title"
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="The Shattered Throne"
        maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
        hint={`Up to ${CAMPAIGN_TITLE_MAX_LENGTH} characters.`}
        autoFocus
      />
    </div>
  )
}
