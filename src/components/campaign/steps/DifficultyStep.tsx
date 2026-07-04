import type { CampaignDifficulty } from '@/types/campaign'
import type { CampaignDraft } from '../useCampaignDraft'
import { DIFFICULTY_OPTIONS } from '../campaignContent'

interface DifficultyStepProps {
  draft: CampaignDraft
  onChange: (patch: Partial<CampaignDraft>) => void
}

export function DifficultyStep({ draft, onChange }: DifficultyStepProps) {
  return (
    <div className="flex flex-col gap-3">
      {DIFFICULTY_OPTIONS.map((opt) => {
        const selected = draft.difficulty === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ difficulty: opt.value as CampaignDifficulty })}
            aria-pressed={selected}
            className={[
              'w-full text-left px-4 py-3 rounded-lg border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
              selected
                ? 'bg-arcane-900/40 border-arcane-500 text-white'
                : 'bg-void-900 border-void-700/50 text-void-300 hover:border-void-500',
            ].join(' ')}
          >
            <p className="font-body font-semibold">{opt.label}</p>
            <p className="text-xs text-void-400 mt-0.5">{opt.description}</p>
          </button>
        )
      })}
    </div>
  )
}
