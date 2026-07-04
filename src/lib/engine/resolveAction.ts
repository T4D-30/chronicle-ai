/**
 * Chronicle AI — Action Resolver
 * Phase 1.1
 *
 * Orchestrates the full resolution pipeline for a single player turn:
 *   parseAction()  → ActionIntent
 *   rollD20()      → RollResult
 *   evaluateRoll() → CheckResult
 *
 * This is the single function the Director AI (Phase 2) and the session
 * loop (Phase 3) will call. Everything below it is an implementation detail.
 *
 * Constitution rule: "The Outcome is final. The AI narrates it — it does not change it."
 */

import { rollD20 } from './dice'
import type { RollMode } from './dice'
import { evaluateRoll } from './outcome'
import type { CheckResult } from './outcome'
import { parseAction, statModifier } from './intent'
import type { ActionIntent, StatName, SituationalModifier } from './intent'
import type { CharacterSheet } from './character'
import type { SkillId } from './skills'
import { getSkillAbility } from './skills'
import { canPerformAction } from './actionValidation'
import type { ActionDescriptor, ActionValidationResult } from './actionValidation'
import {
  runPipeline,
  formatSigned,
} from './pipeline'
import type { CheckKind, PipelineStep } from './pipeline'

// ─── Resolution Config ────────────────────────────────────────────────────────

/**
 * Everything the resolver needs to run a check.
 * The Director AI will fill this in Phase 2; the engine uses it blindly.
 */
export interface CheckConfig {
  /** DC to roll against. If omitted, uses the intent's suggestedDc. */
  dc?: number
  /**
   * The character's raw stat value for the relevant stat.
   * If provided, the modifier is computed automatically.
   */
  statValue?: number
  /**
   * Flat modifier override (used when caller has already computed the modifier).
   * If both statValue and flatModifier are provided, they are added together.
   */
  flatModifier?: number
  /** Additional situational modifiers (e.g. from equipment, conditions). */
  situationalModifiers?: SituationalModifier[]
  /** Roll mode for d20. Defaults to 'normal'. */
  mode?: RollMode
  /**
   * Override the stat used for this check (e.g. Director overrides DEX → WIS
   * for an insight check disguised as a stealth scene).
   */
  statOverride?: StatName
}

// ─── Resolution Result ────────────────────────────────────────────────────────

/** The complete, immutable record of one resolved player action. */
export interface ResolutionResult {
  /** The structured intent parsed from the player's text. */
  intent: ActionIntent
  /** The stat actually rolled (may differ from intent.stat if overridden). */
  statUsed: StatName
  /** The DC used for this check. */
  dc: number
  /** The total modifier applied to the roll (stat + situational). */
  totalModifier: number
  /** Breakdown of each modifier component, for UI transparency. */
  modifierBreakdown: ModifierComponent[]
  /** The full check result including outcome, roll, and margin. */
  check: CheckResult
}

