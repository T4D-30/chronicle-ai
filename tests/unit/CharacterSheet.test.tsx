/**
 * CharacterSheet Tests — Phase 9.1
 *
 * No prior test coverage existed for this shell component. Mocks
 * useCharacterSheet directly (the hook's own Supabase-backed logic is
 * out of scope here) to verify the loading/error/success chrome states,
 * including the pixel-panel error state added in this phase.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { CharacterSheet } from '@/components/character/CharacterSheet'
import { buildCharacter } from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

const mockUseCharacterSheet = vi.fn()

vi.mock('@/components/character/useCharacterSheet', () => ({
  useCharacterSheet: (id: string) => mockUseCharacterSheet(id),
}))

function makeCharacter(): CharacterRecord {
  return {
    id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
    experience: 500, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    sheet: buildCharacter({
      name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
      background: 'soldier',
      scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    }),
  }
}

function renderSheet() {
  return render(
    <MemoryRouter>
      <CharacterSheet characterId="char-1" />
    </MemoryRouter>,
  )
}

describe('CharacterSheet — loading state', () => {
  it('shows a loading spinner while loading', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: null, isLoading: true, loadError: null,
      saveStatus: 'idle', saveError: null, patch: vi.fn(),
    })
    renderSheet()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('CharacterSheet — error state', () => {
  it('shows the load error message', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: null, isLoading: false, loadError: 'Character not found.',
      saveStatus: 'idle', saveError: null, patch: vi.fn(),
    })
    renderSheet()
    expect(screen.getByText('Character not found.')).toBeInTheDocument()
  })

  it('shows a link back to the library on error', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: null, isLoading: false, loadError: 'Character not found.',
      saveStatus: 'idle', saveError: null, patch: vi.fn(),
    })
    renderSheet()
    expect(screen.getByRole('link', { name: /Back to Library/i })).toBeInTheDocument()
  })
})

describe('CharacterSheet — loaded state', () => {
  it('renders the character name once loaded', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: makeCharacter(), isLoading: false, loadError: null,
      saveStatus: 'idle', saveError: null, patch: vi.fn(),
    })
    renderSheet()
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
  })

  it('renders all 10 sheet tabs', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: makeCharacter(), isLoading: false, loadError: null,
      saveStatus: 'idle', saveError: null, patch: vi.fn(),
    })
    renderSheet()
    const expectedTabs = [
      'Overview', 'Abilities', 'Skills', 'Saves', 'Inventory',
      'Equipment', 'Spells', 'Features', 'Conditions', 'Notes',
    ]
    expectedTabs.forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    })
  })

  it('shows the save status indicator when saving', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: makeCharacter(), isLoading: false, loadError: null,
      saveStatus: 'saving', saveError: null, patch: vi.fn(),
    })
    renderSheet()
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('shows a save error message when save fails', () => {
    mockUseCharacterSheet.mockReturnValue({
      character: makeCharacter(), isLoading: false, loadError: null,
      saveStatus: 'error', saveError: 'Network error', patch: vi.fn(),
    })
    renderSheet()
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })
})
