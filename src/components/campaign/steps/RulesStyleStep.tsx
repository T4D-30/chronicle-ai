import type { RulesStyle } from '@/types/campaign'
import type { CampaignDraft } from '../useCampaignDraft'
import { RULES_STYLE_OPTIONS } from '../campaignContent'

interface RulesStyleStepProps {
  draft: CampaignDraft
  onChange: (patch: Partial<CampaignDraft>) => void
}

export function RulesStyleStep({ draft, onChange }: RulesStyleStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="chr-panel-spirit p-3 rounded-lg">
        <p className="text-xs text-spirit-300">
          Rules Style shapes how the AI Director narrates outcomes. It never changes the dice,
          modifiers, or any mechanical result — only the prose around them.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {RULES_STYLE_OPTIONS.map((opt) => {
          const selected = draft.rulesStyle === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ rulesStyle: opt.value as RulesStyle })}
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
    </div>
  )
}
