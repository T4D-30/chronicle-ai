import { SKILL_IDS, SKILL_DISPLAY_NAME, SKILL_ABILITY } from '@/lib/engine'
import type { SkillId, StatName } from '@/lib/engine'
import { Badge } from '@/components/ui'
import type { CharacterDraft } from '../useCharacterDraft'

interface SkillsStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

const SAVING_THROW_STATS: StatName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export function SkillsStep({ draft, onChange }: SkillsStepProps) {
  function toggleSkill(skill: SkillId) {
    const isProficient = draft.skillProficiencies.includes(skill)
    onChange({
      skillProficiencies: isProficient
        ? draft.skillProficiencies.filter((s) => s !== skill)
        : [...draft.skillProficiencies, skill],
    })
  }

  function toggleSave(stat: StatName) {
    const isProficient = draft.savingThrowProficiencies.includes(stat)
    onChange({
      savingThrowProficiencies: isProficient
        ? draft.savingThrowProficiencies.filter((s) => s !== stat)
        : [...draft.savingThrowProficiencies, stat],
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="font-body font-semibold text-white mb-1">Saving Throw Proficiencies</h3>
        <p className="text-void-500 text-xs mb-3">
          Proficiency adds your proficiency bonus to saving throws using that ability.
        </p>
        <div className="flex flex-wrap gap-2">
          {SAVING_THROW_STATS.map((stat) => {
            const active = draft.savingThrowProficiencies.includes(stat)
            return (
              <button
                key={stat}
                type="button"
                onClick={() => toggleSave(stat)}
                aria-pressed={active}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-mono font-semibold border transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                  active
                    ? 'bg-arcane-900/50 border-arcane-500 text-arcane-300'
                    : 'bg-void-900 border-void-700 text-void-400 hover:border-void-600',
                ].join(' ')}
              >
                {stat}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="font-body font-semibold text-white mb-1">Skill Proficiencies</h3>
        <p className="text-void-500 text-xs mb-3">
          Proficiency adds your proficiency bonus to checks using that skill.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SKILL_IDS.map((skill) => {
            const active = draft.skillProficiencies.includes(skill)
            return (
              <label
                key={skill}
                className={[
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors',
                  active
                    ? 'bg-arcane-900/30 border-arcane-700/50'
                    : 'bg-void-900 border-void-700/50 hover:border-void-600',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleSkill(skill)}
                    className="accent-arcane-500"
                  />
                  <span className="text-sm text-white">{SKILL_DISPLAY_NAME[skill]}</span>
                </span>
                <Badge variant="neutral">{SKILL_ABILITY[skill]}</Badge>
              </label>
            )
          })}
        </div>
      </section>
    </div>
  )
}
