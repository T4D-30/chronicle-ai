import { Textarea } from '@/components/ui'
import type { CampaignDraft } from '../useCampaignDraft'

interface DirectorStepProps {
  draft: CampaignDraft
  onChange: (patch: Partial<CampaignDraft>) => void
}

export function DirectorStep({ draft, onChange }: DirectorStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="chr-panel-spirit p-3 rounded-lg">
        <p className="stat-label text-spirit-400 mb-1">Director Notes — Optional</p>
        <p className="text-xs text-spirit-300">
          A hidden arc the Director will weave into the campaign — something the player
          character doesn't know yet. The Director reads this; you won't see it reflected
          back during play. Leave blank for an emergent campaign with no predetermined arc.
        </p>
      </div>

      <Textarea
        label="Hidden Arc / Director Notes"
        value={draft.directorNotes}
        onChange={(e) => onChange({ directorNotes: e.target.value })}
        placeholder="The city's merchant guild secretly funds the necromancer terrorising the frontier. The Duke knows but is bought off. A third player — an ancient dragon intelligence — is manipulating both sides."
        rows={6}
        hint="Optional. The Director will treat this as confidential backstory and surface it through play."
      />
    </div>
  )
}
