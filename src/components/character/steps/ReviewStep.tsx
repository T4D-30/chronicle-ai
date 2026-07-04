import { Textarea, Badge } from '@/components/ui'
import { SKILL_DISPLAY_NAME } from '@/lib/engine'
import { usePreviewSheet, WIZARD_STEPS } from '../useCharacterDraft'
import type { CharacterDraft, StepValidation, WizardStepId } from '../useCharacterDraft'

interface ReviewStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
  validationIssues: StepValidation[]
  onGoToStep: (step: WizardStepId) => void
}

const STEP_LABELS: Record<WizardStepId, string> = {
  identity: 'Identity',
  species: 'Species',
  class: 'Class',
  background: 'Background',
  abilities: 'Ability Scores',
  skills: 'Skills',
  equipment: 'Equipment',
  portrait: 'Portrait',
  review: 'Review',
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function ReviewStep({ draft, onChange, validationIssues, onGoToStep }: ReviewStepProps) {
  const preview = usePreviewSheet(draft)
  const stepsExcludingReview = WIZARD_STEPS.filter((s) => s !== 'review')
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

      <div className="flex items-start gap-4">
        {draft.portraitUrl && (
          <img
            src={draft.portraitUrl}
            alt={`Portrait of ${draft.name}`}
            className="w-20 h-20 rounded-full object-cover border-2 border-arcane-600 flex-shrink-0"
          />
        )}
        <div>
          <h3 className="font-display text-xl text-white">{draft.name || 'Unnamed Character'}</h3>
          <p className="text-void-400 text-sm capitalize">
            Level {draft.level} {draft.ancestry} {draft.archetype} · {draft.background}
          </p>
        </div>
      </div>

      {preview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 chr-panel-spirit p-4 rounded-lg">
          <DerivedStat label="Max HP" value={preview.maxHp} />
          <DerivedStat label="Armor Class" value={preview.armorClass} />
          <DerivedStat label="Proficiency" value={formatModifier(preview.proficiencyBonus)} />
          <DerivedStat label="Hit Die" value={preview.hitDie} />
        </div>
      )}

      {preview && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {(
            [
              ['STR', preview.modifiers.strength],
              ['DEX', preview.modifiers.dexterity],
              ['CON', preview.modifiers.constitution],
              ['INT', preview.modifiers.intelligence],
              ['WIS', preview.modifiers.wisdom],
              ['CHA', preview.modifiers.charisma],
            ] as const
          ).map(([label, mod]) => (
            <div key={label} className="chr-panel p-3 rounded-lg text-center">
              <p className="stat-label text-void-500">{label}</p>
              <p className="font-mono text-lg text-arcane-300">{formatModifier(mod)}</p>
            </div>
          ))}
        </div>
      )}

      {draft.skillProficiencies.length > 0 && (
        <div>
          <p className="stat-label text-void-400 mb-2">Skill Proficiencies</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.skillProficiencies.map((skill) => (
              <Badge key={skill} variant="arcane">
                {SKILL_DISPLAY_NAME[skill]}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {draft.equipment.length > 0 && (
        <div>
          <p className="stat-label text-void-400 mb-2">Equipment</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.equipment.map((item) => (
              <Badge key={item.id} variant={item.equipped ? 'spirit' : 'neutral'}>
                {item.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Textarea
        label="Biography"
        value={draft.bio}
        onChange={(e) => onChange({ bio: e.target.value })}
        placeholder="Where did they come from? What do they want?"
        rows={5}
        hint="Optional. Freeform in-fiction backstory — never read by the rules engine."
      />
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
