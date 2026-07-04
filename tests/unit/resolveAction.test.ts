import { describe, it, expect, afterEach } from 'vitest'
import {
  resolveAction,
  resolveCheck,
  summariseResolution,
} from '@/lib/engine/resolveAction'
import { Outcome } from '@/lib/engine/outcome'
import { setRng, resetRng } from '@/lib/engine/dice'

afterEach(() => resetRng())

// ─── resolveAction — basic pipeline ──────────────────────────────────────────

describe('resolveAction — basic pipeline', () => {
  it('returns a ResolutionResult with all expected fields', () => {
    const result = resolveAction('I try to pick the lock')
    expect(result).toHaveProperty('intent')
    expect(result).toHaveProperty('statUsed')
    expect(result).toHaveProperty('dc')
    expect(result).toHaveProperty('totalModifier')
    expect(result).toHaveProperty('modifierBreakdown')
    expect(result).toHaveProperty('check')
  })

  it('intent is the parsed action', () => {
    const result = resolveAction('sneak past the guard')
    expect(result.intent.category).toBe('FINESSE')
    expect(result.intent.stat).toBe('DEX')
  })

  it('uses intent suggestedDc when no dc config provided', () => {
    const result = resolveAction('sneak past the guard')
    expect(result.dc).toBe(result.intent.suggestedDc)
  })

  it('uses config.dc when provided', () => {
    const result = resolveAction('smash the door', { dc: 20 })
    expect(result.dc).toBe(20)
  })
})

// ─── resolveAction — modifier accumulation ───────────────────────────────────

describe('resolveAction — modifier accumulation', () => {
  it('zero modifier when no config provided', () => {
    const result = resolveAction('look around the room')
    expect(result.totalModifier).toBe(0)
    expect(result.modifierBreakdown).toHaveLength(0)
  })

  it('computes stat modifier from statValue', () => {
    // DEX 14 → modifier +2
    const result = resolveAction('sneak past the guard', { statValue: 14 })
    expect(result.totalModifier).toBe(2)
    expect(result.modifierBreakdown).toContainEqual({ source: 'DEX', value: 2 })
  })

  it('applies flat modifier directly', () => {
    const result = resolveAction('pick the lock', { flatModifier: 3 })
    expect(result.totalModifier).toBe(3)
    expect(result.modifierBreakdown).toContainEqual({ source: 'bonus', value: 3 })
  })

  it('stacks statValue modifier + flatModifier', () => {
    // STR 16 → +3, plus flat +2 = +5
    const result = resolveAction('smash the door', { statValue: 16, flatModifier: 2 })
    expect(result.totalModifier).toBe(5)
    expect(result.modifierBreakdown).toHaveLength(2)
  })

  it('adds situational modifiers to breakdown', () => {
    const result = resolveAction('pick the lock', {
      situationalModifiers: [
        { value: 2, reason: "thieves' tools" },
        { value: -1, reason: 'darkness penalty' },
      ],
    })
    expect(result.totalModifier).toBe(1)
    expect(result.modifierBreakdown).toContainEqual({ source: "thieves' tools", value: 2 })
    expect(result.modifierBreakdown).toContainEqual({ source: 'darkness penalty', value: -1 })
  })

  it('stacks all modifier sources together', () => {
    // DEX 14 (+2) + flat +1 + situational +2 = +5
    const result = resolveAction('sneak past the guard', {
      statValue: 14,
      flatModifier: 1,
      situationalModifiers: [{ value: 2, reason: 'shadow blessing' }],
    })
    expect(result.totalModifier).toBe(5)
    expect(result.modifierBreakdown).toHaveLength(3)
  })

  it('zero-value situational modifiers are excluded from breakdown', () => {
    const result = resolveAction('pick the lock', {
      situationalModifiers: [{ value: 0, reason: 'neutral' }],
    })
    expect(result.modifierBreakdown).toHaveLength(0)
  })
})

// ─── resolveAction — stat override ───────────────────────────────────────────

describe('resolveAction — statOverride', () => {
  it('overrides the stat from intent', () => {
    // FINESSE would be DEX, but we override to WIS
    const result = resolveAction('sneak past the guard', { statOverride: 'WIS' })
    expect(result.statUsed).toBe('WIS')
    // The breakdown should label the modifier with 'WIS' not 'DEX'
    if (result.modifierBreakdown.length > 0) {
      expect(result.modifierBreakdown[0].source).toBe('WIS')
    }
  })

  it('uses stat override label in modifier breakdown', () => {
    const result = resolveAction('smash the door', {
      statValue: 14,
      statOverride: 'INT',
    })
    expect(result.statUsed).toBe('INT')
    expect(result.modifierBreakdown[0].source).toBe('INT')
  })
})

// ─── resolveAction — roll mode ────────────────────────────────────────────────

describe('resolveAction — roll mode', () => {
  it('passes advantage mode to the dice roll', () => {
    const result = resolveAction('sneak past the guard', { mode: 'advantage' })
    expect(result.check.roll.mode).toBe('advantage')
  })

  it('passes disadvantage mode to the dice roll', () => {
    const result = resolveAction('sneak past the guard', { mode: 'disadvantage' })
    expect(result.check.roll.mode).toBe('disadvantage')
  })

  it('defaults to normal mode', () => {
    const result = resolveAction('look around')
    expect(result.check.roll.mode).toBe('normal')
  })
})

// ─── resolveAction — outcome integrity ───────────────────────────────────────

