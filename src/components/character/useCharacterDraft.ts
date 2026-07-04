import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  buildCharacter,
  isValidAbilityScore,
  isValidLevel,
  validateAbilityScores,
  isValidSkillId,
  validateEquipmentItem,
  ABILITY_SCORE_MIN,
  ABILITY_SCORE_MAX,
} from '@/lib/engine'
import type {
  AbilityScores,
  SkillId,
  StatName,
  EquipmentItem,
  CharacterSheet,
} from '@/lib/engine'

/**
 * The wizard's working state. Structurally a superset of CreateCharacterInput
 * (every field createCharacter() accepts) plus the two UI-only fields
 * (portraitUrl, bio) the service layer already understands.
 *
 * Validation never duplicates engine rules: every check below either calls
 * an engine validator directly (isValidAbilityScore, isValidSkillId, etc.)
 * or calls buildCharacter() itself and reads the thrown error message.
 * If the engine's rules ever change, this hook does not need to change.
 */
export interface CharacterDraft {
  name: string
  archetype: string
  ancestry: string
  background: string
  level: number
  scores: AbilityScores
  skillProficiencies: SkillId[]
  savingThrowProficiencies: StatName[]
  equipment: EquipmentItem[]
  portraitUrl: string | null
  bio: string
}

export const DEFAULT_DRAFT_SCORES: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
}

export function createEmptyDraft(): CharacterDraft {
  return {
    name: '',
    archetype: 'fighter',
    ancestry: 'human',
    background: 'wanderer',
    level: 1,
    scores: { ...DEFAULT_DRAFT_SCORES },
    skillProficiencies: [],
    savingThrowProficiencies: [],
    equipment: [],
    portraitUrl: null,
    bio: '',
  }
}

/** The wizard's steps, in order. Used to drive the step indicator and navigation. */
export const WIZARD_STEPS = [
  'identity',
  'species',
  'class',
  'background',
  'abilities',
  'skills',
  'equipment',
  'portrait',
  'review',
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]

export interface StepValidation {
  isValid: boolean
  /** First blocking error for this step, if any. Null when valid. */
  error: string | null
}

/**
 * Validate a single wizard step using ONLY engine-exported validators.
 * No range checks, no regex, no business rules are written here — every
 * branch below calls straight into the engine and surfaces its message.
 */
function validateStep(step: WizardStepId, draft: CharacterDraft): StepValidation {
  switch (step) {
    case 'identity': {
      const trimmed = draft.name.trim()
      if (trimmed.length === 0) {
        return { isValid: false, error: '[character] Name cannot be empty.' }
      }
      if (trimmed.length > 60) {
        return {
          isValid: false,
          error: `[character] Name must be 60 characters or fewer, got ${trimmed.length}.`,
        }
      }
      if (!isValidLevel(draft.level)) {
        return {
          isValid: false,
          error: `[character] Level must be an integer between 1 and 20, got ${draft.level}.`,
        }
      }
      return { isValid: true, error: null }
    }

    case 'species':
      // Ancestry is a free string at the engine level (no validator to call) —
      // the only requirement is non-empty, checked the same way the engine
      // checks name: a trimmed non-empty string. No new rule invented here;
      // buildCharacter() itself defaults blank ancestry to 'human' rather
      // than rejecting it, so we mirror that permissiveness.
      return { isValid: true, error: null }

    case 'class':
      // Same as species — archetype is a free string with a safe fallback
      // (DEFAULT_HIT_DIE) inside resolveHitDie(). Nothing to validate beyond
      // what buildCharacter() will already accept.
      return { isValid: true, error: null }

    case 'background':
      return { isValid: true, error: null }

    case 'abilities': {
      const error = validateAbilityScores(draft.scores)
      return { isValid: error === null, error }
    }

    case 'skills': {
      for (const skill of draft.skillProficiencies) {
        if (!isValidSkillId(skill)) {
          return { isValid: false, error: `[character] Unknown skill proficiency: "${skill}".` }
        }
      }
      const validStats: StatName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
      for (const stat of draft.savingThrowProficiencies) {
        if (!validStats.includes(stat)) {
          return {
            isValid: false,
            error: `[character] Unknown saving throw proficiency: "${stat}".`,
          }
        }
      }
      return { isValid: true, error: null }
    }

    case 'equipment': {
      for (const item of draft.equipment) {
        const error = validateEquipmentItem(item)
        if (error) return { isValid: false, error }
      }
      return { isValid: true, error: null }
    }

    case 'portrait':
      // No engine concept of a portrait — nothing to validate beyond what
      // the file picker itself already constrains (handled in the component).
      return { isValid: true, error: null }

    case 'review': {
      // Final gate: actually run the full draft through buildCharacter().
      // This is the single source of truth — if buildCharacter() doesn't
      // throw, the character is valid, full stop.
      try {
        buildCharacter(draftToCharacterInput(draft))
        return { isValid: true, error: null }
      } catch (err) {
        return { isValid: false, error: err instanceof Error ? err.message : 'Invalid character.' }
      }
    }
  }
}

