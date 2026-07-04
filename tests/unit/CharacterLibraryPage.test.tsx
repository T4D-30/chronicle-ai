/**
 * Chronicle AI — CharacterLibraryPage Tests
 * Volume II, Phase 2.1
 *
 * Covers list rendering, search filtering, duplicate, and delete-with-
 * confirm flows. The Supabase service layer is mocked at the barrel
 * (@/lib/supabase); auth and character list state use the REAL Zustand
 * stores (useAuthStore, useCharacterStore) seeded directly via setState,
 * which exercises the actual state-management wiring rather than mocking
 * it away.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listCharactersMock = vi.fn()
const deleteCharacterMock = vi.fn()
const duplicateCharacterMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    listCharacters: (...args: unknown[]) => listCharactersMock(...args),
    deleteCharacter: (...args: unknown[]) => deleteCharacterMock(...args),
    duplicateCharacter: (...args: unknown[]) => duplicateCharacterMock(...args),
  }
})

import CharacterLibraryPage from '@/app/pages/CharacterLibraryPage'
import { useAuthStore } from '@/store/authStore'
import { useCharacterStore } from '@/store/characterStore'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(id: string, name: string, archetype = 'fighter'): CharacterRecord {
  return {
    id,
    userId: 'user-1',
    sheet: {
      name,
      level: 1,
      archetype,
      ancestry: 'human',
      background: 'wanderer',
      scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
      hitDie: 'd8',
      maxHp: 10,
      currentHp: 10,
      armorClass: 10,
      proficiencyBonus: 2,
      skillProficiencies: [],
      savingThrowProficiencies: [],
      equipment: [],
      conditions: [],
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
    },
    experience: 0,
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

function renderLibrary() {
  return render(
    <MemoryRouter>
      <CharacterLibraryPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  listCharactersMock.mockReset()
  deleteCharacterMock.mockReset()
  duplicateCharacterMock.mockReset()

  // Seed the real auth store with a logged-in user
  useAuthStore.setState({
    user: { id: 'user-1', email: 'hero@chronicle.ai' } as never,
    session: null,
    isLoading: false,
    isAuthenticated: true,
  })

  // Reset the real character store to a clean slate
  useCharacterStore.setState({ characters: [], isLoading: false, error: null })
})

describe('CharacterLibraryPage — loading and listing', () => {
  it('fetches characters for the logged-in user on mount', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric')])
    renderLibrary()
    await waitFor(() => expect(listCharactersMock).toHaveBeenCalledWith('user-1'))
  })

  it('renders each fetched character as a card', async () => {
    listCharactersMock.mockResolvedValue([
      makeCharacter('c1', 'Aldric Sorn'),
      makeCharacter('c2', 'Lira Swiftfoot'),
    ])
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    expect(screen.getByText('Lira Swiftfoot')).toBeInTheDocument()
  })

  it('shows an empty state with a create-first-character CTA when there are no characters', async () => {
    listCharactersMock.mockResolvedValue([])
    renderLibrary()
    await waitFor(() =>
      expect(screen.getByText('Create Your First Character')).toBeInTheDocument(),
    )
  })

  it('shows an error message when fetching fails', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    listCharactersMock.mockRejectedValue(new ServiceError('Network down.', 'DB_ERROR'))
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Network down.')).toBeInTheDocument())
  })
})

describe('CharacterLibraryPage — search', () => {
  it('filters the visible characters by name as the user types', async () => {
    listCharactersMock.mockResolvedValue([
      makeCharacter('c1', 'Aldric Sorn'),
      makeCharacter('c2', 'Lira Swiftfoot'),
    ])
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Search characters'), 'Lira')
    expect(screen.queryByText('Aldric Sorn')).not.toBeInTheDocument()
    expect(screen.getByText('Lira Swiftfoot')).toBeInTheDocument()
  })

  it('filters by class/archetype as well as name', async () => {
    listCharactersMock.mockResolvedValue([
      makeCharacter('c1', 'Aldric Sorn', 'fighter'),
      makeCharacter('c2', 'Lira Swiftfoot', 'rogue'),
    ])
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Search characters'), 'rogue')
    expect(screen.queryByText('Aldric Sorn')).not.toBeInTheDocument()
    expect(screen.getByText('Lira Swiftfoot')).toBeInTheDocument()
  })

  it('shows a no-results message for a search with no matches', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Search characters'), 'zzz-nonexistent')
    expect(screen.getByText('No characters match your search.')).toBeInTheDocument()
  })
})

describe('CharacterLibraryPage — delete', () => {
  it('opens a confirm dialog when Delete is clicked, and does not delete immediately', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(deleteCharacterMock).not.toHaveBeenCalled()
  })

  it('calls deleteCharacter only after confirming', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    deleteCharacterMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteCharacterMock).toHaveBeenCalledWith('c1'))
  })

  it('removes the character card from the list after a confirmed delete', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    deleteCharacterMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('Aldric Sorn')).not.toBeInTheDocument())
  })

  it('closes the dialog without deleting when cancelled', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteCharacterMock).not.toHaveBeenCalled()
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
  })
})

describe('CharacterLibraryPage — duplicate', () => {
  it('calls duplicateCharacter with the source id and current user id', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    duplicateCharacterMock.mockResolvedValue(makeCharacter('c2', 'Aldric Sorn (Copy)'))
    const user = userEvent.setup()
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    await waitFor(() => expect(duplicateCharacterMock).toHaveBeenCalledWith('c1', 'user-1'))
  })
})

describe('CharacterLibraryPage — import entry points (Phase 10.1)', () => {
  it('shows an "Import Character" link in the header that points to /characters/import', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Import Character' })).toHaveAttribute('href', '/characters/import')
  })

  it('the header "+ Create New" link still points to /characters/new (unchanged)', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: '+ Create New' })).toHaveAttribute('href', '/characters/new')
  })

  it('shows an "Import a Sheet" link in the empty state that points to /characters/import', async () => {
    listCharactersMock.mockResolvedValue([])
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Create Your First Character')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Import a Sheet' })).toHaveAttribute('href', '/characters/import')
  })

  it('the empty-state "Create Your First Character" link still points to /characters/new (unchanged)', async () => {
    listCharactersMock.mockResolvedValue([])
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Create Your First Character')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Create Your First Character' })).toHaveAttribute('href', '/characters/new')
  })

  it('does not show the empty-state import link when characters already exist', async () => {
    listCharactersMock.mockResolvedValue([makeCharacter('c1', 'Aldric Sorn')])
    renderLibrary()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Import a Sheet' })).not.toBeInTheDocument()
  })
})
