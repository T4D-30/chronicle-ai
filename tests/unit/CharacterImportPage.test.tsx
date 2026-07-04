/**
 * CharacterImportPage Tests — Phase 10.1
 *
 * Covers the upload → review handoff specifically (the page's only real
 * logic). The review/save steps themselves are CharacterWizard, already
 * covered by CharacterWizard.test.tsx — these tests confirm the seam
 * between upload and wizard works, not re-test the wizard.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createCharacterMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    createCharacter: (...args: unknown[]) => createCharacterMock(...args),
  }
})

import CharacterImportPage from '@/app/pages/CharacterImportPage'
import { useAuthStore } from '@/store/authStore'
import { useCharacterStore } from '@/store/characterStore'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/characters/import']}>
      <CharacterImportPage />
    </MemoryRouter>,
  )
}

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array(100)], name, { type })
}

beforeEach(() => {
  createCharacterMock.mockReset()
  useAuthStore.setState({
    user: { id: 'user-1', email: 'hero@chronicle.ai' } as never,
    session: null,
    isLoading: false,
    isAuthenticated: true,
  })
  useCharacterStore.setState({ characters: [], isLoading: false, error: null })
  window.localStorage.clear()
})

describe('CharacterImportPage — upload stage', () => {
  it('renders the upload zone initially', () => {
    renderPage()
    expect(screen.getByText('Import Character Sheet')).toBeInTheDocument()
    expect(screen.getByText(/Drop a character sheet here/i)).toBeInTheDocument()
  })

  it('does not render the wizard before a file is uploaded', () => {
    renderPage()
    expect(screen.queryByLabelText('Character Name')).not.toBeInTheDocument()
  })

  it('has a link back to the character library', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Back to Library/i })).toHaveAttribute('href', '/characters')
  })
})

describe('CharacterImportPage — upload to review handoff', () => {
  it('transitions to the wizard review step after a file is parsed', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, makeFile('sheet.pdf', 'application/pdf'))

    // Review step shows the draft as read-only text (no name extracted yet
    // by the manual-entry provider, so it falls back to "Unnamed Character")
    // and a "Needs Attention" list — both are Review-step-only signals.
    await waitFor(() => expect(screen.getByText('Unnamed Character')).toBeInTheDocument())
  })

  it('shows the provider name and honest notes banner after parsing', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, makeFile('my-character.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByText('Manual Entry')).toBeInTheDocument())
    expect(screen.getByText(/my-character\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
  })

  it('no longer shows the upload zone once a file has been parsed', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, makeFile('sheet.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByText('Unnamed Character')).toBeInTheDocument())
    expect(screen.queryByText(/Drop a character sheet here/i)).not.toBeInTheDocument()
  })

  it('lands directly on the Review step, not Identity, after import', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, makeFile('sheet.pdf', 'application/pdf'))

    // Review step shows the "Create Character" action, not "Next"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument()
    })
    // And explicitly NOT the Identity step's editable name field
    expect(screen.queryByLabelText('Character Name')).not.toBeInTheDocument()
  })

  it('does not prompt to resume an unrelated saved draft when arriving via import', async () => {
    window.localStorage.setItem(
      'chronicle-ai:character-draft:user-1',
      JSON.stringify({
        draft: {
          name: 'Some Other Draft', archetype: 'rogue', ancestry: 'human', background: 'criminal', level: 1,
          scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
          skillProficiencies: [], savingThrowProficiencies: [], equipment: [], portraitUrl: null, bio: '',
        },
        stepIndex: 2,
        savedAt: new Date().toISOString(),
      }),
    )
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, makeFile('sheet.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByText('Unnamed Character')).toBeInTheDocument())
    expect(screen.queryByText('Resume unfinished character?')).not.toBeInTheDocument()
    // Confirms the OTHER draft's name never leaked in either
    expect(screen.queryByText('Some Other Draft')).not.toBeInTheDocument()
  })

  it('rejects an unsupported file type via drag-and-drop and stays on the upload stage', async () => {
    renderPage()
    const dropZone = screen.getByRole('button', { name: /Upload a character sheet file/i })
    fireEvent.drop(dropZone, { dataTransfer: { files: [makeFile('sheet.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported file type/i)
    expect(screen.getByText(/Drop a character sheet here/i)).toBeInTheDocument()
  })
})

describe('CharacterImportPage — save path reuses the real creation flow', () => {
  it('calling Create Character from the imported review step invokes the real createCharacter service', async () => {
    createCharacterMock.mockResolvedValue({
      id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
      experience: 0, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
      conditions: [], features: [], inventory: [], spells: {},
      createdAt: '', updatedAt: '',
      sheet: { name: 'Imported Hero', level: 1, archetype: 'fighter', ancestry: 'human', background: 'soldier',
        scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
        hitDie: 'd10', maxHp: 10, currentHp: 10, armorClass: 10, proficiencyBonus: 2,
        skillProficiencies: [], savingThrowProficiencies: [], equipment: [],
        conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0 },
    })
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, makeFile('sheet.pdf', 'application/pdf'))

    // Arrives on Review with a blank name — real user flow is to click the
    // "Needs Attention" link back to Identity, same as the wizard's own
    // navigation (onGoToStep), fill in the name, then return to Review.
    await waitFor(() => expect(screen.getByText('Unnamed Character')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^Identity:/ }))
    await user.type(screen.getByLabelText('Character Name'), 'Imported Hero')

    // Advance back through to Review (Identity -> ... -> Review)
    for (let i = 0; i < 8; i++) {
      const nextBtn = screen.queryByRole('button', { name: 'Next' })
      if (!nextBtn) break
      await user.click(nextBtn)
    }

    await user.click(screen.getByRole('button', { name: 'Create Character' }))
    await waitFor(() => expect(createCharacterMock).toHaveBeenCalledOnce())
  })
})