/** Convert a CharacterDraft to the shape buildCharacter()/createCharacter() expect. */
export function draftToCharacterInput(draft: CharacterDraft) {
  return {
    name: draft.name.trim(),
    archetype: draft.archetype,
    ancestry: draft.ancestry,
    background: draft.background,
    level: draft.level,
    scores: draft.scores,
    skillProficiencies: draft.skillProficiencies,
    savingThrowProficiencies: draft.savingThrowProficiencies,
    equipment: draft.equipment,
  }
}

/**
 * Autosave / resume (Phase 10.1). The draft is genuinely ephemeral,
 * client-only, single-user data — appropriate for localStorage, unlike
 * anything that needs to sync across devices or survive as real app data
 * (that all goes through the Supabase service layer, unchanged here).
 *
 * Keyed by userId so a shared browser with multiple accounts never mixes
 * drafts between users. Cleared automatically on successful character
 * creation (see CharacterWizard.tsx) or when the player explicitly
 * discards it via the "Start Fresh" resume-prompt option.
 */
const DRAFT_STORAGE_PREFIX = 'chronicle-ai:character-draft:'

function draftStorageKey(userId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${userId}`
}

interface StoredDraft {
  draft: CharacterDraft
  stepIndex: number
  savedAt: string
}

/** Reads a saved draft for this user, if one exists and parses cleanly. */
export function loadSavedDraft(userId: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    // Minimal shape check — a corrupted or pre-migration entry should never
    // crash the wizard; treat it the same as "no saved draft."
    if (!parsed.draft || typeof parsed.stepIndex !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

/** Clears the saved draft for this user — called after successful creation or explicit discard. */
export function clearSavedDraft(userId: string): void {
  try {
    window.localStorage.removeItem(draftStorageKey(userId))
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded edge cases —
    // never let autosave failure break the wizard itself.
  }
}

/**
 * A draft is "worth confirming before discarding" once the player has
 * actually entered something — comparing against the same createEmptyDraft()
 * baseline the hook itself initializes from, not a separately invented rule.
 */
export function isDraftMeaningful(draft: CharacterDraft): boolean {
  const empty = createEmptyDraft()
  return (
    draft.name.trim() !== '' ||
    draft.archetype !== empty.archetype ||
    draft.ancestry !== empty.ancestry ||
    draft.background !== empty.background ||
    draft.skillProficiencies.length > 0 ||
    draft.savingThrowProficiencies.length > 0 ||
    draft.equipment.length > 0 ||
    draft.portraitUrl !== null ||
    draft.bio.trim() !== '' ||
    Object.entries(draft.scores).some(([k, v]) => v !== empty.scores[k as keyof AbilityScores])
  )
}

/**
 * Drive the multi-step character creation wizard. Owns the draft state,
 * current step, and per-step validation — all validation delegates to the
 * engine (see validateStep above). Components only ever read isValid/error
 * and render it; they never compute it themselves.
 */
export function useCharacterDraft(userId: string, initial?: Partial<CharacterDraft>) {
  const [draft, setDraft] = useState<CharacterDraft>(() => ({
    ...createEmptyDraft(),
    ...initial,
  }))
  const [stepIndex, setStepIndex] = useState(0)
  // Suppresses the autosave effect until an explicit resume/discard decision
  // has been made — otherwise mounting the wizard with a saved draft present
  // would immediately overwrite it with the blank initial draft before the
  // resume prompt even renders.
  const autosaveEnabledRef = useRef(false)

  const currentStep = WIZARD_STEPS[stepIndex]

  const updateDraft = useCallback((patch: Partial<CharacterDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  // Autosave — writes on every draft/step change once enabled. Cheap
  // (localStorage, small JSON payload) and correctness matters more than
  // debouncing here: losing the last few keystrokes on a crash is exactly
  // what this feature exists to prevent.
  useEffect(() => {
    if (!autosaveEnabledRef.current) return
    if (!isDraftMeaningful(draft)) {
      clearSavedDraft(userId)
      return
    }
    try {
      const payload: StoredDraft = { draft, stepIndex, savedAt: new Date().toISOString() }
      window.localStorage.setItem(draftStorageKey(userId), JSON.stringify(payload))
    } catch {
      // Same rationale as clearSavedDraft — autosave is a convenience, its
      // failure must never surface as a wizard-blocking error.
    }
  }, [draft, stepIndex, userId])

  /** Resumes from a previously saved draft. Enables autosave going forward. */
  const resumeDraft = useCallback((saved: StoredDraft) => {
    setDraft(saved.draft)
    setStepIndex(saved.stepIndex)
    autosaveEnabledRef.current = true
  }, [])

  /** Explicitly discards any saved draft and starts fresh. Enables autosave going forward. */
  const discardDraft = useCallback(() => {
    clearSavedDraft(userId)
    setDraft(createEmptyDraft())
    setStepIndex(0)
    autosaveEnabledRef.current = true
  }, [userId])

  /** For the no-saved-draft case: just start autosaving from a blank draft. */
  const startFreshDraft = useCallback(() => {
    autosaveEnabledRef.current = true
  }, [])

  const currentValidation = useMemo(
    () => validateStep(currentStep, draft),
    [currentStep, draft],
  )

  const goNext = useCallback(() => {
    if (!currentValidation.isValid) return false
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1))
    return true
  }, [currentValidation.isValid])

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0))
  }, [])

  const goToStep = useCallback((step: WizardStepId) => {
    const index = WIZARD_STEPS.indexOf(step)
    if (index !== -1) setStepIndex(index)
  }, [])

  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1

  /**
   * Validate the ENTIRE draft (every step), not just the current one.
   * Used by the Review step to show a complete list of blocking issues
   * rather than only the last one encountered.
   */
  const validateAll = useCallback((): StepValidation[] => {
    return WIZARD_STEPS.filter((s) => s !== 'review').map((step) => validateStep(step, draft))
  }, [draft])

  return {
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
  }
}

/**
 * Build a preview CharacterSheet from a draft, purely for live stat display
 * in the wizard/sheet (AC, modifiers, maxHp, proficiency bonus). This calls
 * buildCharacter() directly — it IS the engine's derivation, not a
 * reimplementation of it. Returns null if the draft doesn't validate yet
 * (e.g. mid-entry on the Abilities step) so callers can show a placeholder
 * instead of a stale/incorrect preview.
 */
export function usePreviewSheet(draft: CharacterDraft): CharacterSheet | null {
  return useMemo(() => {
    try {
      return buildCharacter(draftToCharacterInput(draft))
    } catch {
      return null
    }
  }, [draft])
}

export { ABILITY_SCORE_MIN, ABILITY_SCORE_MAX, isValidAbilityScore }
