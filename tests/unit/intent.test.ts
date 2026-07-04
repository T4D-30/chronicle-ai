import { describe, it, expect } from 'vitest'
import {
  classifyAction,
  parseAction,
  statModifier,
  isValidStat,
} from '@/lib/engine/intent'

// ─── statModifier ─────────────────────────────────────────────────────────────

describe('statModifier', () => {
  it('10 → 0 (neutral)', () => expect(statModifier(10)).toBe(0))
  it('11 → 0', () => expect(statModifier(11)).toBe(0))
  it('12 → 1', () => expect(statModifier(12)).toBe(1))
  it('14 → 2', () => expect(statModifier(14)).toBe(2))
  it('16 → 3', () => expect(statModifier(16)).toBe(3))
  it('18 → 4', () => expect(statModifier(18)).toBe(4))
  it('20 → 5', () => expect(statModifier(20)).toBe(5))
  it('8 → -1', () => expect(statModifier(8)).toBe(-1))
  it('6 → -2', () => expect(statModifier(6)).toBe(-2))
  it('4 → -3', () => expect(statModifier(4)).toBe(-3))
  it('1 → -5', () => expect(statModifier(1)).toBe(-5))
  it('30 → 10', () => expect(statModifier(30)).toBe(10))

  it('uses floor for odd stats below 10: 9 → -1', () => {
    expect(statModifier(9)).toBe(-1)
  })

  it('uses floor for odd stats above 10: 13 → 1', () => {
    expect(statModifier(13)).toBe(1)
  })
})

// ─── isValidStat ──────────────────────────────────────────────────────────────

describe('isValidStat', () => {
  it('accepts values 1–30', () => {
    expect(isValidStat(1)).toBe(true)
    expect(isValidStat(15)).toBe(true)
    expect(isValidStat(30)).toBe(true)
  })

  it('rejects 0', () => expect(isValidStat(0)).toBe(false))
  it('rejects 31', () => expect(isValidStat(31)).toBe(false))
  it('rejects negative values', () => expect(isValidStat(-1)).toBe(false))
  it('rejects floats', () => expect(isValidStat(14.5)).toBe(false))
})

// ─── classifyAction ───────────────────────────────────────────────────────────

describe('classifyAction — FORCE', () => {
  it('classifies "smash the door" as FORCE', () => {
    expect(classifyAction('smash the door')).toBe('FORCE')
  })
  it('classifies "I try to break the chain" as FORCE', () => {
    expect(classifyAction('I try to break the chain')).toBe('FORCE')
  })
  it('classifies "lift the portcullis" as FORCE', () => {
    expect(classifyAction('lift the portcullis')).toBe('FORCE')
  })
})

describe('classifyAction — FINESSE', () => {
  it('classifies "sneak past the guard" as FINESSE', () => {
    expect(classifyAction('sneak past the guard')).toBe('FINESSE')
  })
  it('classifies "pick the lock" as FINESSE', () => {
    expect(classifyAction('pick the lock')).toBe('FINESSE')
  })
  it('classifies "dodge the trap" as FINESSE', () => {
    expect(classifyAction('dodge the trap')).toBe('FINESSE')
  })
  it('classifies "climb the tower wall" as FINESSE', () => {
    expect(classifyAction('climb the tower wall')).toBe('FINESSE')
  })
})

describe('classifyAction — ENDURE', () => {
  it('classifies "resist the poison" as ENDURE', () => {
    expect(classifyAction('resist the poison')).toBe('ENDURE')
  })
  it('classifies "endure the cold" as ENDURE', () => {
    expect(classifyAction('endure the cold')).toBe('ENDURE')
  })
  it('classifies "survive the night" as ENDURE', () => {
    expect(classifyAction('survive the night')).toBe('ENDURE')
  })
})

describe('classifyAction — REASON', () => {
  it('classifies "investigate the crime scene" as REASON', () => {
    expect(classifyAction('investigate the crime scene')).toBe('REASON')
  })
  it('classifies "decipher the runes" as REASON', () => {
    expect(classifyAction('decipher the runes')).toBe('REASON')
  })
  it('classifies "recall the lore of the ancients" as REASON', () => {
    expect(classifyAction('recall the lore of the ancients')).toBe('REASON')
  })
  it('classifies "study the arcane symbols" as REASON', () => {
    expect(classifyAction('study the arcane symbols')).toBe('REASON')
  })
})

describe('classifyAction — PERCEIVE', () => {
  it('classifies "listen at the door" as PERCEIVE', () => {
    expect(classifyAction('listen at the door')).toBe('PERCEIVE')
  })
  it('classifies "look for hidden traps" as PERCEIVE', () => {
    expect(classifyAction('look for hidden traps')).toBe('PERCEIVE')
  })
  it('classifies "scan the rooftops" as PERCEIVE', () => {
    expect(classifyAction('scan the rooftops')).toBe('PERCEIVE')
  })
  it('classifies "track the beast through the forest" as PERCEIVE', () => {
    expect(classifyAction('track the beast through the forest')).toBe('PERCEIVE')
  })
})

