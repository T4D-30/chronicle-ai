import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CharacterCard } from '@/components/character/CharacterCard'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(overrides: Partial<CharacterRecord['sheet']> = {}): CharacterRecord {
  return {
    id: 'char-1',
    userId: 'user-1',
    sheet: {
      name: 'Aldric Sorn',
      level: 3,
      archetype: 'fighter',
      ancestry: 'human',
      background: 'soldier',
      scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
      modifiers: { strength: 3, dexterity: 2, constitution: 2, intelligence: 0, wisdom: 1, charisma: -1 },
      hitDie: 'd10',
      maxHp: 30,
      currentHp: 30,
      armorClass: 16,
      proficiencyBonus: 2,
      skillProficiencies: [],
      savingThrowProficiencies: [],
      equipment: [],
      conditions: [],
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      ...overrides,
    },
    experience: 900,
    tempHp: 0,
    deathSavesSuccess: 0,
    deathSavesFailure: 0,
    conditions: [],
    features: [],
    inventory: [],
    spells: {},
    portraitUrl: null,
    bio: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

describe('CharacterCard', () => {
  it('renders the character name and identity line', () => {
    render(
      <CharacterCard
        character={makeCharacter()}
        onOpen={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
    expect(screen.getByText(/Level 3 human fighter/i)).toBeInTheDocument()
  })

  it('shows AC and HP', () => {
    render(
      <CharacterCard
        character={makeCharacter()}
        onOpen={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText('AC 16')).toBeInTheDocument()
    expect(screen.getByText('30/30')).toBeInTheDocument()
  })

  it('shows the first letter of the name when there is no portrait', () => {
    render(
      <CharacterCard
        character={makeCharacter()}
        onOpen={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders a portrait image when portraitUrl is set', () => {
    const character = { ...makeCharacter(), portraitUrl: 'data:image/png;base64,abc' }
    render(
      <CharacterCard character={character} onOpen={() => {}} onDuplicate={() => {}} onDelete={() => {}} />,
    )
    expect(screen.getByRole('img', { name: /Portrait of Aldric Sorn/i })).toBeInTheDocument()
  })

  it('calls onOpen with the character id when the card name is clicked', async () => {
    const user = userEvent.setup()
    const handleOpen = vi.fn()
    render(
      <CharacterCard character={makeCharacter()} onOpen={handleOpen} onDuplicate={() => {}} onDelete={() => {}} />,
    )
    await user.click(screen.getByText('Aldric Sorn'))
    expect(handleOpen).toHaveBeenCalledWith('char-1')
  })

  it('calls onOpen when the Open button is clicked', async () => {
    const user = userEvent.setup()
    const handleOpen = vi.fn()
    render(
      <CharacterCard character={makeCharacter()} onOpen={handleOpen} onDuplicate={() => {}} onDelete={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(handleOpen).toHaveBeenCalledWith('char-1')
  })

  it('calls onDuplicate with the character id', async () => {
    const user = userEvent.setup()
    const handleDuplicate = vi.fn()
    render(
      <CharacterCard character={makeCharacter()} onOpen={() => {}} onDuplicate={handleDuplicate} onDelete={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(handleDuplicate).toHaveBeenCalledWith('char-1')
  })

  it('calls onDelete with the character id', async () => {
    const user = userEvent.setup()
    const handleDelete = vi.fn()
    render(
      <CharacterCard character={makeCharacter()} onOpen={() => {}} onDuplicate={() => {}} onDelete={handleDelete} />,
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handleDelete).toHaveBeenCalledWith('char-1')
  })

  it('shows a loading state on Duplicate when isDuplicating is true', () => {
    render(
      <CharacterCard
        character={makeCharacter()}
        onOpen={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
        isDuplicating
      />,
    )
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled()
  })
})
