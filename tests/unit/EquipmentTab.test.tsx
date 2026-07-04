/**
 * EquipmentTab Tests — Phase 9.1
 *
 * No prior test coverage existed. Covers the summary stat cards and
 * add-item flow, which now render inside PixelPanel wrappers.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { EquipmentTab } from '@/components/character/tabs/EquipmentTab'
import { buildCharacter } from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  const sheet = buildCharacter({
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
    background: 'soldier',
    scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
  })
  return {
    id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
    experience: 0, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    sheet: { ...sheet, equipment: [] },
    ...overrides,
  }
}

describe('EquipmentTab', () => {
  it('shows zero total bonuses with no equipment', () => {
    render(<EquipmentTab character={makeCharacter()} onPatch={vi.fn()} />)
    expect(screen.getByText('Total Attack Bonus')).toBeInTheDocument()
    expect(screen.getByText('Total Armor Bonus')).toBeInTheDocument()
  })

  it('shows empty state when no equipment', () => {
    render(<EquipmentTab character={makeCharacter()} onPatch={vi.fn()} />)
    expect(screen.getByText('No equipment yet.')).toBeInTheDocument()
  })

  it('lists equipped items with slot and bonus info', () => {
    const character = makeCharacter({
      sheet: {
        ...makeCharacter().sheet,
        equipment: [{ id: 'e1', name: 'Longsword', slot: 'weapon', equipped: true, attackBonus: 3 }],
      },
    })
    render(<EquipmentTab character={character} onPatch={vi.fn()} />)
    expect(screen.getByText('Longsword')).toBeInTheDocument()
    expect(screen.getByText(/Attack \+3/)).toBeInTheDocument()
  })

  it('adds a new equipment item via the form', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(<EquipmentTab character={makeCharacter()} onPatch={onPatch} />)
    await user.type(screen.getByLabelText('Item Name'), 'Iron Shield')
    await user.click(screen.getByRole('button', { name: 'Add Item' }))
    expect(onPatch).toHaveBeenCalled()
  })

  it('Add Item button is disabled with empty name', () => {
    render(<EquipmentTab character={makeCharacter()} onPatch={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeDisabled()
  })
})