describe('classifyAction — INFLUENCE', () => {
  it('classifies "persuade the merchant" as INFLUENCE', () => {
    expect(classifyAction('persuade the merchant')).toBe('INFLUENCE')
  })
  it('classifies "intimidate the guard" as INFLUENCE', () => {
    expect(classifyAction('intimidate the guard')).toBe('INFLUENCE')
  })
  it('classifies "deceive the innkeeper" as INFLUENCE', () => {
    expect(classifyAction('deceive the innkeeper')).toBe('INFLUENCE')
  })
  it('classifies "ask the wizard about the prophecy" as INFLUENCE', () => {
    expect(classifyAction('ask the wizard about the prophecy')).toBe('INFLUENCE')
  })
})

describe('classifyAction — UNKNOWN fallback', () => {
  it('returns UNKNOWN for unrecognised input', () => {
    expect(classifyAction('I do something vague')).toBe('UNKNOWN')
  })
  it('returns UNKNOWN for an empty-ish phrase', () => {
    expect(classifyAction('the thing')).toBe('UNKNOWN')
  })
})

// ─── parseAction ─────────────────────────────────────────────────────────────

describe('parseAction — structure', () => {
  it('returns an ActionIntent with all required fields', () => {
    const intent = parseAction('I try to pick the lock')
    expect(intent).toHaveProperty('rawInput')
    expect(intent).toHaveProperty('normalised')
    expect(intent).toHaveProperty('category')
    expect(intent).toHaveProperty('stat')
    expect(intent).toHaveProperty('suggestedDc')
    expect(intent).toHaveProperty('dcTier')
    expect(intent).toHaveProperty('difficultyHints')
  })

  it('preserves rawInput exactly (trimmed)', () => {
    const intent = parseAction('  Sneak past the guard  ')
    expect(intent.rawInput).toBe('Sneak past the guard')
  })

  it('normalised is lowercase of rawInput', () => {
    const intent = parseAction('SMASH the door')
    expect(intent.normalised).toBe('smash the door')
  })
})

describe('parseAction — stat mapping', () => {
  const cases: Array<[string, string]> = [
    ['smash the door', 'STR'],
    ['sneak past the guard', 'DEX'],
    ['resist the poison', 'CON'],
    ['investigate the scene', 'INT'],
    ['listen for sounds', 'WIS'],
    ['persuade the captain', 'CHA'],
  ]

  for (const [input, expectedStat] of cases) {
    it(`"${input}" → ${expectedStat}`, () => {
      expect(parseAction(input).stat).toBe(expectedStat)
    })
  }
})

describe('parseAction — DC suggestions', () => {
  it('UNKNOWN defaults to EASY (DC 10)', () => {
    const intent = parseAction('I do something vague')
    expect(intent.dcTier).toBe('EASY')
    expect(intent.suggestedDc).toBe(10)
  })

  it('FORCE defaults to MEDIUM (DC 15)', () => {
    const intent = parseAction('I smash the wall')
    expect(intent.dcTier).toBe('MEDIUM')
    expect(intent.suggestedDc).toBe(15)
  })

  it('"quickly" bumps DC up one tier', () => {
    const base = parseAction('I pick the lock')
    const bumped = parseAction('I quickly pick the lock')
    expect(bumped.suggestedDc).toBeGreaterThan(base.suggestedDc)
  })

  it('"slowly" bumps DC down one tier', () => {
    const base = parseAction('I smash the door')
    const bumped = parseAction('I slowly smash the door')
    expect(bumped.suggestedDc).toBeLessThan(base.suggestedDc)
  })

  it('difficulty hints are captured in difficultyHints[]', () => {
    const intent = parseAction('I quickly pick the lock')
    expect(intent.difficultyHints).toContain('quickly')
  })

  it('DC is clamped at LEGENDARY when bumped high', () => {
    // "ancient" bumps up; LEGENDARY is the ceiling
    const intent = parseAction('I ancient pick the lock')
    // Even with a bump, DC should not exceed 25
    expect(intent.suggestedDc).toBeLessThanOrEqual(25)
  })

  it('DC is clamped at TRIVIAL when bumped low', () => {
    const intent = parseAction('I slowly endure the easy thing')
    expect(intent.suggestedDc).toBeGreaterThanOrEqual(5)
  })
})

describe('parseAction — validation', () => {
  it('throws on empty string', () => {
    expect(() => parseAction('')).toThrow('[intent] Action input cannot be empty')
  })

  it('throws on whitespace-only string', () => {
    expect(() => parseAction('   ')).toThrow('[intent] Action input cannot be empty')
  })

  it('throws on input exceeding 500 chars', () => {
    expect(() => parseAction('a'.repeat(501))).toThrow(
      '[intent] Action input exceeds 500 character limit',
    )
  })

  it('accepts exactly 500 chars', () => {
    expect(() => parseAction('a'.repeat(500))).not.toThrow()
  })

  it('accepts single character', () => {
    expect(() => parseAction('x')).not.toThrow()
  })
})
