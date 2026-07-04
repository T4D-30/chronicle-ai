import { describe, it, expect, afterEach } from 'vitest'
import {
  parseNotation,
  formatNotation,
  rollDie,
  rollNotation,
  rollD20,
  rollPool,
  setRng,
  resetRng,
  createSeededRng,
  DC,
  DIE_SIZES,
  ALL_DICE,
} from '@/lib/engine/dice'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Set a deterministic sequence of "random" values. */
function mockRng(...values: number[]) {
  let i = 0
  return setRng(() => values[i++ % values.length])
}

// ─── DC Constants ─────────────────────────────────────────────────────────────

describe('DC constants', () => {
  it('has correct ladder values', () => {
    expect(DC.TRIVIAL).toBe(5)
    expect(DC.EASY).toBe(10)
    expect(DC.MEDIUM).toBe(15)
    expect(DC.HARD).toBe(20)
    expect(DC.LEGENDARY).toBe(25)
  })
})

// ─── DIE_SIZES ────────────────────────────────────────────────────────────────

describe('DIE_SIZES', () => {
  it('maps all die notations to their face counts', () => {
    expect(DIE_SIZES['d4']).toBe(4)
    expect(DIE_SIZES['d6']).toBe(6)
    expect(DIE_SIZES['d8']).toBe(8)
    expect(DIE_SIZES['d10']).toBe(10)
    expect(DIE_SIZES['d12']).toBe(12)
    expect(DIE_SIZES['d20']).toBe(20)
    expect(DIE_SIZES['d100']).toBe(100)
  })

  it('ALL_DICE contains all 7 die types', () => {
    expect(ALL_DICE).toHaveLength(7)
  })
})

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

describe('createSeededRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = createSeededRng(42)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('same seed produces same sequence', () => {
    const a = createSeededRng(999)
    const b = createSeededRng(999)
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b())
    }
  })

  it('different seeds produce different sequences', () => {
    const a = createSeededRng(1)
    const b = createSeededRng(2)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })
})

// ─── setRng / resetRng ────────────────────────────────────────────────────────

describe('setRng / resetRng', () => {
  afterEach(() => resetRng())

  it('setRng overrides the RNG and returns the previous one', () => {
    const prev = setRng(() => 0.5)
    expect(typeof prev).toBe('function')
  })

  it('resetRng restores non-deterministic behaviour', () => {
    setRng(() => 0.1)
    resetRng()
    // After reset, rolling 100 dice should produce variance (not all the same)
    const results = Array.from({ length: 20 }, () => rollDie('d6').faceTotal)
    const unique = new Set(results)
    // Very unlikely to be all the same with true RNG
    expect(unique.size).toBeGreaterThan(1)
  })
})

// ─── parseNotation ────────────────────────────────────────────────────────────

describe('parseNotation', () => {
  it('parses bare die notation: d20', () => {
    expect(parseNotation('d20')).toEqual({ count: 1, die: 'd20', modifier: 0 })
  })

  it('parses with count: 2d6', () => {
    expect(parseNotation('2d6')).toEqual({ count: 2, die: 'd6', modifier: 0 })
  })

  it('parses with positive modifier: 1d8+3', () => {
    expect(parseNotation('1d8+3')).toEqual({ count: 1, die: 'd8', modifier: 3 })
  })

  it('parses with negative modifier: 3d6-2', () => {
    expect(parseNotation('3d6-2')).toEqual({ count: 3, die: 'd6', modifier: -2 })
  })

  it('parses d100', () => {
    expect(parseNotation('d100')).toEqual({ count: 1, die: 'd100', modifier: 0 })
  })

  it('is case-insensitive: D20', () => {
    expect(parseNotation('D20')).toEqual({ count: 1, die: 'd20', modifier: 0 })
  })

  it('trims whitespace', () => {
    expect(parseNotation('  2d6+1  ')).toEqual({ count: 2, die: 'd6', modifier: 1 })
  })

  it('throws on invalid die size: d7', () => {
    expect(() => parseNotation('d7')).toThrow('[dice] Invalid notation')
  })

  it('throws on non-numeric input', () => {
    expect(() => parseNotation('roll a die')).toThrow('[dice] Invalid notation')
  })

  it('throws on empty string', () => {
    expect(() => parseNotation('')).toThrow('[dice] Invalid notation')
  })

  it('throws if count > 100', () => {
    expect(() => parseNotation('101d6')).toThrow('[dice] Die count must be ≤ 100')
  })
})

// ─── formatNotation ───────────────────────────────────────────────────────────

