import { useState, useCallback, useMemo } from 'react'
import type { CampaignTone, CampaignDifficulty, RulesStyle } from '@/types/campaign'
import type { CreateCampaignInput } from '@/lib/supabase/campaigns'

// ─── Draft shape ──────────────────────────────────────────────────────────────

/**
 * The wizard's local working state. This is intentionally wider than
 * CreateCampaignInput — it carries UI-only display fields (characterName)
 * alongside all persisted fields. Nothing in here is written to Supabase
 * until draftToCreateInput() is called at final submit.
 *
 * Separation contract (see Phase 2.2 spec):
 *   campaignStore   — persisted Campaign[] list
 *   CampaignDraft   — temporary creation state owned by this hook
 * The two never mix.
 */
export interface CampaignDraft {
  // ── Title step ───────────────────────────────────────────────────────────
  title: string

  // ── Premise step ─────────────────────────────────────────────────────────
  /** Maps to Campaign.description on submit. Freeform campaign concept. */
  premise: string

  // ── Tone step ────────────────────────────────────────────────────────────
  tone: CampaignTone

  // ── Difficulty step ──────────────────────────────────────────────────────
  difficulty: CampaignDifficulty

  // ── Rules style step ─────────────────────────────────────────────────────
  /**
   * Narration framing preference — presentational only, never affects
   * mechanics. Maps to DirectorConfig.rulesStyle on submit.
   */
  rulesStyle: RulesStyle

  // ── Character selection step ──────────────────────────────────────────────
  /** The character id that will be linked to this campaign at creation. */
  characterId: string | null
  /**
   * Display-only: the selected character's name, used in the Review step
   * and validation messages. Never persisted — only characterId goes to DB.
   */
  characterName: string

