import { describe, it, expect, afterEach } from 'vitest'
import { Outcome, OUTCOME_META, evaluateRoll, evaluateTotal } from '@/lib/engine/outcome'
import { rollD20, rollDie, setRng, resetRng } from '@/lib/engine/dice'

afterEach(() => resetRng())

// ─── OUTCOME_META ─────────────────────────────────────────────────────────────

describe('OUTCOME_META', () => {
  it('CRITICAL_SUCCESS is success, critical, no cost', () => {
    const m = OUTCOME_META[Outcome.CRITICAL_SUCCESS]
    expect(m.isSuccess).toBe(true)
    expect(m.isCritical).toBe(true)
    expect(m.hasCost).toBe(false)
  })

  it('FULL_SUCCESS is success, not critical, no cost', () => {
    const m = OUTCOME_META[Outcome.FULL_SUCCESS]
    expect(m.isSuccess).toBe(true)
    expect(m.isCritical).toBe(false)
    expect(m.hasCost).toBe(false)
  })

  it('SUCCESS_WITH_COST is success, not critical, has cost', () => {
    const m = OUTCOME_META[Outcome.SUCCESS_WITH_COST]
    expect(m.isSuccess).toBe(true)
    expect(m.isCritical).toBe(false)
    expect(m.hasCost).toBe(true)
  })

  it('FAILURE_WITH_OPPORTUNITY is not success, not critical, no cost', () => {
    const m = OUTCOME_META[Outcome.FAILURE_WITH_OPPORTUNITY]
    expect(m.isSuccess).toBe(false)
    expect(m.isCritical).toBe(false)
    expect(m.hasCost).toBe(false)
  })

  it('COMPLICATION is not success, critical, has cost', () => {
    const m = OUTCOME_META[Outcome.COMPLICATION]
    expect(m.isSuccess).toBe(false)
    expect(m.isCritical).toBe(true)
    expect(m.hasCost).toBe(true)
  })

  it('all five outcomes have labels', () => {
    for (const outcome of Object.values(Outcome)) {
      expect(OUTCOME_META[outcome].label.length).toBeGreaterThan(0)
    }
  })
})

// ─── evaluateTotal — margin thresholds ────────────────────────────────────────

describe('evaluateTotal — margin thresholds', () => {
  // DC 15 for all margin tests

  it('margin ≥ 10 → CRITICAL_SUCCESS (total 25, DC 15)', () => {
    const r = evaluateTotal(25, 15)
    expect(r.outcome).toBe(Outcome.CRITICAL_SUCCESS)
    expect(r.margin).toBe(10)
  })

  it('margin exactly 10 → CRITICAL_SUCCESS', () => {
    expect(evaluateTotal(25, 15).outcome).toBe(Outcome.CRITICAL_SUCCESS)
  })

  it('margin 9 → FULL_SUCCESS (not critical)', () => {
    expect(evaluateTotal(24, 15).outcome).toBe(Outcome.FULL_SUCCESS)
  })

  it('margin 0 → FULL_SUCCESS (met DC exactly)', () => {
    expect(evaluateTotal(15, 15).outcome).toBe(Outcome.FULL_SUCCESS)
  })

  it('margin -1 → SUCCESS_WITH_COST', () => {
    expect(evaluateTotal(14, 15).outcome).toBe(Outcome.SUCCESS_WITH_COST)
  })

  it('margin -4 → SUCCESS_WITH_COST (boundary)', () => {
    expect(evaluateTotal(11, 15).outcome).toBe(Outcome.SUCCESS_WITH_COST)
  })

  it('margin -5 → FAILURE_WITH_OPPORTUNITY', () => {
    expect(evaluateTotal(10, 15).outcome).toBe(Outcome.FAILURE_WITH_OPPORTUNITY)
  })

  it('margin -9 → FAILURE_WITH_OPPORTUNITY (boundary)', () => {
    expect(evaluateTotal(6, 15).outcome).toBe(Outcome.FAILURE_WITH_OPPORTUNITY)
  })

  it('margin -10 → COMPLICATION', () => {
    expect(evaluateTotal(5, 15).outcome).toBe(Outcome.COMPLICATION)
  })

  it('margin < -10 → COMPLICATION (very bad roll)', () => {
    expect(evaluateTotal(1, 15).outcome).toBe(Outcome.COMPLICATION)
  })
})

// ─── evaluateTotal — natural criticals ────────────────────────────────────────