describe('formatNotation', () => {
  it('formats count=1 without count prefix', () => {
    expect(formatNotation({ count: 1, die: 'd20', modifier: 0 })).toBe('d20')
  })

  it('formats count > 1 with prefix', () => {
    expect(formatNotation({ count: 2, die: 'd6', modifier: 0 })).toBe('2d6')
  })

  it('formats positive modifier with + sign', () => {
    expect(formatNotation({ count: 1, die: 'd8', modifier: 3 })).toBe('d8+3')
  })

  it('formats negative modifier without + sign', () => {
    expect(formatNotation({ count: 3, die: 'd6', modifier: -2 })).toBe('3d6-2')
  })

  it('omits modifier when 0', () => {
    expect(formatNotation({ count: 1, die: 'd12', modifier: 0 })).toBe('d12')
  })
})

// ─── rollDie ──────────────────────────────────────────────────────────────────

describe('rollDie', () => {
  afterEach(() => resetRng())

  it('face is within [1, die size]', () => {
    for (const die of ALL_DICE) {
      const result = rollDie(die)
      expect(result.faceTotal).toBeGreaterThanOrEqual(1)
      expect(result.faceTotal).toBeLessThanOrEqual(DIE_SIZES[die])
    }
  })

  it('total = faceTotal + modifier', () => {
    mockRng(0.5) // d6: floor(0.5 * 6) + 1 = 4
    const result = rollDie('d6', 3)
    expect(result.faceTotal).toBe(4)
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(7)
  })

  it('negative modifier reduces total', () => {
    mockRng(0.99) // d6: floor(0.99 * 6) + 1 = 6
    const result = rollDie('d6', -2)
    expect(result.total).toBe(4)
  })

  it('sets isNatural20 when d20 face is 20', () => {
    mockRng(0.999) // d20: floor(0.999 * 20) + 1 = 20
    const result = rollDie('d20')
    expect(result.faceTotal).toBe(20)
    expect(result.isNatural20).toBe(true)
    expect(result.isNatural1).toBe(false)
  })

  it('sets isNatural1 when d20 face is 1', () => {
    mockRng(0) // d20: floor(0 * 20) + 1 = 1
    const result = rollDie('d20')
    expect(result.faceTotal).toBe(1)
    expect(result.isNatural1).toBe(true)
    expect(result.isNatural20).toBe(false)
  })

  it('isNatural20 is false for non-d20 dice even at max', () => {
    mockRng(0.999) // d6 max = 6
    const result = rollDie('d6')
    expect(result.isNatural20).toBe(false)
    expect(result.isNatural1).toBe(false)
  })

  it('includes a timestamp', () => {
    const result = rollDie('d20')
    expect(() => new Date(result.timestamp)).not.toThrow()
  })

  it('mode defaults to normal', () => {
    const result = rollDie('d6')
    expect(result.mode).toBe('normal')
  })

  it('single roll has exactly one SingleRoll in rolls[]', () => {
    const result = rollDie('d8')
    expect(result.rolls).toHaveLength(1)
    expect(result.rolls[0].kept).toBe(true)
  })
})

// ─── rollDie — Advantage / Disadvantage ───────────────────────────────────────

describe('rollDie — advantage/disadvantage', () => {
  afterEach(() => resetRng())

  it('advantage keeps the higher of two d20 rolls', () => {
    // Two rng values → face 5 and face 15; advantage keeps 15
    mockRng(0.2, 0.7) // floor(0.2*20)+1=5, floor(0.7*20)+1=15
    const result = rollDie('d20', 0, 'advantage')
    expect(result.faceTotal).toBe(15)
    expect(result.mode).toBe('advantage')
  })

  it('disadvantage keeps the lower of two d20 rolls', () => {
    mockRng(0.2, 0.7) // 5 and 15; disadvantage keeps 5
    const result = rollDie('d20', 0, 'disadvantage')
    expect(result.faceTotal).toBe(5)
    expect(result.mode).toBe('disadvantage')
  })

  it('advantage produces two rolls: one kept, one not', () => {
    mockRng(0.2, 0.7)
    const result = rollDie('d20', 0, 'advantage')
    expect(result.rolls).toHaveLength(2)
    const kept = result.rolls.filter((r) => r.kept)
    const dropped = result.rolls.filter((r) => !r.kept)
    expect(kept).toHaveLength(1)
    expect(dropped).toHaveLength(1)
  })

  it('advantage with equal faces keeps one and drops the other', () => {
    mockRng(0.5, 0.5) // both → face 11
    const result = rollDie('d20', 0, 'advantage')
    expect(result.faceTotal).toBe(11)
  })

  it('nat20 with advantage still isNatural20=true', () => {
    mockRng(0.999, 0.1) // 20 and 3; advantage keeps 20
    const result = rollDie('d20', 0, 'advantage')
    expect(result.isNatural20).toBe(true)
  })

  it('nat1 with disadvantage still isNatural1=true', () => {
    mockRng(0, 0.5) // 1 and 11; disadvantage keeps 1
    const result = rollDie('d20', 0, 'disadvantage')
    expect(result.isNatural1).toBe(true)
  })

  it('advantage/disadvantage is ignored for non-d20 dice (uses normal mode)', () => {
    // d6 with "advantage" should just roll once — mode ignored
    mockRng(0.5)
    const result = rollDie('d6', 0, 'advantage')
    // Single roll, no second roll consumed
    expect(result.rolls).toHaveLength(1)
    expect(result.mode).toBe('normal')
  })
})

