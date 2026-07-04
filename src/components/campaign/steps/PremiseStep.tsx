import { Textarea } from '@/components/ui'
import type { CampaignDraft } from '../useCampaignDraft'

interface PremiseStepProps {
  draft: CampaignDraft
  onChange: (patch: Partial<CampaignDraft>) => void
}

export function PremiseStep({ draft, onChange }: PremiseStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Textarea
        label="Campaign Premise"
        value={draft.premise}
        onChange={(e) => onChange({ premise: e.target.value })}
        placeholder="A kingdom teeters on the edge of civil war. The old king is dead, three heirs dispute the throne, and something ancient stirs beneath the capital…"
        rows={6}
        hint="Optional. A short concept or hook — a few sentences is plenty. The Director will build from here."
      />
      <p className="text-void-500 text-xs italic">
        You can skip this and dive straight in. Premise can be added later.
      </p>
    </div>
  )
}
