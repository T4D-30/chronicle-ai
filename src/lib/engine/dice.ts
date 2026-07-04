/**
 * Chronicle AI — Dice Engine
 * Phase 1.1
 *
 * All randomness in the game flows through this module.
 * Rolls are deterministic when a seed is provided (for testing and replays).
 * The AI never touches this layer — rolls happen before narration.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100

export type DieNotation = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/** Result of a single die face — the raw number before modifiers. */
export interface SingleRoll {
  die: DieNotation
  /** The face value rolled (1–die size). */
  face: number
  /** True when this roll was kept in an adv/dis pair. */
  kept: boolean
}

/** Full result of a dice expression, e.g. 2d6+3 or 1d20 with advantage. */
export interface RollResult {
  /** Notation string as parsed or constructed, e.g. "2d6+3". */
  notation: string
  /** Each individual die rolled (may be 2 for adv/dis). */
  rolls: SingleRoll[]
  /** Sum of kept faces. */
  faceTotal: number
  /** Flat modifier applied after summing faces. */
  modifier: number
  /** faceTotal + modifier. */
  total: number
  /** Roll mode used. Only meaningful for d20 rolls. */
  mode: RollMode
  /** True if faceTotal is the die's max value on a single kept d20 roll. */
  isNatural20: boolean
  /** True if faceTotal is 1 on a single kept d20 roll. */
  isNatural1: boolean
  /** ISO timestamp of when this roll was generated. */
  timestamp: string
}

/** Parsed representation of a notation string like "2d6+3". */
export interface ParsedNotation {
  count: number
  die: DieNotation
  modifier: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DIE_SIZES: Record<DieNotation, DieSize> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
}

