import { getAbilityModifier, getEquipmentSaveBonus } from '@/lib/engine'
import type { StatName } from '@/lib/engine'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface SavesTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

const SAVE_FIELDS: Array<{ stat: StatName; label: string }> = [
  { stat: 'STR', label: 'Strength' },
  { stat: 'DEX', label: 'Dexterity' },
  { stat: 'CON', label: 'Constitution' },
  { stat: 'INT', label: 'Intelligence' },
  { stat: 'WIS', label: 'Wisdom' },
  { stat: 'CHA', label: 'Charisma' },
]

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function abilityScoreFor(scores: CharacterRecord['sheet']['scores'], stat: StatName): number {
  const map: Record<StatName, number> = {
    STR: scores.strength,
    DEX: scores.dexterity,
    CON: scores.constitution,
    INT: scores.intelligence,
    WIS: scores.wisdom,
    CHA: scores.charisma,
  }
  return map[stat]
}

export function SavesTab({ character, onPatch }: SavesTabProps) {
  const { sheet } = character

  function toggleSave(stat: StatName) {
    const isProficient = sheet.savingThrowProficiencies.includes(stat)
    const next = isProficient
      ? sheet.savingThrowProficiencies.filter((s) => s !== stat)
      : [...sheet.savingThrowProficiencies, stat]

    onPatch(
      { savingThrowProficiencies: next },
      { sheet: { ...sheet, savingThrowProficiencies: next } },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-void-500 text-xs mb-2">
        Total bonus = ability modifier + proficiency bonus (if proficient) + equipment bonus.
      </p>
      {SAVE_FIELDS.map(({ stat, label }) => {
        const score = abilityScoreFor(sheet.scores, stat)
        const abilityMod = getAbilityModifier(score)
        const isProficient = sheet.savingThrowProficiencies.includes(stat)
        const equipmentBonus = getEquipmentSaveBonus(sheet.equipment, stat)
        const total = abilityMod + (isProficient ? sheet.proficiencyBonus : 0) + equipmentBonus

        return (
          <label
            key={stat}
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
                onChange={() => toggleSave(stat)}
                className="accent-arcane-500"
              />
              <span className="text-sm text-white">{label} Save</span>
              <span className="text-void-500 text-xs font-mono">{stat}</span>
            </span>
            <span className="font-mono text-arcane-300">{formatModifier(total)}</span>
          </label>
        )
      })}
    </div>
  )
}
