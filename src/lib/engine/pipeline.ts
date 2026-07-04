/**
 * Chronicle AI — Resolver Pipeline
 * Phase 1.6
 *
 * The deterministic modifier pipeline that turns a character + intent into
 * a fully-explained roll. Every stage below is a small, pure, independently
 * testable function. resolveCharacterAction() in resolveAction.ts composes
 * them in the order mandated by the Phase 1.6 spec:
 *
 *   1. Base ability
 *   2. Skill proficiency
 *   3. Saving throw proficiency
 *   4. Equipment
 *   5. Conditions
 *   6. Temporary effects
 *   7. Advantage/disadvantage resolution
 *   8. Final modifier
 *   9. Dice roll        (handled by dice.ts, not duplicated here)
 *  10. Outcome ladder    (handled by outcome.ts, not duplicated here)
 *
 * Stages 9–10 already exist as rollD20()/evaluateRoll() — this module owns
 * stages 1–8, which is the genuinely new "automatic derivation" logic.
 *
 * Constitution Law 6 (Transparency): every stage emits a PipelineStep with
 * a human-readable label and the exact numeric/mode contribution it made.
 * Nothing is silently folded into a single number.
 */

import type { RollMode } from './dice'
import type { StatName } from './intent'
import type { CharacterSheet } from './character'
import type { SkillId } from './skills'
import {
  getEquipmentAttackBonus,
  getEquipmentSkillBonus,
  getEquipmentSaveBonus,
} from './equipment'
import { resolveConditionModifiers, isIncapacitated } from './conditions'
import type { RollContext } from './conditions'

// ─── Pipeline Step ────────────────────────────────────────────────────────────

/**
 * One labeled contribution to the final modifier or roll mode.
 * Stages with a flat numeric contribution set `value`. Stages that only
 * affect advantage/disadvantage set `mode` and leave `value` at 0.
 */
export interface PipelineStep {
  /** Which pipeline stage produced this contribution. */
  stage: PipelineStageName
  /** Human-readable label for the breakdown display, e.g. "STR +4". */
  label: string
  /** Flat numeric contribution to the total modifier. 0 if this stage only affects mode. */
  value: number
  /** If this stage forces advantage/disadvantage, the mode it forces. Undefined = no effect on mode. */
  mode?: RollMode
}

export type PipelineStageName =
  | 'base_ability'
  | 'skill_proficiency'
  | 'saving_throw_proficiency'
  | 'equipment'
  | 'conditions'
  | 'temporary_effects'

// ─── Pipeline Input ───────────────────────────────────────────────────────────

/**
 * What kind of check is being resolved. Determines which proficiency
 * (skill vs saving throw) applies, and which RollContext conditions use.
 */
export type CheckKind = 'skill' | 'saving_throw' | 'attack' | 'raw_ability'

export interface PipelineInput {
  character: CharacterSheet
  /** The ability being used for this check (e.g. 'DEX' for a Stealth check). */
  ability: StatName
  /** What kind of check this is — determines proficiency lookup and condition context. */
  checkKind: CheckKind
  /** The skill being checked, if checkKind === 'skill'. */
  skill?: SkillId
  /** Extra situational/temporary modifiers from the caller (spells, terrain, Director rulings). */
  temporaryEffects?: Array<{ label: string; value?: number; mode?: RollMode }>
}

// ─── Stage 1: Base Ability ────────────────────────────────────────────────────

/**
 * Stage 1 — Base Ability.
 * The character's raw ability modifier for the relevant stat.
 */
export function stageBaseAbility(character: CharacterSheet, ability: StatName): PipelineStep {
  const modifierKey = abilityToModifierKey(ability)
  const value = character.modifiers[modifierKey]
  return {
    stage: 'base_ability',
    label: `${ability} ${formatSigned(value)}`,
    value,
  }
}

/** Map a StatName ('STR'...) to the corresponding key on AbilityScores ('strength'...). */
function abilityToModifierKey(ability: StatName): keyof CharacterSheet['modifiers'] {
  const map: Record<StatName, keyof CharacterSheet['modifiers']> = {
    STR: 'strength',
    DEX: 'dexterity',
    CON: 'constitution',
    INT: 'intelligence',
    WIS: 'wisdom',
    CHA: 'charisma',
  }
  return map[ability]
}

// ─── Stage 2: Skill Proficiency ───────────────────────────────────────────────

/**
 * Stage 2 — Skill Proficiency.
 * Adds the character's proficiency bonus if they are proficient in the
 * given skill. Returns a zero-value step (no contribution) if not applicable
 * — e.g. checkKind isn't 'skill', or no skill was specified, or the
 * character lacks the proficiency.
 */