export const ALL_DICE: DieNotation[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

/** DC thresholds per the Chronicle Constitution. */
export const DC = {
  TRIVIAL: 5,
  EASY: 10,
  MEDIUM: 15,
  HARD: 20,
  LEGENDARY: 25,
} as const

export type DCTier = keyof typeof DC

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns a closure that generates numbers in [0, 1).
 * Used so test suites can produce deterministic roll sequences.
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/** Module-level RNG. Replaced in tests via `setRng()`. */
let _rng: () => number = Math.random

/**
 * Override the RNG — use in tests for deterministic rolls.
 * Returns the previous RNG so tests can restore it.
 */
export function setRng(rng: () => number): () => number {
  const prev = _rng
  _rng = rng
  return prev
}

/** Reset to crypto-random. */
export function resetRng(): void {
  _rng = Math.random
}

// ─── Core Roll Function ───────────────────────────────────────────────────────

/**
 * Roll a single die face using the current RNG.
 * Result is in [1, size].
 */
function rollFace(size: DieSize): number {
  return Math.floor(_rng() * size) + 1
}

// ─── Notation Parser ──────────────────────────────────────────────────────────

const NOTATION_REGEX = /^(\d+)?d(4|6|8|10|12|20|100)([+-]\d+)?$/i

/**
 * Parse a dice notation string into its components.
 *
 * Valid formats:
 *   "d20"         → { count: 1, die: 'd20', modifier: 0 }
 *   "2d6"         → { count: 2, die: 'd6',  modifier: 0 }
 *   "1d8+3"       → { count: 1, die: 'd8',  modifier: 3 }
 *   "3d6-2"       → { count: 3, die: 'd6',  modifier: -2 }
 *
 * @throws {Error} if the notation is not a valid dice expression.
 */
export function parseNotation(notation: string): ParsedNotation {
  const trimmed = notation.trim().toLowerCase()
  const match = NOTATION_REGEX.exec(trimmed)

  if (!match) {
    throw new Error(
      `[dice] Invalid notation: "${notation}". ` +
        'Expected format: [count]d<size>[+/-modifier], e.g. "2d6+3" or "d20".',
    )
  }

  const count = match[1] !== undefined ? parseInt(match[1], 10) : 1
  const die = `d${match[2]}` as DieNotation
  const modifier = match[3] !== undefined ? parseInt(match[3], 10) : 0

  if (count < 1) {
    throw new Error(`[dice] Die count must be ≥ 1, got ${count}.`)
  }
  if (count > 100) {
    throw new Error(`[dice] Die count must be ≤ 100, got ${count}.`)
  }

  return { count, die, modifier }
}

/**
 * Serialise a ParsedNotation back to a canonical string.
 * Useful for display and logging.
 */
export function formatNotation(parsed: ParsedNotation): string {
  const countStr = parsed.count === 1 ? '' : String(parsed.count)
  const modStr =
    parsed.modifier === 0
      ? ''
      : parsed.modifier > 0
        ? `+${parsed.modifier}`
        : String(parsed.modifier)
  return `${countStr}${parsed.die}${modStr}`
}

// ─── Roll Functions ───────────────────────────────────────────────────────────

/**
 * Roll a single die directly.
 *
 * @param die       - e.g. 'd20'
 * @param modifier  - flat bonus/penalty applied after rolling
 * @param mode      - 'normal' | 'advantage' | 'disadvantage' (d20 only)
 *
 * Advantage/disadvantage:
 *   Rolls the die twice; keeps the higher (adv) or lower (dis) face.
 *   Ignored silently for non-d20 dice — only d20 checks use adv/dis in Chronicle.
 */
export function rollDie(die: DieNotation, modifier = 0, mode: RollMode = 'normal'): RollResult {
  const size = DIE_SIZES[die]
  const notation = formatNotation({ count: 1, die, modifier })
  const timestamp = new Date().toISOString()

  if (mode !== 'normal' && die === 'd20') {
    const faceA = rollFace(size)
    const faceB = rollFace(size)
    const keptFace = mode === 'advantage' ? Math.max(faceA, faceB) : Math.min(faceA, faceB)
    const droppedFace = mode === 'advantage' ? Math.min(faceA, faceB) : Math.max(faceA, faceB)

    const rolls: SingleRoll[] = [
      { die, face: keptFace, kept: true },
      { die, face: droppedFace, kept: false },
    ]

    return {
      notation,
      rolls,
      faceTotal: keptFace,
      modifier,
      total: keptFace + modifier,
      mode,
      isNatural20: keptFace === 20,
      isNatural1: keptFace === 1,
      timestamp,
    }
  }

  const face = rollFace(size)
  return {
    notation,
    rolls: [{ die, face, kept: true }],
    faceTotal: face,
    modifier,
    total: face + modifier,
    mode: 'normal',
    isNatural20: die === 'd20' && face === 20,
    isNatural1: die === 'd20' && face === 1,
    timestamp,
  }
}

/**
 * Roll multiple dice from a notation string, e.g. "2d6+3".
 *
 * Each die is rolled individually; all face results are summed,
 * then the flat modifier is applied once.
 *
 * Advantage/disadvantage is NOT supported on multi-die rolls
 * (it's only meaningful for single d20 checks).
 */
export function rollNotation(notation: string): RollResult {
  const parsed = parseNotation(notation)
  const size = DIE_SIZES[parsed.die]
  const timestamp = new Date().toISOString()

  const rolls: SingleRoll[] = Array.from({ length: parsed.count }, () => ({
    die: parsed.die,
    face: rollFace(size),
    kept: true,
  }))

  const faceTotal = rolls.reduce((sum, r) => sum + r.face, 0)
  const total = faceTotal + parsed.modifier

  return {
    notation: formatNotation(parsed),
    rolls,
    faceTotal,
    modifier: parsed.modifier,
    total,
    mode: 'normal',
    isNatural20: parsed.count === 1 && parsed.die === 'd20' && faceTotal === 20,
    isNatural1: parsed.count === 1 && parsed.die === 'd20' && faceTotal === 1,
    timestamp,
  }
}

/**
 * Roll a d20 skill check — the primary resolution roll in Chronicle AI.
 *
 * @param modifier  - character stat modifier + situational bonuses
 * @param mode      - normal | advantage | disadvantage
 */
export function rollD20(modifier = 0, mode: RollMode = 'normal'): RollResult {
  return rollDie('d20', modifier, mode)
}

/**
 * Roll a pool of identical dice and return each result.
 * Useful for damage rolls, healing, etc.
 *
 * @example rollPool('d6', 3) // three separate d6 rolls
 */
export function rollPool(die: DieNotation, count: number): RollResult[] {
  if (count < 1) throw new Error(`[dice] Pool count must be ≥ 1, got ${count}.`)
  if (count > 100) throw new Error(`[dice] Pool count must be ≤ 100, got ${count}.`)
  return Array.from({ length: count }, () => rollDie(die))
}
