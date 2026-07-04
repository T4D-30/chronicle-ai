import { Button } from '@/components/ui'
import { getAbilityModifier, ABILITY_SCORE_MIN, ABILITY_SCORE_MAX } from '@/lib/engine'
import type { AbilityScores } from '@/lib/engine'
import { usePreviewSheet } from '../useCharacterDraft'
import type { CharacterDraft } from '../useCharacterDraft'

interface AbilityScoresStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
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

export function AbilityScoresStep({ draft, onChange }: AbilityScoresStepProps) {
  // Live preview — every number below (modifiers, maxHp, AC, proficiency)
  // comes straight out of the engine's buildCharacter(), never recomputed
  // by hand in this component.
  const preview = usePreviewSheet(draft)

  function setScore(key: keyof AbilityScores, value: number) {
    const clamped = Math.max(ABILITY_SCORE_MIN, Math.min(ABILITY_SCORE_MAX, value))
    onChange({ scores: { ...draft.scores, [key]: clamped } })
  }

  function adjust(key: keyof AbilityScores, delta: number) {
    setScore(key, draft.scores[key] + delta)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ABILITY_FIELDS.map(({ key, label, short }) => {
          const score = draft.scores[key]
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Decrease ${label}`}
                  onClick={() => adjust(key, -1)}
                  disabled={score <= ABILITY_SCORE_MIN}
                >
                  −
                </Button>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Increase ${label}`}
                  onClick={() => adjust(key, 1)}
                  disabled={score >= ABILITY_SCORE_MAX}
                >
                  +
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="chr-panel-spirit p-4 rounded-lg">
        <p className="stat-label text-spirit-400 mb-3">Live Derived Stats</p>
        {preview ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <DerivedStat label="Max HP" value={preview.maxHp} />
            <DerivedStat label="Armor Class" value={preview.armorClass} />
            <DerivedStat label="Proficiency" value={formatModifier(preview.proficiencyBonus)} />
            <DerivedStat label="Hit Die" value={preview.hitDie} />
          </div>
        ) : (
          <p className="text-void-500 text-sm">
            Enter valid ability scores (1–20) to see derived stats.
          </p>
        )}
      </div>
    </div>
  )
}

function DerivedStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="stat-label text-void-500 mb-0.5">{label}</p>
      <p className="font-mono text-xl text-white">{value}</p>
    </div>
  )
}
