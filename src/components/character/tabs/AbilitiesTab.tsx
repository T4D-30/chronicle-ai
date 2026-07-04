import { useState } from 'react'
import { Button } from '@/components/ui'
import {
  getAbilityModifier,
  ABILITY_SCORE_MIN,
  ABILITY_SCORE_MAX,
  calculateMaxHp,
  getProficiencyBonus,
  BASE_UNARMORED_AC,
} from '@/lib/engine'
import type { AbilityScores } from '@/lib/engine'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface AbilitiesTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

const ABILITY_FIELDS: Array<{ key: keyof AbilityScores; label: string; short: string }> = [
  { key: 'strength', label: 'Strength', short: 'STR' },
  { key: 'dexterity', label: 'Dexterity', short: 'DEX' },
  { key: 'constitution', label: 'Constitution', short: 'CON' },
  { key: 'intelligence', label: 'Intelligence', short: 'INT' },
  { key: 'wisdom', label: 'Wisdom', short: 'WIS' },
  { key: 'charisma', label: 'Charisma', short: 'CHA' },
]

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function AbilitiesTab({ character, onPatch }: AbilitiesTabProps) {
  const { sheet } = character
  const [draftScores, setDraftScores] = useState<AbilityScores>(sheet.scores)
  const isDirty = JSON.stringify(draftScores) !== JSON.stringify(sheet.scores)

  function setScore(key: keyof AbilityScores, value: number) {
    const clamped = Math.max(ABILITY_SCORE_MIN, Math.min(ABILITY_SCORE_MAX, value))
    setDraftScores((prev) => ({ ...prev, [key]: clamped }))
  }

  function adjust(key: keyof AbilityScores, delta: number) {
    setScore(key, draftScores[key] + delta)
  }

  function applyChanges() {
    // Send the FULL six-score object plus level/archetype explicitly —
    // this is the safe pattern after the updateCharacter() merge-against-
    // current-values fix. Sending the complete draft here means we never
    // depend on the service layer's fallback at all, which is the most
    // robust call site regardless.
    const localMaxHp = calculateMaxHp({
      level: sheet.level,
      constitution: draftScores.constitution,
      hitDie: sheet.hitDie,
    })
    const localAC = BASE_UNARMORED_AC + getAbilityModifier(draftScores.dexterity)
    const localProficiency = getProficiencyBonus(sheet.level)

    onPatch(
      { scores: draftScores, level: sheet.level, archetype: sheet.archetype },
      {
        sheet: {
          ...sheet,
          scores: draftScores,
          modifiers: {
            strength: getAbilityModifier(draftScores.strength),
            dexterity: getAbilityModifier(draftScores.dexterity),
            constitution: getAbilityModifier(draftScores.constitution),
            intelligence: getAbilityModifier(draftScores.intelligence),
            wisdom: getAbilityModifier(draftScores.wisdom),
            charisma: getAbilityModifier(draftScores.charisma),
          },
          maxHp: localMaxHp,
          armorClass: localAC,
          proficiencyBonus: localProficiency,
        },
      },
    )
  }

  function resetChanges() {
    setDraftScores(sheet.scores)
  }

  // Live preview of derived stats from the DRAFT (not-yet-saved) scores —
  // computed via the same engine functions the service layer uses, never
  // reimplemented.
  const previewMaxHp = calculateMaxHp({
    level: sheet.level,
    constitution: draftScores.constitution,
    hitDie: sheet.hitDie,
  })
  const previewAC = BASE_UNARMORED_AC + getAbilityModifier(draftScores.dexterity)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ABILITY_FIELDS.map(({ key, label, short }) => {
          const score = draftScores[key]
          const modifier = getAbilityModifier(score)
          return (
            <div key={key} className="chr-panel p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label text-void-300">
                  {short} <span className="normal-case text-void-500">— {label}</span>
                </span>
                <span className="font-mono text-lg text-arcane-300">{formatModifier(modifier)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjust(key, -1)}
                  aria-label={`Decrease ${label}`}
                  disabled={score <= ABILITY_SCORE_MIN}
                  className="text-void-400 hover:text-harm-400 font-mono text-lg px-2 disabled:opacity-30"
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label={label}
                  min={ABILITY_SCORE_MIN}
                  max={ABILITY_SCORE_MAX}
                  value={score}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10)
                    if (!Number.isNaN(parsed)) setScore(key, parsed)
                  }}
                  className="w-16 text-center bg-void-900 border border-void-700 rounded-md py-1.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-arcane-400"
                />
                <button
                  type="button"
                  onClick={() => adjust(key, 1)}
                  aria-label={`Increase ${label}`}
                  disabled={score >= ABILITY_SCORE_MAX}
                  className="text-void-400 hover:text-heal-400 font-mono text-lg px-2 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {isDirty && (
        <div className="chr-panel-spirit p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-spirit-300">
            <p className="stat-label text-spirit-400 mb-1">Preview</p>
            Max HP will become <span className="font-mono text-white">{previewMaxHp}</span>, AC will
            become <span className="font-mono text-white">{previewAC}</span>.
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetChanges}>
              Discard
            </Button>
            <Button type="button" variant="arcane" size="sm" onClick={applyChanges}>
              Apply Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
