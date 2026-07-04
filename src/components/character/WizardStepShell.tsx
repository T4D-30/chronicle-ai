import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import { WIZARD_STEPS } from './useCharacterDraft'
import type { WizardStepId } from './useCharacterDraft'

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

interface WizardStepShellProps {
  currentStep: WizardStepId
  stepIndex: number
  title: string
  description?: string
  children: ReactNode
  onBack: () => void
  onNext: () => void
  onGoToStep: (step: WizardStepId) => void
  isFirstStep: boolean
  isLastStep: boolean
  canAdvance: boolean
  /** Label for the final-step action, e.g. "Create Character". */
  finalActionLabel?: string
  isSubmitting?: boolean
  blockingError?: string | null
}

export function WizardStepShell({
  currentStep,
  stepIndex,
  title,
  description,
  children,
  onBack,
  onNext,
  onGoToStep,
  isFirstStep,
  isLastStep,
  canAdvance,
  finalActionLabel = 'Create Character',
  isSubmitting = false,
  blockingError,
}: WizardStepShellProps) {
  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      {/* Step indicator */}
      <nav aria-label="Character creation progress" className="mb-8">
        <ol className="flex flex-wrap gap-2">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = step === currentStep
            const isComplete = index < stepIndex
            return (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => onGoToStep(step)}
                  disabled={index > stepIndex}
                  aria-current={isActive ? 'step' : undefined}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-pixel-display',
                    'pixel-border transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    isActive
                      ? 'bg-arcane-900/50 border-arcane-500 text-arcane-300 torch-flicker'
                      : isComplete
                        ? 'bg-void-800 border-void-600 text-void-300 hover:border-arcane-700'
                        : 'bg-void-900 border-void-700/50 text-void-500',
                  ].join(' ')}
                >
                  <span className="font-mono">{index + 1}</span>
                  {STEP_LABELS[step]}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <PixelPanel variant="arcane" glow className="p-6 md:p-8">
        <h2 className="font-display text-2xl font-bold text-white mb-1">{title}</h2>
        {description && <p className="text-void-400 text-sm mb-6">{description}</p>}

        <div className="mb-8">{children}</div>

        {blockingError && (
          <p role="alert" className="text-harm-400 text-sm mb-4">
            {blockingError}
          </p>
        )}

        <div className="chr-divider mb-6" />

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={onBack} disabled={isFirstStep}>
            Back
          </Button>

          {isLastStep ? (
            <Button type="button" variant="arcane" onClick={onNext} loading={isSubmitting}>
              {finalActionLabel}
            </Button>
          ) : (
            <Button type="button" variant="arcane" onClick={onNext} disabled={!canAdvance}>
              Next
            </Button>
          )}
        </div>
      </PixelPanel>
    </div>
  )
}
