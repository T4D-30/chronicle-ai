import { useState, useEffect } from 'react'
import {
  useCharacterDraft,
  draftToCharacterInput,
  loadSavedDraft,
  clearSavedDraft,
  isDraftMeaningful,
} from './useCharacterDraft'
import type { CharacterDraft, StepValidation, WizardStepId } from './useCharacterDraft'
import { WizardStepShell } from './WizardStepShell'
import { ConfirmDialog } from '@/components/ui'
import { IdentityStep } from './steps/IdentityStep'
import { SpeciesStep } from './steps/SpeciesStep'
import { ClassStep } from './steps/ClassStep'
import { BackgroundStep } from './steps/BackgroundStep'
import { AbilityScoresStep } from './steps/AbilityScoresStep'
import { SkillsStep } from './steps/SkillsStep'
import { EquipmentStep } from './steps/EquipmentStep'
import { PortraitStep } from './steps/PortraitStep'
import { ReviewStep } from './steps/ReviewStep'
import { createCharacter, ServiceError } from '@/lib/supabase'
import type { CharacterRecord } from '@/lib/supabase'

const STEP_TITLES: Record<WizardStepId, { title: string; description?: string }> = {
  identity: { title: 'Who are they?', description: 'Start with a name and a starting level.' },
  species: { title: 'Choose a Species' },
  class: { title: 'Choose a Class' },
  background: { title: 'Choose a Background' },
  abilities: {
    title: 'Set Ability Scores',
    description: 'Adjust each score from 1–20. Modifiers and derived stats update live.',
  },
  skills: { title: 'Skill & Save Proficiencies' },
  equipment: { title: 'Starting Equipment', description: 'Optional — you can add more later.' },
  portrait: { title: 'Add a Portrait', description: 'Optional.' },
  review: { title: 'Review Your Character' },
}

interface CharacterWizardProps {
  userId: string
  onCreated: (character: CharacterRecord) => void
  onCancel?: () => void
  /**
   * Pre-seeds the draft — used by the character import flow (Phase 10.1)
   * to hand off an extracted/partially-extracted draft into the exact
   * same review/validation/creation path manual creation already uses.
   * When provided, the resume-from-localStorage prompt is skipped (an
   * imported draft takes priority over any unrelated in-progress manual
   * draft) and autosave begins immediately from this seed.
   */
  initialDraft?: Partial<CharacterDraft>
  /** Starting step — the import flow lands directly on 'review'. Defaults to 'identity'. */
  initialStep?: WizardStepId
}

