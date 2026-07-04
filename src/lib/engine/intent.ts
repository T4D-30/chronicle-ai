/**
 * Chronicle AI — Action Intent
 * Phase 1.1
 *
 * Converts a player's free-text action string into a structured ActionIntent
 * that the resolution engine can process.
 *
 * Phase 1.1 scope:
 *   - Keyword-based intent classification (no AI)
 *   - Stat determination from action type
 *   - DC suggestion from context hints
 *
 * Phase 2 upgrade path:
 *   - The Director AI will produce richer CheckConfig from the same ActionIntent
 *   - This module's output shape is the stable contract; internals can change
 */

import { DC } from './dice'
import type { DCTier } from './dice'

// ─── Stats ────────────────────────────────────────────────────────────────────

export type StatName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

export const ALL_STATS: StatName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

// ─── Action Categories ────────────────────────────────────────────────────────

/**
 * The six canonical action categories in Chronicle AI.
 * Each maps to a primary stat and a default DC tier.
 */
export type ActionCategory =
  | 'FORCE'      // Smash, break, lift, push — STR
  | 'FINESSE'    // Sneak, dodge, pick locks, acrobatics — DEX
  | 'ENDURE'     // Resist, survive, march on — CON
  | 'REASON'     // Investigate, recall lore, solve, decipher — INT
  | 'PERCEIVE'   // Notice, sense, read the room, survive wilderness — WIS
  | 'INFLUENCE'  // Persuade, deceive, intimidate, charm — CHA
  | 'UNKNOWN'    // Fallback — defaults to WIS check

// ─── Keyword Maps ─────────────────────────────────────────────────────────────

/** Each keyword set triggers the associated category. Lower index = higher priority per category. */
const CATEGORY_KEYWORDS: Record<Exclude<ActionCategory, 'UNKNOWN'>, string[]> = {
  FORCE: [
    'smash', 'break', 'shatter', 'kick', 'punch', 'lift', 'push', 'pull',
    'force', 'batter', 'destroy', 'rip', 'tear', 'bash', 'charge', 'tackle',
    'heave', 'drag', 'carry', 'throw', 'wrestle', 'grapple', 'pry',
  ],
  FINESSE: [
    'sneak', 'hide', 'steal', 'pick', 'lock', 'dodge', 'evade', 'creep',
    'tiptoe', 'slip', 'climb', 'balance', 'tumble', 'acrobat', 'pickpocket',
    'disarm', 'ambush', 'sprint', 'leap', 'jump', 'roll', 'dive', 'escape',
    'disguise', 'shadow',
  ],
  ENDURE: [
    'resist', 'endure', 'withstand', 'survive', 'march', 'push through',
    'hold on', 'steel', 'brace', 'tough', 'concentrate', 'hold breath',
    'stay awake', 'fight off', 'shake off',
  ],
  REASON: [
    'investigate', 'search', 'examine', 'study', 'read', 'decipher', 'decode',
    'recall', 'remember', 'identify', 'analyze', 'analyse', 'research',
    'figure out', 'solve', 'understand', 'translate', 'detect magic',
    'arcane', 'lore', 'history', 'knowledge',
  ],
  PERCEIVE: [
    'look', 'listen', 'watch', 'observe', 'notice', 'spot', 'hear',
    'sense', 'feel', 'detect', 'scan', 'survey', 'scout', 'track',
    'follow tracks', 'forage', 'navigate', 'find', 'check', 'peek',
    'peer', 'perceive', 'insight', 'intuition',
  ],
  INFLUENCE: [
    'persuade', 'convince', 'negotiate', 'barter', 'talk', 'speak',
    'argue', 'threaten', 'intimidate', 'bluff', 'deceive', 'lie',
    'charm', 'flatter', 'bribe', 'ask', 'request', 'demand', 'plead',
    'seduce', 'inspire', 'rally', 'distract', 'taunt', 'question',
    'interrogate',
  ],
}

/** Maps each category to its primary stat. */
const CATEGORY_STAT: Record<ActionCategory, StatName> = {
  FORCE:     'STR',
  FINESSE:   'DEX',
  ENDURE:    'CON',
  REASON:    'INT',
  PERCEIVE:  'WIS',
  INFLUENCE: 'CHA',
  UNKNOWN:   'WIS',
}

/** Default DC tier per category. */
const CATEGORY_DEFAULT_DC: Record<ActionCategory, DCTier> = {
  FORCE:     'MEDIUM',
  FINESSE:   'MEDIUM',
  ENDURE:    'EASY',
  REASON:    'MEDIUM',
  PERCEIVE:  'EASY',
  INFLUENCE: 'MEDIUM',
  UNKNOWN:   'EASY',
}

// ─── Difficulty Hints ─────────────────────────────────────────────────────────