export function stageSkillProficiency(
  character: CharacterSheet,
  checkKind: CheckKind,
  skill: SkillId | undefined,
): PipelineStep {
  if (checkKind !== 'skill' || !skill) {
    return { stage: 'skill_proficiency', label: 'No skill proficiency applicable', value: 0 }
  }

  const isProficient = character.skillProficiencies.includes(skill)
  if (!isProficient) {
    return { stage: 'skill_proficiency', label: 'Not proficient', value: 0 }
  }

  return {
    stage: 'skill_proficiency',
    label: `Proficiency ${formatSigned(character.proficiencyBonus)}`,
    value: character.proficiencyBonus,
  }
}

// ─── Stage 3: Saving Throw Proficiency ────────────────────────────────────────

/**
 * Stage 3 — Saving Throw Proficiency.
 * Adds the character's proficiency bonus if they are proficient in saving
 * throws for the given ability. Zero-value step if not applicable.
 */
export function stageSavingThrowProficiency(
  character: CharacterSheet,
  checkKind: CheckKind,
  ability: StatName,
): PipelineStep {
  if (checkKind !== 'saving_throw') {
    return {
      stage: 'saving_throw_proficiency',
      label: 'No saving throw proficiency applicable',
      value: 0,
    }
  }

  const isProficient = character.savingThrowProficiencies.includes(ability)
  if (!isProficient) {
    return { stage: 'saving_throw_proficiency', label: 'Not proficient', value: 0 }
  }

  return {
    stage: 'saving_throw_proficiency',
    label: `Save Proficiency ${formatSigned(character.proficiencyBonus)}`,
    value: character.proficiencyBonus,
  }
}

// ─── Stage 4: Equipment ───────────────────────────────────────────────────────

/**
 * Stage 4 — Equipment.
 * Sums all applicable equipment bonuses for this check: attack bonus for
 * attack checks, skill bonus for skill checks, save bonus for saving throws.
 * Multiple contributing items are combined into a single step with a
 * combined label (individual item attribution is available via the
 * equipment module directly for debug panels that want more detail).
 */
export function stageEquipment(
  character: CharacterSheet,
  checkKind: CheckKind,
  ability: StatName,
  skill: SkillId | undefined,
): PipelineStep {
  let value = 0
  const labelPrefix = checkKind === 'attack' ? 'Weapon' : 'Equipment'

  if (checkKind === 'attack') {
    value = getEquipmentAttackBonus(character.equipment)
  } else if (checkKind === 'skill' && skill) {
    value = getEquipmentSkillBonus(character.equipment, skill)
  } else if (checkKind === 'saving_throw') {
    value = getEquipmentSaveBonus(character.equipment, ability)
  }

  if (value === 0) {
    return { stage: 'equipment', label: 'No equipment bonus', value: 0 }
  }

  return { stage: 'equipment', label: `${labelPrefix} ${formatSigned(value)}`, value }
}

// ─── Stage 5: Conditions ──────────────────────────────────────────────────────

/**
 * Stage 5 — Conditions.
 * Reads the character's active conditions and resolves both flat modifiers
 * and advantage/disadvantage for the given roll context. This is the direct
 * integration point with conditions.ts — the caller never manually applies
 * condition effects; this stage does it automatically.
 */
export function stageConditions(character: CharacterSheet, context: RollContext): PipelineStep {
  const conditionMods = resolveConditionModifiers(character.conditions, context)

  if (conditionMods.length === 0) {
    return { stage: 'conditions', label: 'No active conditions affect this roll', value: 0 }
  }

  const flatValue = conditionMods.reduce((sum, m) => sum + (m.flatBonus ?? 0), 0)
  const modeMod = conditionMods.find((m) => m.mode !== undefined)
  const labels = conditionMods.map((m) => m.reason).join('; ')

  return {
    stage: 'conditions',
    label: labels,
    value: flatValue,
    mode: modeMod?.mode,
  }
}

/** Map a CheckKind to the RollContext used by the conditions engine. */
export function checkKindToRollContext(checkKind: CheckKind): RollContext {
  switch (checkKind) {
    case 'attack':
      return 'attack_roll'
    case 'saving_throw':
      return 'saving_throw'
    case 'skill':
    case 'raw_ability':
    default:
      return 'ability_check'
  }
}

// ─── Stage 6: Temporary Effects ───────────────────────────────────────────────