export function CharacterWizard({ userId, onCreated, onCancel, initialDraft, initialStep }: CharacterWizardProps) {
  const {
    draft,
    updateDraft,
    currentStep,
    currentValidation,
    stepIndex,
    goNext,
    goBack,
    goToStep,
    isFirstStep,
    isLastStep,
    validateAll,
    resumeDraft,
    discardDraft,
    startFreshDraft,
  } = useCharacterDraft(userId, initialDraft)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  // 'checking' = mount effect hasn't resolved yet (avoids a flash of the
  // wizard before we know whether to prompt); null = no saved draft found,
  // resume decision already made or not needed.
  const [resumePromptSavedAt, setResumePromptSavedAt] = useState<string | 'checking' | null>('checking')

  // On mount: check for a saved draft once. This runs exactly once per
  // wizard mount (empty deps) — resumeDraft/discardDraft/startFreshDraft
  // are stable useCallback references from useCharacterDraft, so this is
  // safe without listing them.
  useEffect(() => {
    if (initialDraft) {
      // An imported draft is an explicit, intentional starting point —
      // never gate it behind a "resume your OTHER unrelated draft?" prompt.
      // It also becomes the new autosave target going forward.
      startFreshDraft()
      if (initialStep) goToStep(initialStep)
      setResumePromptSavedAt(null)
      return
    }
    const saved = loadSavedDraft(userId)
    if (saved && isDraftMeaningful(saved.draft)) {
      setResumePromptSavedAt(saved.savedAt)
    } else {
      startFreshDraft()
      setResumePromptSavedAt(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function handleResume() {
    const saved = loadSavedDraft(userId)
    if (saved) resumeDraft(saved)
    setResumePromptSavedAt(null)
  }

  function handleDiscardSaved() {
    discardDraft()
    setResumePromptSavedAt(null)
  }

  async function handlePrimaryAction() {
    if (!isLastStep) {
      goNext()
      return
    }

    // Final step: validate everything, then persist through the existing
    // service layer (which itself runs the draft through buildCharacter()
    // again server-side — this is defense in depth, not duplicated rules).
    const allValid = validateAll().every((v) => v.isValid)
    if (!allValid) {
      setSubmitError('Please resolve the issues listed above before creating this character.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const created = await createCharacter({
        userId,
        ...draftToCharacterInput(draft),
        portraitUrl: draft.portraitUrl,
        bio: draft.bio,
      })
      // Character successfully persisted — the draft has served its
      // purpose and should not resurface as a stale "resume?" prompt on
      // the next visit to this page.
      clearSavedDraft(userId)
      onCreated(created)
    } catch (err) {
      setSubmitError(
        err instanceof ServiceError ? err.message : 'Failed to create character. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBack() {
    if (isFirstStep) {
      if (isDraftMeaningful(draft)) {
        setShowCancelConfirm(true)
      } else {
        onCancel?.()
      }
    } else {
      goBack()
    }
  }

  const stepMeta = STEP_TITLES[currentStep]
  const validationIssues: StepValidation[] = currentStep === 'review' ? validateAll() : []

  // Gate the wizard behind the resume decision — avoids a flash of a blank
  // wizard immediately overwritten by a resume prompt a frame later.
  if (resumePromptSavedAt === 'checking') return null

  return (
    <>
      {resumePromptSavedAt !== null && (
        <ConfirmDialog
          open
          title="Resume unfinished character?"
          description={`You have an in-progress character saved from ${formatSavedAt(resumePromptSavedAt)}. Continue where you left off, or start fresh?`}
          confirmLabel="Resume"
          cancelLabel="Start Fresh"
          onConfirm={handleResume}
          onCancel={handleDiscardSaved}
        />
      )}

      <WizardStepShell
        currentStep={currentStep}
        stepIndex={stepIndex}
        title={stepMeta.title}
        description={stepMeta.description}
        onBack={handleBack}
        onNext={handlePrimaryAction}
        onGoToStep={goToStep}
        isFirstStep={false /* Back always works — first step cancels instead */}
        isLastStep={isLastStep}
        canAdvance={currentValidation.isValid}
        isSubmitting={isSubmitting}
        blockingError={submitError ?? (currentStep !== 'review' ? currentValidation.error : null)}
      >
        {renderStep(currentStep, draft, updateDraft, validationIssues, goToStep)}
      </WizardStepShell>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Discard this character?"
        description="Your progress is saved automatically, so you can resume later — but leaving now will take you back to your character library."
        confirmLabel="Leave Wizard"
        cancelLabel="Keep Editing"
        isDestructive
        onConfirm={() => { setShowCancelConfirm(false); onCancel?.() }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </>
  )
}

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return 'earlier'
  }
}

function renderStep(
  step: WizardStepId,
  draft: CharacterDraft,
  updateDraft: (patch: Partial<CharacterDraft>) => void,
  validationIssues: StepValidation[],
  goToStep: (step: WizardStepId) => void,
) {
  switch (step) {
    case 'identity':
      return <IdentityStep draft={draft} onChange={updateDraft} />
    case 'species':
      return <SpeciesStep draft={draft} onChange={updateDraft} />
    case 'class':
      return <ClassStep draft={draft} onChange={updateDraft} />
    case 'background':
      return <BackgroundStep draft={draft} onChange={updateDraft} />
    case 'abilities':
      return <AbilityScoresStep draft={draft} onChange={updateDraft} />
    case 'skills':
      return <SkillsStep draft={draft} onChange={updateDraft} />
    case 'equipment':
      return <EquipmentStep draft={draft} onChange={updateDraft} />
    case 'portrait':
      return <PortraitStep draft={draft} onChange={updateDraft} />
    case 'review':
      return (
        <ReviewStep
          draft={draft}
          onChange={updateDraft}
          validationIssues={validationIssues}
          onGoToStep={goToStep}
        />
      )
  }
}
