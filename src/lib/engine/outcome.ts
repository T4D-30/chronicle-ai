/**
 * Chronicle AI — Outcome Engine
 * Phase 1.1
 *
 * Defines the canonical 5-tier outcome system and the rules for
 * evaluating any d20 roll result against a Difficulty Class.
 *
 * Constitution rule: "The Outcome is final. The AI narrates it — it does not change it."
 * This module is the single source of truth for that outcome.
 */

import type { RollResult } from './dice'

// ─── Outcome Enum ─────────────────────────────────────────────────────────────

/**
 * The five canonical outcome tiers.
 *
 * CRITICAL_SUCCESS         — Natural 20, or beat DC by ≥10.
 *                            Extra benefit beyond the intended result.
 *
 * FULL_SUCCESS             — Met or exceeded DC without a critical.
 *                            Player gets exactly what they attempted.
 *
 * SUCCESS_WITH_COST        — Came within 4 of the DC (DC-1 to DC-4).
 *                            Player succeeds, but something goes wrong too.
 *
 * FAILURE_WITH_OPPORTUNITY — Missed DC by 5–9.
 *                            Player fails, but a new possibility opens up.
 *
 * COMPLICATION             — Natural 1, or missed DC by ≥10.
 *                            Hard failure. Something gets worse.
 */
export enum Outcome {
  CRITICAL_SUCCESS = 'CRITICAL_SUCCESS',
  FULL_SUCCESS = 'FULL_SUCCESS',
  SUCCESS_WITH_COST = 'SUCCESS_WITH_COST',
  FAILURE_WITH_OPPORTUNITY = 'FAILURE_WITH_OPPORTUNITY',
  COMPLICATION = 'COMPLICATION',
}

// ─── Outcome Metadata ─────────────────────────────────────────────────────────

export interface OutcomeMeta {
  outcome: Outcome
  /** Human-readable short label used in UI display. */
  label: string
  /** Whether the player achieved their primary goal. */
  isSuccess: boolean
  /** Whether this outcome carries narrative complication. */
  hasCost: boolean
  /** Whether this was triggered by a natural 1 or 20. */
  isCritical: boolean
}

export const OUTCOME_META: Record<Outcome, Omit<OutcomeMeta, 'outcome'>> = {
  [Outcome.CRITICAL_SUCCESS]: {
    label: 'Critical Success',
    isSuccess: true,
    hasCost: false,
    isCritical: true,
  },
  [Outcome.FULL_SUCCESS]: {
    label: 'Success',
    isSuccess: true,
    hasCost: false,
    isCritical: false,
  },
  [Outcome.SUCCESS_WITH_COST]: {
    label: 'Success with Cost',
    isSuccess: true,
    hasCost: true,
    isCritical: false,
  },
  [Outcome.FAILURE_WITH_OPPORTUNITY]: {
    label: 'Failure with Opportunity',
    isSuccess: false,
    hasCost: false,
    isCritical: false,
  },
  [Outcome.COMPLICATION]: {
    label: 'Complication',
    isSuccess: false,
    hasCost: true,
    isCritical: true,
  },
}

// ─── Check Result ─────────────────────────────────────────────────────────────

/** Full structured result returned by evaluateRoll(). */
export interface CheckResult {
  outcome: Outcome
  meta: OutcomeMeta
  /** The RollResult that produced this check. */
  roll: RollResult
  /** The DC this roll was evaluated against. */
  dc: number
  /** total - dc. Positive = beat by this much, negative = missed by this much. */
  margin: number
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/**
 * Margin thresholds for the five outcome tiers.
 *
 * These are evaluated in the order listed — first match wins.
 * Critical rules (nat 20 / nat 1) override margin rules.
 *
 * Margin = roll.total - dc
 *   ≥ 10   → CRITICAL_SUCCESS (extreme beat)
 *   ≥  0   → FULL_SUCCESS
 *   ≥ -4   → SUCCESS_WITH_COST  (close miss becomes partial win)
 *   ≥ -9   → FAILURE_WITH_OPPORTUNITY
 *   < -9   → COMPLICATION
 */
const MARGIN_THRESHOLDS: Array<{ minMargin: number; outcome: Outcome }> = [
  { minMargin: 10, outcome: Outcome.CRITICAL_SUCCESS },
  { minMargin: 0, outcome: Outcome.FULL_SUCCESS },
  { minMargin: -4, outcome: Outcome.SUCCESS_WITH_COST },
  { minMargin: -9, outcome: Outcome.FAILURE_WITH_OPPORTUNITY },
]

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Evaluate a completed RollResult against a Difficulty Class.
 *
 * Priority order (constitution rule: "natural 20 cannot be overridden"):
 *   1. Natural 1  → always COMPLICATION, regardless of modifiers
 *   2. Natural 20 → always CRITICAL_SUCCESS, regardless of DC
 *   3. Margin thresholds (see MARGIN_THRESHOLDS)
 *
 * @param roll - The RollResult from dice.ts (must be a d20 roll)
 * @param dc   - The Difficulty Class to compare against
 *
 * @throws {Error} if the roll is not from a d20
 */
export function evaluateRoll(roll: RollResult, dc: number): CheckResult {
  if (!roll.rolls.some((r) => r.die === 'd20')) {
    throw new Error(
      `[outcome] evaluateRoll() requires a d20 roll. Got dice: ${roll.rolls.map((r) => r.die).join(', ')}`,
    )
  }

  if (dc < 1) {
    throw new Error(`[outcome] DC must be ≥ 1, got ${dc}.`)
  }

  const margin = roll.total - dc
  let outcome: Outcome

  // Natural criticals override margin math — Constitution Pillar 3
  if (roll.isNatural1) {
    outcome = Outcome.COMPLICATION
  } else if (roll.isNatural20) {
    outcome = Outcome.CRITICAL_SUCCESS
  } else {
    const matched = MARGIN_THRESHOLDS.find((t) => margin >= t.minMargin)
    outcome = matched?.outcome ?? Outcome.COMPLICATION
  }

  const meta: OutcomeMeta = {
    outcome,
    ...OUTCOME_META[outcome],
  }

  return { outcome, meta, roll, dc, margin }
}

/**
 * Convenience: evaluate a raw total integer directly (no RollResult needed).
 * Used in unit tests and edge cases where we control the number directly.
 *
 * @param total     - The final modified roll total
 * @param dc        - Difficulty Class
 * @param nat20     - Whether this was a natural 20
 * @param nat1      - Whether this was a natural 1
 */
export function evaluateTotal(
  total: number,
  dc: number,
  nat20 = false,
  nat1 = false,
): Omit<CheckResult, 'roll'> {
  if (dc < 1) throw new Error(`[outcome] DC must be ≥ 1, got ${dc}.`)

  const margin = total - dc
  let outcome: Outcome

  if (nat1) {
    outcome = Outcome.COMPLICATION
  } else if (nat20) {
    outcome = Outcome.CRITICAL_SUCCESS
  } else {
    const matched = MARGIN_THRESHOLDS.find((t) => margin >= t.minMargin)
    outcome = matched?.outcome ?? Outcome.COMPLICATION
  }

  const meta: OutcomeMeta = { outcome, ...OUTCOME_META[outcome] }
  return { outcome, meta, dc, margin }
}