/**
 * Stage 6 — Temporary Effects.
 * Caller-supplied situational modifiers that aren't permanent character
 * state: spell buffs ("Bless +1d4"), terrain penalties, Director rulings.
 * These are explicit, not automatically derived — the caller passes them
 * via PipelineInput.temporaryEffects.
 */
export function stageTemporaryEffects(
  effects: Array<{ label: string; value?: number; mode?: RollMode }> = [],
): PipelineStep {
  if (effects.length === 0) {
    return { stage: 'temporary_effects', label: 'No temporary effects', value: 0 }
  }

  const value = effects.reduce((sum, e) => sum + (e.value ?? 0), 0)
  const modeMod = effects.find((e) => e.mode !== undefined)
  const label = effects.map((e) => e.label).join('; ')

  return {
    stage: 'temporary_effects',
    label,
    value,
    mode: modeMod?.mode,
  }
}

// ─── Stage 7: Advantage/Disadvantage Resolution ───────────────────────────────

/**
 * Stage 7 — Advantage/Disadvantage Resolution.
 *
 * D&D rule: advantage and disadvantage do not stack; if both are present
 * from any combination of sources, they cancel and the roll is normal.
 * If only one is present (from any number of sources), the roll uses that
 * mode once — multiple sources of the same mode don't compound.
 *
 * @param steps - All prior pipeline steps that may carry a `mode`
 * @param callerMode - An explicit mode override the caller passed in (e.g. Director ruling)
 */
export function resolveAdvantageDisadvantage(
  steps: PipelineStep[],
  callerMode?: RollMode,
): RollMode {
  const modes = steps.map((s) => s.mode).filter((m): m is RollMode => m !== undefined)
  if (callerMode) modes.push(callerMode)

  const hasAdvantage = modes.includes('advantage')
  const hasDisadvantage = modes.includes('disadvantage')

  if (hasAdvantage && hasDisadvantage) return 'normal'
  if (hasAdvantage) return 'advantage'
  if (hasDisadvantage) return 'disadvantage'
  return 'normal'
}

// ─── Stage 8: Final Modifier ───────────────────────────────────────────────────

/**
 * Stage 8 — Final Modifier.
 * Sums every stage's numeric value into the single modifier passed to the
 * dice roll. This is the last pure-arithmetic stage before randomness.
 */
export function calculateFinalModifier(steps: PipelineStep[]): number {
  return steps.reduce((sum, s) => sum + s.value, 0)
}

// ─── Incapacitation Gate ──────────────────────────────────────────────────────

/**
 * Convenience re-export point: whether the character's active conditions
 * prevent them from acting at all. The pipeline itself does not gate on
 * this — that's actionValidation.ts's job — but it's exposed here too
 * since pipeline callers sometimes want a fast pre-check.
 */
export function isCharacterIncapacitated(character: CharacterSheet): boolean {
  return isIncapacitated(character.conditions)
}

// ─── Full Pipeline Runner ──────────────────────────────────────────────────────

/** The complete output of running stages 1–8 against a PipelineInput. */
export interface PipelineResult {
  steps: PipelineStep[]
  totalModifier: number
  resolvedMode: RollMode
}

/**
 * Run the full stage 1–8 pipeline and return every step plus the final
 * modifier and resolved advantage/disadvantage mode. Stages 9–10 (dice roll,
 * outcome ladder) are NOT run here — see resolveCharacterAction() in
 * resolveAction.ts, which calls this and then proceeds to roll and evaluate.
 *
 * @param input      - Character, ability, check kind, skill, temporary effects
 * @param callerMode - Optional explicit advantage/disadvantage override
 */
export function runPipeline(input: PipelineInput, callerMode?: RollMode): PipelineResult {
  const { character, ability, checkKind, skill, temporaryEffects } = input
  const context = checkKindToRollContext(checkKind)

  const steps: PipelineStep[] = [
    stageBaseAbility(character, ability),
    stageSkillProficiency(character, checkKind, skill),
    stageSavingThrowProficiency(character, checkKind, ability),
    stageEquipment(character, checkKind, ability, skill),
    stageConditions(character, context),
    stageTemporaryEffects(temporaryEffects),
  ]

  const resolvedMode = resolveAdvantageDisadvantage(steps, callerMode)
  const totalModifier = calculateFinalModifier(steps)

  return { steps, totalModifier, resolvedMode }
}

// ─── Formatting Helper ────────────────────────────────────────────────────────

/** Format a number with an explicit leading sign, e.g. 4 → "+4", -1 → "-1", 0 → "+0". */
export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}