/** Words in player input that hint at higher or lower difficulty. */
const DIFFICULTY_BUMP_UP: string[] = [
  'carefully', 'cautiously', 'quickly', 'rushing', 'in the dark', 'blindly',
  'ancient', 'legendary', 'impossible', 'massive', 'heavily guarded',
  'complicated', 'encrypted', 'magically sealed', 'from a distance',
]

const DIFFICULTY_BUMP_DOWN: string[] = [
  'slowly', 'take my time', 'help from', 'assisted', 'simple', 'easy',
  'small', 'familiar', 'common', 'practiced', 'routine',
]

// ─── Structured Types ─────────────────────────────────────────────────────────

/** The structured form of a player action — engine's input contract. */
export interface ActionIntent {
  /** Raw input text from the player. */
  rawInput: string
  /** Normalised lowercase version for processing. */
  normalised: string
  /** Detected action category. */
  category: ActionCategory
  /** Primary stat to roll against. */
  stat: StatName
  /** Suggested DC for this action. */
  suggestedDc: number
  /** DC tier label for the Director's context. */
  dcTier: DCTier
  /** Any detected difficulty modifiers. */
  difficultyHints: string[]
}

/** Situational modifier from caller (e.g., environmental bonus/penalty). */
export interface SituationalModifier {
  value: number
  reason: string
}

// ─── Classifier ───────────────────────────────────────────────────────────────

/**
 * Classify a player's free-text input into an ActionCategory.
 *
 * Algorithm:
 *   1. Normalise input to lowercase
 *   2. Score each category by counting keyword matches
 *   3. Return the highest-scoring category (ties resolved by CATEGORY_KEYWORDS order)
 *   4. Fall back to UNKNOWN if no keywords match
 */
export function classifyAction(input: string): ActionCategory {
  const lower = input.toLowerCase()

  let bestCategory: ActionCategory = 'UNKNOWN'
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<ActionCategory, 'UNKNOWN'>, string[]]
  >) {
    const score = keywords.filter((kw) => lower.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

/**
 * Detect difficulty hint words in the player's input.
 * Returns matched hint strings for Director context.
 */
function detectDifficultyHints(lower: string): { hints: string[]; bump: number } {
  const hints: string[] = []
  let bump = 0

  for (const hint of DIFFICULTY_BUMP_UP) {
    if (lower.includes(hint)) {
      hints.push(hint)
      bump += 1
    }
  }
  for (const hint of DIFFICULTY_BUMP_DOWN) {
    if (lower.includes(hint)) {
      hints.push(hint)
      bump -= 1
    }
  }

  return { hints, bump }
}

/**
 * Resolve DC tier from a base tier + a bump delta.
 * Clamps within the defined DC ladder.
 */
const DC_TIER_ORDER: DCTier[] = ['TRIVIAL', 'EASY', 'MEDIUM', 'HARD', 'LEGENDARY']

function bumpDcTier(base: DCTier, bump: number): DCTier {
  const idx = DC_TIER_ORDER.indexOf(base)
  const newIdx = Math.max(0, Math.min(DC_TIER_ORDER.length - 1, idx + bump))
  return DC_TIER_ORDER[newIdx]
}

// ─── Intent Builder ───────────────────────────────────────────────────────────

/**
 * Parse a player's raw action string into a structured ActionIntent.
 *
 * This is the entry point for Phase 1's text → engine pipeline.
 * In Phase 2, the Director AI will enrich this with world context.
 *
 * @param rawInput - The player's action text (1–500 chars)
 * @throws {Error} if input is empty or exceeds 500 characters
 */
export function parseAction(rawInput: string): ActionIntent {
  const trimmed = rawInput.trim()

  if (trimmed.length === 0) {
    throw new Error('[intent] Action input cannot be empty.')
  }
  if (trimmed.length > 500) {
    throw new Error(
      `[intent] Action input exceeds 500 character limit (got ${trimmed.length}).`,
    )
  }

  const normalised = trimmed.toLowerCase()
  const category = classifyAction(normalised)
  const stat = CATEGORY_STAT[category]
  const baseTier = CATEGORY_DEFAULT_DC[category]
  const { hints, bump } = detectDifficultyHints(normalised)
  const dcTier = bumpDcTier(baseTier, bump)
  const suggestedDc = DC[dcTier]

  return {
    rawInput: trimmed,
    normalised,
    category,
    stat,
    suggestedDc,
    dcTier,
    difficultyHints: hints,
  }
}

// ─── Stat Utilities ───────────────────────────────────────────────────────────

/**
 * Compute the ability score modifier from a raw stat value.
 * Formula from the Chronicle Constitution: floor((stat - 10) / 2)
 *
 * @example statModifier(14) === 2
 * @example statModifier(8)  === -1
 * @example statModifier(10) === 0
 */
export function statModifier(statValue: number): number {
  return Math.floor((statValue - 10) / 2)
}

/**
 * Validate that a stat value is within the legal range (1–30).
 * Chronicle uses the standard D&D-adjacent range.
 */
export function isValidStat(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 30
}