describe('evaluateTotal — natural critical overrides', () => {
  it('nat20=true always → CRITICAL_SUCCESS regardless of total vs DC', () => {
    // Even if total + DC would produce a lower margin tier
    expect(evaluateTotal(20, 25, true, false).outcome).toBe(Outcome.CRITICAL_SUCCESS)
  })

  it('nat1=true always → COMPLICATION regardless of total vs DC', () => {
    // Even if high modifiers push total over DC
    expect(evaluateTotal(15, 10, false, true).outcome).toBe(Outcome.COMPLICATION)
  })

  it('nat1 overrides even a passing total with large bonus', () => {
    // +20 modifier on a nat1 — still a Complication
    expect(evaluateTotal(21, 10, false, true).outcome).toBe(Outcome.COMPLICATION)
  })

  it('nat20 overrides even a legendary DC miss', () => {
    expect(evaluateTotal(20, 30, true, false).outcome).toBe(Outcome.CRITICAL_SUCCESS)
  })
})

// ─── evaluateTotal — meta shape ───────────────────────────────────────────────

describe('evaluateTotal — result shape', () => {
  it('returns correct margin', () => {
    const r = evaluateTotal(18, 15)
    expect(r.margin).toBe(3)
  })

  it('returns negative margin on miss', () => {
    const r = evaluateTotal(10, 15)
    expect(r.margin).toBe(-5)
  })

  it('meta isSuccess matches outcome', () => {
    const success = evaluateTotal(20, 15)
    expect(success.meta.isSuccess).toBe(true)

    const fail = evaluateTotal(5, 15)
    expect(fail.meta.isSuccess).toBe(false)
  })

  it('throws on DC < 1', () => {
    expect(() => evaluateTotal(10, 0)).toThrow('[outcome] DC must be ≥ 1')
  })
})

// ─── evaluateRoll — integration with dice ────────────────────────────────────

describe('evaluateRoll', () => {
  it('correctly evaluates a passing d20 roll', () => {
    setRng(() => 0.74) // floor(0.74*20)+1 = 15+1 = 16
    const roll = rollD20(2) // total 18
    const check = evaluateRoll(roll, 15) // DC 15 → margin 3 → FULL_SUCCESS
    expect(check.outcome).toBe(Outcome.FULL_SUCCESS)
    expect(check.dc).toBe(15)
    expect(check.roll).toBe(roll)
  })

  it('correctly evaluates a natural 20', () => {
    setRng(() => 0.999) // face 20
    const roll = rollD20()
    const check = evaluateRoll(roll, 25) // Would miss DC 25 on margin, but nat20 wins
    expect(check.outcome).toBe(Outcome.CRITICAL_SUCCESS)
    expect(check.meta.isCritical).toBe(true)
  })

  it('correctly evaluates a natural 1', () => {
    setRng(() => 0) // face 1
    const roll = rollD20(10) // +10 mod → total 11
    const check = evaluateRoll(roll, 5) // Would pass DC 5, but nat1 overrides
    expect(check.outcome).toBe(Outcome.COMPLICATION)
  })

  it('throws if roll has no d20', () => {
    const d6roll = rollDie('d6')
    expect(() => evaluateRoll(d6roll, 10)).toThrow('[outcome] evaluateRoll() requires a d20 roll')
  })

  it('throws on DC < 1', () => {
    const roll = rollD20()
    expect(() => evaluateRoll(roll, 0)).toThrow('[outcome] DC must be ≥ 1')
  })
})

// ─── All five outcomes reachable ──────────────────────────────────────────────

describe('all five outcomes are reachable via evaluateTotal', () => {
  it('CRITICAL_SUCCESS', () => {
    expect(evaluateTotal(25, 15).outcome).toBe(Outcome.CRITICAL_SUCCESS)
  })

  it('FULL_SUCCESS', () => {
    expect(evaluateTotal(19, 15).outcome).toBe(Outcome.FULL_SUCCESS)
  })

  it('SUCCESS_WITH_COST', () => {
    expect(evaluateTotal(13, 15).outcome).toBe(Outcome.SUCCESS_WITH_COST)
  })

  it('FAILURE_WITH_OPPORTUNITY', () => {
    expect(evaluateTotal(8, 15).outcome).toBe(Outcome.FAILURE_WITH_OPPORTUNITY)
  })

  it('COMPLICATION', () => {
    expect(evaluateTotal(3, 15).outcome).toBe(Outcome.COMPLICATION)
  })
})
