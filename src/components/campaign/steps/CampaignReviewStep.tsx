import { Badge } from '@/components/ui'
import { toneLabel, difficultyLabel, rulesStyleLabel } from '../campaignContent'
import type { CampaignDraft, CampaignStepValidation, CampaignWizardStepId } from '../useCampaignDraft'
import { CAMPAIGN_WIZARD_STEPS } from '../useCampaignDraft'

const STEP_LABELS: Record<CampaignWizardStepId, string> = {
  title:      'Title',
  premise:    'Premise',
  tone:       'Tone',
  difficulty: 'Difficulty',
  rules_style:'Rules Style',
  character:  'Character',
  director:   'Director',
  review:     'Review',
}

interface CampaignReviewStepProps {
  draft: CampaignDraft
  validationIssues: CampaignStepValidation[]
  onGoToStep: (step: CampaignWizardStepId) => void
}

export function CampaignReviewStep({ draft, validationIssues, onGoToStep }: CampaignReviewStepProps) {
  const stepsExcludingReview = CAMPAIGN_WIZARD_STEPS.filter((s) => s !== 'review')
  const issues = stepsExcludingReview
    .map((step, i) => ({ step, validation: validationIssues[i] }))
    .filter(({ validation }) => !validation?.isValid)

  return (
    <div className="flex flex-col gap-6">
      {issues.length > 0 && (
        <div className="chr-panel p-4 rounded-lg border-harm-600/40">
          <p className="stat-label text-harm-400 mb-2">Needs Attention</p>
          <ul className="flex flex-col gap-1.5">
            {issues.map(({ step, validation }) => (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => onGoToStep(step)}
                  className="text-sm text-harm-400 hover:text-harm-300 underline-offset-2 hover:underline text-left"
                >
                  {STEP_LABELS[step]}: {validation?.error}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-display text-xl text-white mb-1">
          {draft.title || <span className="text-void-500 italic">Untitled Campaign</span>}
        </h3>
        {draft.premise && (
          <p className="text-void-400 text-sm mt-1">{draft.premise}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ReviewStat label="Tone"       value={toneLabel(draft.tone)} />
        <ReviewStat label="Difficulty" value={difficultyLabel(draft.difficulty)} />
        <ReviewStat label="Style"      value={rulesStyleLabel(draft.rulesStyle)} />
      </div>

      <div className="chr-panel p-4 rounded-lg">
        <p className="stat-label text-void-500 mb-2">Character</p>
        {draft.characterId ? (
          <div className="flex items-center gap-2">
            <Badge variant="spirit">{draft.characterName || draft.characterId}</Badge>
          </div>
        ) : (
          <p className="text-harm-400 text-sm">No character selected.</p>
        )}
      </div>

      {draft.directorNotes.trim() && (
        <div className="chr-panel p-4 rounded-lg">
          <p className="stat-label text-void-500 mb-2">Director Notes</p>
          <p className="text-void-300 text-sm italic">Hidden arc set — the Director will weave it in during play.</p>
        </div>
      )}
    </div>
  )
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="chr-panel p-3 rounded-lg text-center">
      <p className="stat-label text-void-500 mb-1">{label}</p>
      <p className="text-sm text-white font-body">{value}</p>
    </div>
  )
}
