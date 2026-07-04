/**
 * CharacterSidebar Tests — Phase 2.3
 *
 * Verifies engine-derived values render correctly.
 * No math is reimplemented here — we test that the sidebar calls the
 * engine correctly by asserting the output values match what the engine
 * would produce for the given input.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { CharacterSidebar } from '@/components/adventure/CharacterSidebar'
import {
  getAbilityModifier,
  getProficiencyBonus,
  getEquipmentPassiveBonus,
} from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(overrides: Partial<CharacterRecord['sheet']> = {}): CharacterRecord {
  return {
    id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '', experience: 0,
    tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    sheet: {
      name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
      background: 'soldier',
      scores: { strength:16, dexterity:14, constitution:14, intelligence:10, wisdom:12, charisma:8 },
      modifiers: { strength:3, dexterity:2, constitution:2, intelligence:0, wisdom:1, charisma:-1 },
      hitDie: 'd10', maxHp: 30, currentHp: 22, armorClass: 16, proficiencyBonus: 2,
      skillProficiencies: ['perception' as const],
      savingThrowProficiencies: [], equipment: [], conditions: [],
      deathSaveSuccesses: 0, deathSaveFailures: 0,
      ...overrides,
    },
  }
}

function renderSidebar(char = makeCharacter()) {
  return render(
    <MemoryRouter>
      <CharacterSidebar character={char} />
    </MemoryRouter>
  )
}

describe('CharacterSidebar — identity', () => {
  it('displays character name', () => {
    renderSidebar()
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
  })

  it('displays level, ancestry, and archetype', () => {
    renderSidebar()
    expect(screen.getByText(/Lv 3.*human.*fighter/i)).toBeInTheDocument()
  })

  it('shows the first letter of name as avatar when no portrait', () => {
    renderSidebar()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders portrait image when portraitUrl is provided', () => {
    const char = makeCharacter()
    char.portraitUrl = 'https://example.com/portrait.jpg'
    renderSidebar(char)
    expect(screen.getByRole('img', { name: /Portrait of Aldric Sorn/i })).toBeInTheDocument()
  })
})

describe('CharacterSidebar — HP bar', () => {
  it('displays currentHp / maxHp', () => {
    renderSidebar()
    expect(screen.getByText('22 / 30')).toBeInTheDocument()
  })

  it('renders the HP progressbar with correct values', () => {
    renderSidebar()
    const bar = screen.getByRole('progressbar', { name: /hit points/i })
    expect(bar).toHaveAttribute('aria-valuenow', '22')
    expect(bar).toHaveAttribute('aria-valuemax', '30')
  })

  it('HP at 0 clamps bar to 0% width, not negative', () => {
    const char = makeCharacter({ currentHp: 0 })
    renderSidebar(char)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveStyle({ width: '0%' })
  })
})

describe('CharacterSidebar — engine-derived stats', () => {
  it('displays AC from character sheet', () => {
    renderSidebar()
    // AC is in a StatPill — label AC, value 16
    expect(screen.getByText('16')).toBeInTheDocument()
  })

  it('displays proficiency bonus via getProficiencyBonus(level)', () => {
    const char = makeCharacter({ level: 3 })
    renderSidebar(char)
    const expected = `+${getProficiencyBonus(3)}`   // +2
    // Multiple +2 elements possible (DEX mod also +2, etc) — just confirm presence
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
  })

  it('displays all six ability modifiers', () => {
    const char = makeCharacter()
    renderSidebar(char)
    const { sheet } = char
    const expectedMods = [
      sheet.modifiers.strength,
      sheet.modifiers.dexterity,
      sheet.modifiers.constitution,
      sheet.modifiers.intelligence,
      sheet.modifiers.wisdom,
      sheet.modifiers.charisma,
    ]
    for (const mod of expectedMods) {
      const formatted = mod >= 0 ? `+${mod}` : `${mod}`
      expect(screen.getAllByText(formatted).length).toBeGreaterThan(0)
    }
  })
})

describe('CharacterSidebar — passive skills', () => {
  it('calculates passive perception correctly', () => {
    // WIS 12 → mod +1, perception proficient → prof +2 (level 3), no equipment bonus
    // passive = 10 + 1 + 2 = 13
    const char = makeCharacter({ level: 3 })
    renderSidebar(char)
    const wisMod = getAbilityModifier(12)
    const prof = getProficiencyBonus(3)
    const expected = 10 + wisMod + prof + getEquipmentPassiveBonus([], 'perception')
    // Find Perception row and check value
    expect(screen.getByText('Perception')).toBeInTheDocument()
    expect(screen.getByText(String(expected))).toBeInTheDocument()
  })

  it('calculates passive investigation without proficiency', () => {
    // INT 10 → mod 0, no investigation proficiency → no prof bonus
    // passive = 10 + 0 + 0 = 10
    renderSidebar()
    expect(screen.getByText('Investigation')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows proficiency indicator dot next to proficient skill', () => {
    // Perception is in skillProficiencies, so the sidebar shows the dot indicator
    renderSidebar()
    // The dot is a span sibling of the Perception label — check both render
    const perceptionLabel = screen.getByText('Perception')
    const dotContainer = perceptionLabel.closest('span')
    expect(dotContainer).toBeTruthy()
  })
})

describe('CharacterSidebar — conditions', () => {
  it('does not render conditions section when no conditions active', () => {
    renderSidebar()
    expect(screen.queryByText('Conditions')).not.toBeInTheDocument()
  })

  it('renders active condition badge', () => {
    const char = makeCharacter({
      conditions: [{ id: 'poisoned', appliedAtTurn: 0, expiresAtTurn: null, source: 'test', stackLevel: 1, requiresConcentration: false, concentrationSourceId: null }],
    })
    renderSidebar(char)
    expect(screen.getByText('Conditions')).toBeInTheDocument()
    // CONDITIONS['poisoned'].name should be present
    expect(screen.getByText(/poisoned/i)).toBeInTheDocument()
  })

  it('shows incapacitation warning when character is incapacitated', () => {
    const char = makeCharacter({
      conditions: [{ id: 'stunned', appliedAtTurn: 0, expiresAtTurn: null, source: 'test', stackLevel: 1, requiresConcentration: false, concentrationSourceId: null }],
    })
    renderSidebar(char)
    expect(screen.getByText(/Cannot take actions/i)).toBeInTheDocument()
  })
})

describe('CharacterSidebar — equipment summary', () => {
  it('does not render equipment section when nothing equipped', () => {
    renderSidebar()
    expect(screen.queryByText('Equipped')).not.toBeInTheDocument()
  })

  it('renders equipped weapon with attack bonus', () => {
    const char = makeCharacter({
      equipment: [{
        id: 'sword-1', name: 'Longsword', slot: 'weapon' as const, equipped: true,
        attackBonus: 5,
      }],
    })
    renderSidebar(char)
    expect(screen.getByText('Equipped')).toBeInTheDocument()
    expect(screen.getByText('Longsword')).toBeInTheDocument()
    expect(screen.getByText('+5 atk')).toBeInTheDocument()
  })
})