export interface ModifierComponent {
  source: string
  value: number
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve a player action through the full engine pipeline.
 *
 * @param rawInput - The player's free-text action (1–500 chars)
 * @param config   - Optional check configuration from the Director/caller
 *
 * @example
 * const result = resolveAction("I try to pick the lock", {
 *   statValue: 14,    // DEX 14 → +2 modifier
 *   dc: 15,           // Hard lock
 *   mode: 'advantage' // Using thieves' tools
 * })
 */
export function resolveAction(rawInput: string, config: CheckConfig = {}): ResolutionResult {
  // Step 1 — Parse intent
  const intent = parseAction(rawInput)

  // Step 2 — Determine stat
  const statUsed = config.statOverride ?? intent.stat

  // Step 3 — Build modifier breakdown
  const modifierBreakdown: ModifierComponent[] = []
  let totalModifier = 0

  if (config.statValue !== undefined) {
    const mod = statModifier(config.statValue)
    modifierBreakdown.push({ source: statUsed, value: mod })
    totalModifier += mod
  }

  if (config.flatModifier !== undefined && config.flatModifier !== 0) {
    modifierBreakdown.push({ source: 'bonus', value: config.flatModifier })
    totalModifier += config.flatModifier
  }

  if (config.situationalModifiers) {
    for (const sm of config.situationalModifiers) {
      if (sm.value !== 0) {
        modifierBreakdown.push({ source: sm.reason, value: sm.value })
        totalModifier += sm.value
      }
    }
  }

  // Step 4 — Determine DC
  const dc = config.dc ?? intent.suggestedDc

  // Step 5 — Roll d20
  const mode = config.mode ?? 'normal'
  const roll = rollD20(totalModifier, mode)

  // Step 6 — Evaluate outcome (Constitution: this result is immutable)
  const check = evaluateRoll(roll, dc)

  return {
    intent,
    statUsed,
    dc,
    totalModifier,
    modifierBreakdown,
    check,
  }
}

// ─── Convenience Helpers ──────────────────────────────────────────────────────

/**
 * Run a quick check with explicit DC and modifier — no intent parsing.
 * Useful for scripted checks (traps, saving throws) where the Director
 * already knows exactly what to roll.
 *
 * @param dc        - Difficulty Class
 * @param modifier  - Total modifier (already computed)
 * @param mode      - Roll mode
 */
export function resolveCheck(
  dc: number,
  modifier = 0,
  mode: RollMode = 'normal',
): CheckResult {
  if (dc < 1) throw new Error(`[resolver] DC must be ≥ 1, got ${dc}.`)
  const roll = rollD20(modifier, mode)
  return evaluateRoll(roll, dc)
}

/**
 * Summarise a ResolutionResult for logging, persistence, and the Director payload.
 * This is the shape stored in `narrative_turns.dice_rolls`.
 */
export interface ResolutionSummary {
  rawInput: string
  category: string
  stat: string
  dc: number
  roll: {
    faces: number[]
    modifier: number
    total: number
    mode: string
    isNatural20: boolean
    isNatural1: boolean
  }
  outcome: string
  outcomeLabel: string
  margin: number
  isSuccess: boolean
  timestamp: string
}

/**
 * Shared body for summariseResolution/summariseCharacterAction — the two
 * public functions differ only in which field carries the resolved stat
 * (`statUsed` vs `ability`); everything else about their inputs
 * (`intent`, `dc`, `check`) is structurally identical. Extracted here after
 * a Phase 10.0 repository audit found the two functions were otherwise
 * byte-for-byte duplicates. Private — not exported, not part of the public
 * engine API surface.
 */
function buildResolutionSummary(input: {
  intent: ActionIntent
  stat: StatName
  dc: number
  check: CheckResult
}): ResolutionSummary {
  return {
    rawInput: input.intent.rawInput,
    category: input.intent.category,
    stat: input.stat,
    dc: input.dc,
    roll: {
      faces: input.check.roll.rolls.map((d) => d.face),
      modifier: input.check.roll.modifier,
      total: input.check.roll.total,
      mode: input.check.roll.mode,
      isNatural20: input.check.roll.isNatural20,
      isNatural1: input.check.roll.isNatural1,
    },
    outcome: input.check.outcome,
    outcomeLabel: input.check.meta.label,
    margin: input.check.margin,
    isSuccess: input.check.meta.isSuccess,
    timestamp: input.check.roll.timestamp,
  }
}

export function summariseResolution(r: ResolutionResult): ResolutionSummary {
  return buildResolutionSummary({ intent: r.intent, stat: r.statUsed, dc: r.dc, check: r.check })
}

/**
 * Same output shape as summariseResolution(), adapted for
 * CharacterActionResult['resolution'] (the resolveCharacterAction() output —
 * field name differs slightly: `ability` instead of `statUsed`). Kept as a
 * distinct public function rather than forcing both input shapes into one
 * union parameter, which would make either call site harder to read for no
 * real benefit — the two resolvers' result shapes are intentionally
 * distinct (see resolveAction() vs resolveCharacterAction() doc comments).
 * The shared body they both delegate to is buildResolutionSummary() above.
 *
 * Phase 9.3: this is the function that lets exploration-turn dice results
 * (once resolved via resolveCharacterAction) reach NarrativeTurn.diceRolls
 * in the same ResolutionSummary shape combat already uses.
 */
export function summariseCharacterAction(
  r: NonNullable<CharacterActionResult['resolution']>,
): ResolutionSummary {
  return buildResolutionSummary({ intent: r.intent, stat: r.ability, dc: r.dc, check: r.check })
}

// ═══════════════════════════════════════════════════════════════════════════
//  Phase 1.6 — Automatic Character Resolution
// ═══════════════════════════════════════════════════════════════════════════
//
// resolveCharacterAction() is the gameplay-complete resolver: give it a
// character, an intent, and a DC, and it derives every modifier itself —
// ability, skill proficiency, saving throw proficiency, equipment,
// conditions, advantage/disadvantage — with zero manual calculation by
// the caller. This is additive to the file above; resolveAction() and
// resolveCheck() are unchanged and still work exactly as before.
//
// Constitution Law 6 (Transparency): the result includes a full,
// human-readable breakdown of every contributing stage.

/**
 * Input to resolveCharacterAction(). This is the rich shape named in the
 * Phase 1.6 spec: { character, skill?, savingThrow?, ability?, intent, dc, context? }
 */
export interface CharacterActionInput {
  /** The character attempting the action. Source of truth for all modifiers. */
  character: CharacterSheet
  /**
   * The skill being checked, if this is a skill check (e.g. 'stealth').
   * Mutually exclusive in practice with savingThrow — a check is either a
   * skill check, a saving throw, or a raw/attack ability check.
   */
  skill?: SkillId
  /**
   * The ability being used for a saving throw (e.g. 'CON' for a poison save).
   * When set, this is a saving throw — proficiency is looked up via
   * character.savingThrowProficiencies instead of skillProficiencies.
   */
  savingThrow?: StatName
  /**
   * Explicit ability override. If omitted, derived automatically:
   *   - skill set        → governing ability for that skill
   *   - savingThrow set   → the savingThrow ability itself
   *   - neither set       → falls back to the parsed intent's suggested stat
   */
  ability?: StatName
  /** The player's free-text action (1–500 chars). Parsed the same way resolveAction() does. */
  intent: string
  /** Difficulty Class to roll against. */
  dc: number
  /**
   * Optional extra context: explicit check kind override, advantage/disadvantage
   * override, temporary effects (spell buffs, terrain), and an ActionDescriptor
   * for canPerformAction() gating (defaults to a generic ability_check/skill_check).
   */
  context?: {
    checkKind?: CheckKind
    mode?: RollMode
    temporaryEffects?: Array<{ label: string; value?: number; mode?: RollMode }>
    action?: ActionDescriptor
  }
}

/** One line of the full transparency breakdown — see Constitution Law 6. */
export interface BreakdownLine {
  label: string
  value: number
}

/** The complete, transparent result of an automatic character action resolution. */
export interface CharacterActionResult {
  /** Whether the action was even allowed to be attempted. */
  validation: ActionValidationResult
  /**
   * Present only if validation.allowed === true. No roll happens for a
   * blocked action — there is nothing to resolve.
   */
  resolution: {
    intent: ActionIntent
    ability: StatName
    checkKind: CheckKind
    skill?: SkillId
    dc: number
    /** Every pipeline stage's contribution, in pipeline order. */
    steps: PipelineStep[]
    /** Flattened, ready-to-render breakdown lines (Constitution Law 6). */
    breakdown: BreakdownLine[]
    totalModifier: number
    resolvedMode: RollMode
    check: CheckResult
  } | null
}

/**
 * Derive the ability used for this check, in priority order:
 *   1. Explicit ability override (input.ability)
 *   2. Skill's governing ability (if input.skill is set)
 *   3. The saving throw ability itself (if input.savingThrow is set)
 *   4. The parsed intent's suggested stat (fallback)
 */
function deriveAbility(input: CharacterActionInput, parsedIntent: ActionIntent): StatName {
  if (input.ability) return input.ability
  if (input.skill) return getSkillAbility(input.skill)
  if (input.savingThrow) return input.savingThrow
  return parsedIntent.stat
}

/**
 * Derive the check kind, in priority order:
 *   1. Explicit override (input.context.checkKind)
 *   2. 'saving_throw' if input.savingThrow is set
 *   3. 'skill' if input.skill is set
 *   4. 'raw_ability' fallback
 */
function deriveCheckKind(input: CharacterActionInput): CheckKind {
  if (input.context?.checkKind) return input.context.checkKind
  if (input.savingThrow) return 'saving_throw'
  if (input.skill) return 'skill'
  return 'raw_ability'
}

/**
 * Resolve a player action with full automatic character-derived modifier
 * calculation. This is the Phase 1.6 entry point — callers provide only
 * the character, what's being checked, and the DC. Every modifier the
 * pipeline can derive is derived automatically; nothing is manually
 * calculated by the caller.
 *
 * If the character cannot act (dead, unconscious, stunned, paralyzed, or
 * otherwise incapacitated), no roll is attempted — the function returns
 * immediately with `validation.allowed = false` and a human-readable reason.
 *
 * @example
 * const result = resolveCharacterAction({
 *   character: aldric,
 *   skill: 'stealth',
 *   intent: 'I try to sneak past the guard',
 *   dc: 15,
 * })
 *
 * if (!result.validation.allowed) {
 *   console.log(result.validation.reason)
 * } else {
 *   console.log(result.resolution.check.outcome)
 * }
 */
export function resolveCharacterAction(input: CharacterActionInput): CharacterActionResult {
  // ── Step 0: Validate the action can even be attempted ───────────────────────
  const checkKind = deriveCheckKind(input)
  const actionDescriptor: ActionDescriptor =
    input.context?.action ??
    ({
      kind:
        checkKind === 'saving_throw'
          ? 'saving_throw'
          : checkKind === 'attack'
            ? 'melee_attack'
            : checkKind === 'skill'
              ? 'skill_check'
              : 'ability_check',
    } as ActionDescriptor)

  const validation = canPerformAction(input.character, actionDescriptor)
  if (!validation.allowed) {
    return { validation, resolution: null }
  }

  // ── Step 1: Parse intent (reuses the same parser as resolveAction()) ───────
  const parsedIntent = parseAction(input.intent)

  // ── Step 2: Derive ability ───────────────────────────────────────────────────
  const ability = deriveAbility(input, parsedIntent)

  // ── Step 3: Run the 8-stage modifier pipeline ───────────────────────────────
  const pipelineResult = runPipeline(
    {
      character: input.character,
      ability,
      checkKind,
      skill: input.skill,
      temporaryEffects: input.context?.temporaryEffects,
    },
    input.context?.mode,
  )

  // ── Step 4: Roll the die (stage 9) ──────────────────────────────────────────
  const roll = rollD20(pipelineResult.totalModifier, pipelineResult.resolvedMode)

  // ── Step 5: Evaluate the outcome (stage 10) ─────────────────────────────────
  const check = evaluateRoll(roll, input.dc)

  // ── Step 6: Build the transparency breakdown ────────────────────────────────
  const breakdown: BreakdownLine[] = pipelineResult.steps
    .filter((s) => s.value !== 0 || s.mode !== undefined)
    .map((s) => ({ label: s.label, value: s.value }))

  return {
    validation,
    resolution: {
      intent: parsedIntent,
      ability,
      checkKind,
      skill: input.skill,
      dc: input.dc,
      steps: pipelineResult.steps,
      breakdown,
      totalModifier: pipelineResult.totalModifier,
      resolvedMode: pipelineResult.resolvedMode,
      check,
    },
  }
}

/**
 * Render a CharacterActionResult as a human-readable, multi-line breakdown
 * string — exactly the transparency format the Phase 1.6 spec requests for
 * future Debug Panels. Returns a one-line block reason string if the action
 * was not allowed.
 *
 * @example
 * STR +4
 * Proficiency +3
 * Weapon +1
 * Poisoned: disadvantage on attacks
 *
 * Total Modifier +8
 *
 * Rolled 17
 * Final 25
 *
 * Outcome: FULL_SUCCESS
 */
export function formatBreakdown(result: CharacterActionResult): string {
  if (!result.validation.allowed || !result.resolution) {
    return `Action blocked: ${result.validation.reason ?? 'Unknown reason.'}`
  }

  const { resolution } = result
  const lines: string[] = []

  for (const line of resolution.breakdown) {
    if (line.value !== 0) {
      lines.push(`${line.label}`)
    }
  }

  lines.push('')
  lines.push(`Total Modifier ${formatSigned(resolution.totalModifier)}`)
  lines.push('')
  lines.push(`Rolled ${resolution.check.roll.faceTotal}`)
  lines.push(`Final ${resolution.check.roll.total}`)
  lines.push('')
  lines.push(`Outcome: ${resolution.check.outcome}`)

  return lines.join('\n')
}