  // ── Director preferences step ─────────────────────────────────────────────
  /**
   * The hidden arc / director notes. Maps to DirectorConfig.hiddenArc on
   * submit. The only DirectorConfig field the player sets at wizard time;
   * all other Director fields default and evolve during play.
   */
  directorNotes: string
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

export const CAMPAIGN_WIZARD_STEPS = [
  'title',
  'premise',
  'tone',
  'difficulty',
  'rules_style',
  'character',
  'director',
  'review',
] as const

export type CampaignWizardStepId = (typeof CAMPAIGN_WIZARD_STEPS)[number]

// ─── Validation ───────────────────────────────────────────────────────────────

export interface CampaignStepValidation {
  isValid: boolean
  error: string | null
}

/**
 * Maximum title length — mirrors the exact value in campaigns.ts
 * `validateCreateInput` so the wizard's inline error matches what the
 * service would throw. Not duplicating logic; duplicating the constant so
 * the UI can show the limit before the user ever hits submit.
 */
export const CAMPAIGN_TITLE_MAX_LENGTH = 120

const VALID_TONES: CampaignTone[] = ['grim', 'heroic', 'mysterious', 'comedic']
const VALID_DIFFICULTIES: CampaignDifficulty[] = ['easy', 'standard', 'brutal']
const VALID_RULES_STYLES: RulesStyle[] = ['narrative', 'standard', 'crunchy', 'cinematic']

/**
 * Validate a single wizard step. All checks mirror the service layer's
 * `validateCreateInput` rules — the goal is to surface errors *before*
 * submit, not to invent new rules. If the service layer ever tightens a
 * constraint, both places need updating, but they stay in lockstep by
 * design (see CAMPAIGN_TITLE_MAX_LENGTH above).
 */
function validateCampaignStep(
  step: CampaignWizardStepId,
  draft: CampaignDraft,
): CampaignStepValidation {
  switch (step) {
    case 'title': {
      const trimmed = draft.title.trim()
      if (trimmed.length === 0) {
        return { isValid: false, error: 'Campaign title cannot be empty.' }
      }
      if (trimmed.length > CAMPAIGN_TITLE_MAX_LENGTH) {
        return {
          isValid: false,
          error: `Title must be ${CAMPAIGN_TITLE_MAX_LENGTH} characters or fewer (currently ${trimmed.length}).`,
        }
      }
      return { isValid: true, error: null }
    }

    case 'premise':
      // Premise is optional — campaigns can be "vibes-only" with no written concept.
      return { isValid: true, error: null }

    case 'tone':
      if (!VALID_TONES.includes(draft.tone)) {
        return { isValid: false, error: `Unknown tone: "${draft.tone}".` }
      }
      return { isValid: true, error: null }

    case 'difficulty':
      if (!VALID_DIFFICULTIES.includes(draft.difficulty)) {
        return { isValid: false, error: `Unknown difficulty: "${draft.difficulty}".` }
      }
      return { isValid: true, error: null }

    case 'rules_style':
      if (!VALID_RULES_STYLES.includes(draft.rulesStyle)) {
        return { isValid: false, error: `Unknown rules style: "${draft.rulesStyle}".` }
      }
      return { isValid: true, error: null }

    case 'character':
      if (!draft.characterId) {
        return { isValid: false, error: 'A character must be selected before starting a campaign.' }
      }
      return { isValid: true, error: null }

    case 'director':
      // Director notes are optional — campaigns without a hidden arc are valid.
      return { isValid: true, error: null }

    case 'review': {
      // Final gate: re-run all preceding steps. If any fail, surface the first.
      const preceding = CAMPAIGN_WIZARD_STEPS.filter((s) => s !== 'review')
      for (const s of preceding) {
        const result = validateCampaignStep(s, draft)
        if (!result.isValid) return result
      }
      return { isValid: true, error: null }
    }
  }
}

// ─── Draft factory ────────────────────────────────────────────────────────────

export function createEmptyCampaignDraft(): CampaignDraft {
  return {
    title: '',
    premise: '',
    tone: 'heroic',
    difficulty: 'standard',
    rulesStyle: 'standard',
    characterId: null,
    characterName: '',
    directorNotes: '',
  }
}

// ─── Submit converter ─────────────────────────────────────────────────────────

/**
 * Convert a validated CampaignDraft into the CreateCampaignInput the service
 * layer expects. Call this only when isReadyToSubmit is true.
 *
 * @param draft  - The final wizard draft
 * @param userId - The authenticated user's ID (comes from useAuth, not stored
 *                 in the draft since it's session state, not wizard state)
 */
export function draftToCreateInput(draft: CampaignDraft, userId: string): CreateCampaignInput {
  return {
    userId,
    title: draft.title.trim(),
    description: draft.premise.trim() || undefined,
    tone: draft.tone,
    difficulty: draft.difficulty,
    characterId: draft.characterId ?? undefined,
    directorConfig: {
      rulesStyle: draft.rulesStyle,
      hiddenArc: draft.directorNotes.trim(),
    },
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Drive the multi-step campaign creation wizard.
 *
 * Owns the draft state and per-step validation. Does NOT call Supabase,
 * does NOT navigate, does NOT reference any page component. Fully
 * portable and testable via renderHook.
 *
 * Architecture contract:
 *   - This hook  → temporary creation state
 *   - campaignStore → persisted Campaign[] list
 *   These two never overlap.
 */
export function useCampaignDraft(initial?: Partial<CampaignDraft>) {
  const [draft, setDraft] = useState<CampaignDraft>(() => ({
    ...createEmptyCampaignDraft(),
    ...initial,
  }))
  const [stepIndex, setStepIndex] = useState(0)

  const currentStep = CAMPAIGN_WIZARD_STEPS[stepIndex]

  // ── Update functions ───────────────────────────────────────────────────────

  const updateDraft = useCallback((patch: Partial<CampaignDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  /** Convenience: update both characterId and characterName together. */
  const selectCharacter = useCallback((id: string, name: string) => {
    setDraft((prev) => ({ ...prev, characterId: id, characterName: name }))
  }, [])

  /** Convenience: clear the selected character. */
  const clearCharacter = useCallback(() => {
    setDraft((prev) => ({ ...prev, characterId: null, characterName: '' }))
  }, [])

  /** Resets the entire draft back to the empty default. */
  const resetDraft = useCallback(() => {
    setDraft(createEmptyCampaignDraft())
    setStepIndex(0)
  }, [])

  // ── Validation ─────────────────────────────────────────────────────────────

  const currentValidation = useMemo(
    () => validateCampaignStep(currentStep, draft),
    [currentStep, draft],
  )

  /**
   * Validate every step except 'review'. Used by the Review step to show a
   * complete list of blocking issues, and to gate final submission.
   */
  const validateAll = useCallback((): CampaignStepValidation[] => {
    return CAMPAIGN_WIZARD_STEPS.filter((s) => s !== 'review').map((s) =>
      validateCampaignStep(s, draft),
    )
  }, [draft])

  /**
   * True when the draft is valid enough to submit — title present and
   * character selected. All other fields have sensible defaults.
   * This is the gate used by the Review step's "Create Campaign" button.
   */
  const isReadyToSubmit = useMemo(() => {
    return validateAll().every((v) => v.isValid)
  }, [validateAll])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (!currentValidation.isValid) return false
    setStepIndex((i) => Math.min(i + 1, CAMPAIGN_WIZARD_STEPS.length - 1))
    return true
  }, [currentValidation.isValid])

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0))
  }, [])

  const goToStep = useCallback((step: CampaignWizardStepId) => {
    const index = CAMPAIGN_WIZARD_STEPS.indexOf(step)
    if (index !== -1) setStepIndex(index)
  }, [])

  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === CAMPAIGN_WIZARD_STEPS.length - 1

  return {
    // State
    draft,
    currentStep,
    stepIndex,

    // Update functions
    updateDraft,
    selectCharacter,
    clearCharacter,
    resetDraft,

    // Validation
    currentValidation,
    validateAll,
    isReadyToSubmit,

    // Navigation
    goNext,
    goBack,
    goToStep,
    isFirstStep,
    isLastStep,
  }
}