// ─── rollNotation ─────────────────────────────────────────────────────────────

describe('rollNotation', () => {
  afterEach(() => resetRng())

  it('rolls single die: d6', () => {
    mockRng(0.5) // face 4
    const result = rollNotation('d6')
    expect(result.faceTotal).toBe(4)
    expect(result.rolls).toHaveLength(1)
  })

  it('sums multiple dice: 2d6', () => {
    mockRng(0.5, 0.8) // face 4, face 5 → sum 9
    const result = rollNotation('2d6')
    expect(result.rolls).toHaveLength(2)
    expect(result.faceTotal).toBe(9)
    expect(result.modifier).toBe(0)
    expect(result.total).toBe(9)
  })

  it('applies modifier after sum: 2d6+3', () => {
    mockRng(0.5, 0.8) // faces: 4, 5 → faceTotal 9 + 3 = 12
    const result = rollNotation('2d6+3')
    expect(result.faceTotal).toBe(9)
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(12)
  })

  it('all rolls in a pool have kept=true', () => {
    const result = rollNotation('3d8')
    expect(result.rolls.every((r) => r.kept)).toBe(true)
  })

  it('notation string is preserved in result', () => {
    const result = rollNotation('2d6+3')
    expect(result.notation).toBe('2d6+3')
  })

  it('throws on invalid notation', () => {
    expect(() => rollNotation('gibberish')).toThrow('[dice] Invalid notation')
  })
})

// ─── rollD20 ──────────────────────────────────────────────────────────────────

describe('rollD20', () => {
  afterEach(() => resetRng())

  it('produces a d20 result', () => {
    const result = rollD20()
    expect(result.rolls[0].die).toBe('d20')
  })

  it('applies modifier', () => {
    mockRng(0.5) // face 11
    const result = rollD20(3)
    expect(result.total).toBe(14)
  })

  it('supports advantage', () => {
    mockRng(0.1, 0.9) // 3 and 19 → advantage picks 19
    const result = rollD20(0, 'advantage')
    expect(result.faceTotal).toBe(19)
  })
})

// ─── rollPool ─────────────────────────────────────────────────────────────────

describe('rollPool', () => {
  it('returns the correct number of results', () => {
    const pool = rollPool('d6', 3)
    expect(pool).toHaveLength(3)
  })

  it('each result is a valid d6 roll', () => {
    const pool = rollPool('d6', 5)
    for (const result of pool) {
      expect(result.faceTotal).toBeGreaterThanOrEqual(1)
      expect(result.faceTotal).toBeLessThanOrEqual(6)
    }
  })

  it('throws if count < 1', () => {
    expect(() => rollPool('d6', 0)).toThrow('[dice] Pool count must be ≥ 1')
  })

  it('throws if count > 100', () => {
    expect(() => rollPool('d6', 101)).toThrow('[dice] Pool count must be ≤ 100')
  })
})

// ─── Statistical smoke tests ──────────────────────────────────────────────────

describe('dice statistical properties', () => {
  it('d20 produces all 20 faces over enough rolls', () => {
    resetRng()
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      seen.add(rollDie('d20').faceTotal)
    }
    // Should have seen all values 1–20 in 1000 rolls (astronomically likely)
    for (let f = 1; f <= 20; f++) {
      expect(seen.has(f)).toBe(true)
    }
  })

  it('advantage skews d20 mean above 10.5', () => {
    resetRng()
    const trials = 500
    const sum = Array.from({ length: trials }, () =>
      rollDie('d20', 0, 'advantage').faceTotal,
    ).reduce((a, b) => a + b, 0)
    expect(sum / trials).toBeGreaterThan(12) // theoretical mean ≈ 13.83
  })

  it('disadvantage skews d20 mean below 10.5', () => {
    resetRng()
    const trials = 500
    const sum = Array.from({ length: trials }, () =>
      rollDie('d20', 0, 'disadvantage').faceTotal,
    ).reduce((a, b) => a + b, 0)
    expect(sum / trials).toBeLessThan(9) // theoretical mean ≈ 7.17
  })
})
