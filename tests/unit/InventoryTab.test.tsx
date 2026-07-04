/**
 * InventoryTab Tests — Phase 9.1
 *
 * No prior test coverage existed. Covers the total-weight summary card
 * and add-item flow, which now render inside PixelPanel wrappers.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { InventoryTab } from '@/components/character/tabs/InventoryTab'
import { buildCharacter } from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
    experience: 0, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    sheet: buildCharacter({
      name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
      background: 'soldier',
      scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    }),
    ...overrides,
  }
}

describe('InventoryTab', () => {
  it('shows zero total weight with an empty inventory', () => {
    render(<InventoryTab character={makeCharacter()} onPatch={vi.fn()} />)
    expect(screen.getByText('0 lbs')).toBeInTheDocument()
  })

  it('shows empty state when inventory is empty', () => {
    render(<InventoryTab character={makeCharacter()} onPatch={vi.fn()} />)
    expect(screen.getByText('Inventory is empty.')).toBeInTheDocument()
  })

  it('computes real total weight from item quantity × weight', () => {
    const character = makeCharacter({
      inventory: [
        { id: 'i1', name: 'Rope', quantity: 2, weight: 5, equipped: false, description: '' },
      ],
    })
    render(<InventoryTab character={character} onPatch={vi.fn()} />)
    expect(screen.getByText('10 lbs')).toBeInTheDocument()
  })

  it('adds a new inventory item via the form', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    render(<InventoryTab character={makeCharacter()} onPatch={onPatch} />)
    await user.type(screen.getByLabelText('Item Name'), 'Torch')
    await user.click(screen.getByRole('button', { name: 'Add Item' }))
    expect(onPatch).toHaveBeenCalled()
  })

  it('shows a validation error for empty item name', async () => {
    const user = userEvent.setup()
    render(<InventoryTab character={makeCharacter()} onPatch={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Add Item' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be empty/i)
  })

  it('increases item quantity when + is clicked', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    const character = makeCharacter({
      inventory: [{ id: 'i1', name: 'Rope', quantity: 1, weight: 5, equipped: false, description: '' }],
    })
    render(<InventoryTab character={character} onPatch={onPatch} />)
    await user.click(screen.getByLabelText('Increase quantity of Rope'))
    expect(onPatch).toHaveBeenCalled()
  })
})