describe('resolveAction — outcome integrity', () => {
  it('nat20 always produces CRITICAL_SUCCESS even vs high DC', () => {
    setRng(() => 0.999) // face 20
    const result = resolveAction('attempt the impossible feat', { dc: 30 })
    expect(result.check.outcome).toBe(Outcome.CRITICAL_SUCCESS)
    expect(result.check.roll.isNatural20).toBe(true)
  })

  it('nat1 always produces COMPLICATION even with large bonuses', () => {
    setRng(() => 0) // face 1
    const result = resolveAction('do the simple thing', {
      dc: 5,
      flatModifier: 15,
    })
    expect(result.check.outcome).toBe(Outcome.COMPLICATION)
    expect(result.check.roll.isNatural1).toBe(true)
  })

  it('check.dc matches the resolved dc on the result', () => {
    const result = resolveAction('smash the door', { dc: 18 })
    expect(result.check.dc).toBe(18)
    expect(result.dc).toBe(18)
  })
})

// ─── resolveAction — validation passthrough ───────────────────────────────────

describe('resolveAction — validation', () => {
  it('propagates empty input error from parseAction', () => {
    expect(() => resolveAction('')).toThrow('[intent] Action input cannot be empty')
  })

  it('propagates oversized input error from parseAction', () => {
    expect(() => resolveAction('a'.repeat(501))).toThrow(
      '[intent] Action input exceeds 500 character limit',
    )
  })

  it('throws on DC < 1 in config', () => {
    expect(() => resolveAction('do something', { dc: 0 })).toThrow()
  })
})

// ─── resolveCheck — convenience helper ───────────────────────────────────────

describe('resolveCheck', () => {
  it('runs a raw check with explicit dc and modifier', () => {
    setRng(() => 0.75) // face 16
    const check = resolveCheck(15, 2) // total 18 vs DC 15
    expect(check.dc).toBe(15)
    expect(check.roll.total).toBe(18)
    expect(check.outcome).toBe(Outcome.FULL_SUCCESS)
  })

  it('supports advantage', () => {
    const check = resolveCheck(15, 0, 'advantage')
    expect(check.roll.mode).toBe('advantage')
  })

  it('throws on dc < 1', () => {
    expect(() => resolveCheck(0)).toThrow('[resolver] DC must be ≥ 1')
  })

  it('defaults modifier to 0', () => {
    const check = resolveCheck(15)
    expect(check.roll.modifier).toBe(0)
  })
})

// ─── summariseResolution ──────────────────────────────────────────────────────

describe('summariseResolution', () => {
  it('produces a serialisable summary object', () => {
    const result = resolveAction('pick the lock', { dc: 15, statValue: 14 })
    const summary = summariseResolution(result)

    expect(summary.rawInput).toBe('pick the lock')
    expect(summary.dc).toBe(15)
    expect(summary.stat).toBe('DEX')
    expect(typeof summary.outcome).toBe('string')
    expect(typeof summary.outcomeLabel).toBe('string')
    expect(typeof summary.isSuccess).toBe('boolean')
    expect(typeof summary.timestamp).toBe('string')
  })

  it('roll faces is an array of numbers', () => {
    const result = resolveAction('smash the door')
    const summary = summariseResolution(result)
    expect(Array.isArray(summary.roll.faces)).toBe(true)
    summary.roll.faces.forEach((f) => expect(typeof f).toBe('number'))
  })

  it('margin is total - dc', () => {
    setRng(() => 0.74) // face 16
    const result = resolveAction('smash the door', { dc: 15, flatModifier: 2 })
    const summary = summariseResolution(result)
    // total = 16 + 2 = 18; dc = 15; margin = 3
    expect(summary.margin).toBe(summary.roll.total - summary.dc)
  })

  it('summary is JSON-serialisable (no circular refs)', () => {
    const result = resolveAction('investigate the scene')
    const summary = summariseResolution(result)
    expect(() => JSON.stringify(summary)).not.toThrow()
  })
})

// ─── Full pipeline smoke test ─────────────────────────────────────────────────

describe('full pipeline integration', () => {
  it('lock-picking scenario: success with moderate DEX', () => {
    setRng(() => 0.70) // face 15
    const result = resolveAction('I carefully try to pick the lock on the vault door', {
      dc: 15,
      statValue: 14, // DEX 14 → +2 mod
    })
    // total = 15 + 2 = 17 vs DC 15 → margin 2 → FULL_SUCCESS
    expect(result.check.roll.total).toBe(17)
    expect(result.check.outcome).toBe(Outcome.FULL_SUCCESS)
    expect(result.check.meta.isSuccess).toBe(true)
  })

  it('persuasion scenario: failure with low CHA', () => {
    setRng(() => 0.2) // face 5
    const result = resolveAction('convince the king to spare the prisoners', {
      dc: 18,
      statValue: 8, // CHA 8 → -1 mod
    })
    // total = 5 + (-1) = 4 vs DC 18 → margin -14 → COMPLICATION
    expect(result.check.roll.total).toBe(4)
    expect(result.check.outcome).toBe(Outcome.COMPLICATION)
    expect(result.check.meta.isSuccess).toBe(false)
    expect(result.check.meta.hasCost).toBe(true)
  })

  it('stealth scenario with advantage: SUCCESS_WITH_COST on borderline roll', () => {
    // advantage: take higher of 0.59 (12) and 0.59 (12) = 12
    setRng(() => 0.59)
    const result = resolveAction('sneak past the guard', {
      dc: 15,
      statValue: 12, // DEX 12 → +1
      mode: 'advantage',
    })
    // total = 12 + 1 = 13 vs DC 15 → margin -2 → SUCCESS_WITH_COST
    expect(result.check.outcome).toBe(Outcome.SUCCESS_WITH_COST)
    expect(result.check.meta.hasCost).toBe(true)
  })
})
