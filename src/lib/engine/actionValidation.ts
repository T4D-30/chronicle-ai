/**
 * Chronicle AI — Action Validation
 * Phase 1.6
 *
 * canPerformAction() is the gate that runs BEFORE resolveCharacterAction()
 * ever rolls a die. If a character is unconscious, stunned, paralyzed, or
 * dead, no roll should happen at all — the action is simply blocked, with
 * a reason the UI (and the AI Director) can read directly.
 *
 * Pure function — no RNG, no Supabase, no React. Reads only the structured
 * CharacterSheet (Constitution Law 3).
 */

import type { CharacterSheet } from './character'
import { isIncapacitated, hasCondition } from './conditions'
import type { ConditionId } from './conditions'

// ─── Action Descriptor ────────────────────────────────────────────────────────

export type ActionKind =
  | 'ability_check'
  | 'skill_check'
  | 'saving_throw'
  | 'melee_attack'
  | 'ranged_attack'
  | 'cast_spell'
  | 'use_item'
  | 'move'

export interface ActionDescriptor {
  kind: ActionKind
  /**
   * For cast_spell: the spell slot level required, if any (0 = cantrip,
   * always allowed re: slots). Volume II hook — see module footer note.
   */
  spellSlotLevel?: number
  /**
   * For ranged_attack: whether the weapon being used requires ammunition.
   * Volume II hook — see module footer note.
   */
  requiresAmmunition?: boolean
  /** For ranged_attack: how many rounds of ammunition the character currently has, if tracked. */
  ammunitionRemaining?: number
}

// ─── Validation Result ────────────────────────────────────────────────────────

export type BlockingReason =
  | 'DEAD'
  | 'UNCONSCIOUS'
  | 'STUNNED'
  | 'PARALYZED'
  | 'PETRIFIED'
  | 'INCAPACITATED'
  | 'NO_SPELL_SLOTS'
  | 'NO_AMMUNITION'
  | 'INVALID_WEAPON'

export interface ActionValidationResult {
  allowed: boolean
  reason: string | null
  /** The specific condition that caused the block, if condition-based. */
  blockingCondition?: ConditionId
  /** Machine-readable code for UI branching / Director context. */
  blockingReason?: BlockingReason
}

// ─── Death Check ──────────────────────────────────────────────────────────────

/**
 * A character is considered dead when either:
 *   1. currentHp drops to or below the negative of their max HP
 *      (the standard "instant death" / massive damage threshold), OR
 *   2. deathSaveFailures reaches 3 (the standard death saving throw rule —
 *      see CHRONICLE_GAME_LOOP.md: "Death: 0 HP → death saving throws
 *      (3 successes = stable, 3 failures = dead)").
 *
 * Phase 1.7: deathSaveFailures is now promoted onto CharacterSheet directly
 * (previously DB-only on CharacterRecord), so this function can read it
 * without reaching into the Supabase service layer — Constitution Law 3.
 */
function isDead(character: CharacterSheet): boolean {
  return character.currentHp <= -character.maxHp || character.deathSaveFailures >= 3
}

// ─── Core Validator ───────────────────────────────────────────────────────────

/**
 * Determine whether a character can perform the given action right now.
 *
 * Gate order (first match wins — most severe state blocks first):
 *   1. Dead
 *   2. Unconscious / Paralyzed / Petrified / Stunned (specific conditions)
 *   3. Generic incapacitated (any other condition with preventsActions)
 *   4. Action-specific resource gates (spell slots, ammunition)
 *
 * @param character - The character attempting the action
 * @param action    - What they're trying to do
 */
export function canPerformAction(
  character: CharacterSheet,
  action: ActionDescriptor,
): ActionValidationResult {
  // ── Gate 1: Dead ────────────────────────────────────────────────────────────
  if (isDead(character)) {
    return {
      allowed: false,
      reason: `${character.name} has died and cannot take any action.`,
      blockingReason: 'DEAD',
    }
  }

  // ── Gate 2: Condition-based incapacitation, most specific first ────────────
  const severityOrder: Array<{ id: ConditionId; reason: BlockingReason }> = [
    { id: 'unconscious', reason: 'UNCONSCIOUS' },
    { id: 'paralyzed', reason: 'PARALYZED' },
    { id: 'petrified', reason: 'PETRIFIED' },
    { id: 'stunned', reason: 'STUNNED' },
  ]

  for (const { id, reason } of severityOrder) {
    if (hasCondition(character.conditions, id)) {
      return {
        allowed: false,
        reason: `${character.name} is ${id} and cannot take actions.`,
        blockingCondition: id,
        blockingReason: reason,
      }
    }
  }

  // Generic catch-all: any other condition that prevents actions
  // (e.g. plain 'incapacitated' applied directly without a more specific cause).
  if (isIncapacitated(character.conditions)) {
    return {
      allowed: false,
      reason: `${character.name} is incapacitated and cannot take actions.`,
      blockingReason: 'INCAPACITATED',
    }
  }

  // ── Gate 3: Action-specific resource checks ─────────────────────────────────
  // Volume II hooks: CharacterSheet does not yet track spell slots or
  // ammunition counts (Phase 5 — Combat Presentation — per the Roadmap).
  // The structure below is wired and tested now so Volume II can populate
  // real data without changing canPerformAction()'s contract.

  if (action.kind === 'cast_spell' && action.spellSlotLevel !== undefined && action.spellSlotLevel > 0) {
    // No spell slot tracking on CharacterSheet yet — every leveled spell is
    // currently blocked until Volume II wires real slot data through.
    // This is intentionally conservative: better to block and let the UI
    // explain "spell slots aren't tracked yet" than to silently allow free casting.
    return {
      allowed: false,
      reason: 'Spell slot tracking is not yet implemented — cannot verify available slots.',
      blockingReason: 'NO_SPELL_SLOTS',
    }
  }

  if (action.kind === 'ranged_attack' && action.requiresAmmunition) {
    if (action.ammunitionRemaining !== undefined && action.ammunitionRemaining <= 0) {
      return {
        allowed: false,
        reason: 'No ammunition remaining for this attack.',
        blockingReason: 'NO_AMMUNITION',
      }
    }
  }

  // ── All gates passed ─────────────────────────────────────────────────────────
  return { allowed: true, reason: null }
}
