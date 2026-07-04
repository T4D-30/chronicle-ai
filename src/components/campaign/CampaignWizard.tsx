import { useState, useEffect } from 'react'
import {
  useCampaignDraft,
  draftToCreateInput,
} from './useCampaignDraft'
import type { CampaignDraft, CampaignStepValidation, CampaignWizardStepId } from './useCampaignDraft'
import { CampaignWizardStepShell } from './CampaignWizardStepShell'
import { TitleStep }       from './steps/TitleStep'
import { PremiseStep }     from './steps/PremiseStep'
import { ToneStep }        from './steps/ToneStep'
import { DifficultyStep }  from './steps/DifficultyStep'
import { RulesStyleStep }  from './steps/RulesStyleStep'
import { CharacterStep }   from './steps/CharacterStep'
import { DirectorStep }    from './steps/DirectorStep'
import { CampaignReviewStep } from './steps/CampaignReviewStep'
import { createCampaign, ServiceError } from '@/lib/supabase'
import type { Campaign } from '@/lib/supabase'

const STEP_TITLES: Record<CampaignWizardStepId, { title: string; description?: string }> = {
  title:      { title: 'Name your campaign',   description: 'What will this adventure be called?' },
  premise:    { title: 'Set the premise',       description: 'Optional: a short concept or hook to ground the Director.' },
  tone:       { title: 'Choose a tone' },
  difficulty: { title: 'Choose a difficulty' },
  rules_style:{ title: 'Choose a rules style',  description: 'Shapes how the Director narrates outcomes — never affects the dice.' },
  character:  { title: 'Select your character', description: 'Choose the character who will play this campaign.' },
  director:   { title: 'Director preferences',  description: 'Optional: set a hidden arc the Director will weave through play.' },
  review:     { title: 'Review your campaign' },
}

interface CampaignWizardProps {
  userId: string
  onCreated: (campaign: Campaign) => void
  onCancel?: () => void
  /**
   * Pre-seeds the draft — used by the campaign import flow (Phase 10.2) to
   * hand off an extracted/partially-extracted draft into the exact same
   * review/validation/creation path manual creation already uses. Mirrors
   * CharacterWizard's initialDraft (Phase 10.1).
   */
  initialDraft?: Partial<CampaignDraft>
  /** Starting step — the import flow lands directly on 'review'. Defaults to 'title'. */
  initialStep?: CampaignWizardStepId
}

export function CampaignWizard({ userId, onCreated, onCancel, initialDraft, initialStep }: CampaignWizardProps) {
  const {
    draft,
    updateDraft,
    selectCharacter,
    clearCharacter,
    currentStep,
    currentValidation,
    stepIndex,
    goNext,
    goBack,
    goToStep,
    isFirstStep,
    isLastStep,
    validateAll,
  } = useCampaignDraft(initialDraft)

  // Jump to the requested starting step once, on mount — mirrors
  // CharacterWizard's initialStep handling (Phase 10.1). No resume/autosave
  // logic exists for the campaign wizard yet (not built this phase — see
  // KNOWN_LIMITATIONS.md), so this is the entire mount-time effect needed.
  useEffect(() => {
    if (initialStep) goToStep(initialStep)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)

  async function handlePrimaryAction() {
    if (!isLastStep) { goNext(); return }

    const allValid = validateAll().every((v) => v.isValid)
    if (!allValid) {
      setSubmitError('Please resolve the issues listed above before creating this campaign.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const created = await createCampaign(draftToCreateInput(draft, userId))
      onCreated(created)
    } catch (err) {
      setSubmitError(
        err instanceof ServiceError ? err.message : 'Failed to create campaign. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBack() {
    if (isFirstStep) { onCancel?.(); return }
    goBack()
  }

  const stepMeta = STEP_TITLES[currentStep]
  const validationIssues: CampaignStepValidation[] = currentStep === 'review' ? validateAll() : []

  return (
    <CampaignWizardStepShell
      currentStep={currentStep}
      stepIndex={stepIndex}
      title={stepMeta.title}
      description={stepMeta.description}
      onBack={handleBack}
      onNext={handlePrimaryAction}
      onGoToStep={goToStep}
      isFirstStep={false}
      isLastStep={isLastStep}
      canAdvance={currentValidation.isValid}
      isSubmitting={isSubmitting}
      blockingError={submitError ?? (currentStep !== 'review' ? currentValidation.error : null)}
    >
      {renderStep(currentStep, draft, updateDraft, selectCharacter, clearCharacter, validationIssues, goToStep)}
    </CampaignWizardStepShell>
  )
}

function renderStep(
  step: CampaignWizardStepId,
  draft: CampaignDraft,
  updateDraft: (patch: Partial<CampaignDraft>) => void,
  selectCharacter: (id: string, name: string) => void,
  clearCharacter: () => void,
  validationIssues: CampaignStepValidation[],
  goToStep: (step: CampaignWizardStepId) => void,
) {
  switch (step) {
    case 'title':      return <TitleStep      draft={draft} onChange={updateDraft} />
    case 'premise':    return <PremiseStep    draft={draft} onChange={updateDraft} />
    case 'tone':       return <ToneStep       draft={draft} onChange={updateDraft} />
    case 'difficulty': return <DifficultyStep draft={draft} onChange={updateDraft} />
    case 'rules_style':return <RulesStyleStep draft={draft} onChange={updateDraft} />
    case 'character':  return <CharacterStep  draft={draft} onSelect={selectCharacter} onClear={clearCharacter} />
    case 'director':   return <DirectorStep   draft={draft} onChange={updateDraft} />
    case 'review':     return (
      <CampaignReviewStep
        draft={draft}
        validationIssues={validationIssues}
        onGoToStep={goToStep}
      />
    )
  }
}
