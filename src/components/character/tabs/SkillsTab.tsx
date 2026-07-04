import {
  SKILL_IDS,
  SKILL_DISPLAY_NAME,
  SKILL_ABILITY,
  getAbilityModifier,
  getEquipmentSkillBonus,
} from '@/lib/engine'
import type { SkillId } from '@/lib/engine'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface SkillsTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function abilityScoreFor(scores: CharacterRecord['sheet']['scores'], ability: string): number {
  const map: Record<string, number> = {
    STR: scores.strength,
    DEX: scores.dexterity,
    CON: scores.constitution,
    INT: scores.intelligence,
    WIS: scores.wisdom,
    CHA: scores.charisma,
  }
  return map[ability] ?? 10
}

export function SkillsTab({ character, onPatch }: SkillsTabProps) {
  const { sheet } = character

  function toggleSkill(skill: SkillId) {
    const isProficient = sheet.skillProficiencies.includes(skill)
    const next = isProficient
      ? sheet.skillProficiencies.filter((s) => s !== skill)
      : [...sheet.skillProficiencies, skill]

    onPatch(
      { skillProficiencies: next },
      { sheet: { ...sheet, skillProficiencies: next } },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-void-500 text-xs mb-2">
        Total bonus = ability modifier + proficiency bonus (if proficient) + equipment bonus.
        Computed live from the engine — never hand-calculated here.
      </p>
      {SKILL_IDS.map((skill) => {
        const ability = SKILL_ABILITY[skill]
        const score = abilityScoreFor(sheet.scores, ability)
        const abilityMod = getAbilityModifier(score)
        const isProficient = sheet.skillProficiencies.includes(skill)
        const equipmentBonus = getEquipmentSkillBonus(sheet.equipment, skill)
        const total = abilityMod + (isProficient ? sheet.proficiencyBonus : 0) + equipmentBonus

        return (
          <label
            key={skill}
            className={[
              'flex items-center justify-between gap-3 px-3 py-2 rounded-md border cursor-pointer transition-colors',
              isProficient
                ? 'bg-arcane-900/30 border-arcane-700/50'
                : 'bg-void-900 border-void-700/50 hover:border-void-600',
            ].join(' ')}
          >
            <span className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isProficient}
                onChange={() => toggleSkill(skill)}
                className="accent-arcane-500"
              />
              <span className="text-sm text-white">{SKILL_DISPLAY_NAME[skill]}</span>
              <span className="text-void-500 text-xs font-mono">{ability}</span>
            </span>
            <span className="font-mono text-arcane-300">{formatModifier(total)}</span>
          </label>
        )
      })}
    </div>
  )
}
