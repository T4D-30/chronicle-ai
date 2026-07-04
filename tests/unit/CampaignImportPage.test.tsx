/**
 * CampaignImportPage Tests — Phase 10.2
 * Mirrors tests/unit/CharacterImportPage.test.tsx.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

const createCampaignMock = vi.fn()
const listCharactersMock = vi.fn().mockResolvedValue([])

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    createCampaign: (...args: unknown[]) => createCampaignMock(...args),
    listCharacters: (...args: unknown[]) => listCharactersMock(...args),
  }
})

import CampaignImportPage from '@/app/pages/CampaignImportPage'
import { useAuthStore } from '@/store/authStore'
import { useCampaignStore } from '@/store/campaignStore'
import { useCharacterStore } from '@/store/characterStore'

const MOCK_CAMPAIGN = {
  id: 'camp-1', userId: 'user-1', title: 'Imported Campaign', description: 'A kingdom in turmoil.',
  status: 'idle' as const, characterId: 'char-1',
  directorConfig: DEFAULT_DIRECTOR_CONFIG, worldState: DEFAULT_WORLD_STATE,
  tone: 'heroic' as const, difficulty: 'standard' as const,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const MOCK_CHARACTER = {
  id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
  experience: 0, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
  conditions: [], features: [], inventory: [], spells: {},
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  sheet: {
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human', background: 'soldier',
    scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    modifiers: { strength: 3, dexterity: 2, constitution: 2, intelligence: 0, wisdom: 1, charisma: -1 },
    hitDie: 'd10' as const, maxHp: 30, currentHp: 30, armorClass: 16, proficiencyBonus: 2,
    skillProficiencies: [], savingThrowProficiencies: [], equipment: [],
    conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/campaigns/import']}>
      <CampaignImportPage />
    </MemoryRouter>,
  )
}

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array(100)], name, { type })
}

beforeEach(() => {
  createCampaignMock.mockReset()
  listCharactersMock.mockReset()
  listCharactersMock.mockResolvedValue([])
  useAuthStore.setState({
    user: { id: 'user-1', email: 'hero@chronicle.ai' } as never,
    session: null, isLoading: false, isAuthenticated: true,
  })
  useCampaignStore.setState({ campaigns: [], isLoading: false, error: null })
  useCharacterStore.setState({ characters: [], isLoading: false, error: null })
})

describe('CampaignImportPage — upload stage', () => {
  it('renders the upload zone initially', () => {
    renderPage()
    expect(screen.getByText('Import Campaign Document')).toBeInTheDocument()
    expect(screen.getByText(/Drop a campaign document here/i)).toBeInTheDocument()
  })

  it('does not render the wizard before a file is uploaded', () => {
    renderPage()
    expect(screen.queryByLabelText('Campaign Title')).not.toBeInTheDocument()
  })

  it('has a link back to the campaign library', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Back to Campaigns/i })).toHaveAttribute('href', '/campaigns')
  })
})

describe('CampaignImportPage — upload to review handoff', () => {
  it('transitions to the wizard review step after a file is parsed', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('campaign.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByText('Untitled Campaign')).toBeInTheDocument())
  })

  it('shows the provider name and honest notes banner after parsing', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('my-campaign-bible.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByText('Manual Entry')).toBeInTheDocument())
    expect(screen.getByText(/my-campaign-bible\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
  })

  it('no longer shows the upload zone once a file has been parsed', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('campaign.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByText('Untitled Campaign')).toBeInTheDocument())
    expect(screen.queryByText(/Drop a campaign document here/i)).not.toBeInTheDocument()
  })

  it('lands directly on the Review step, not Title, after import', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('campaign.pdf', 'application/pdf'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Campaign Title')).not.toBeInTheDocument()
  })

  it('accepts a DOCX campaign document', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('campaign.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))

    await waitFor(() => expect(screen.getByText('Untitled Campaign')).toBeInTheDocument())
  })

  it('rejects an unsupported file type via drag-and-drop and stays on the upload stage', async () => {
    renderPage()
    const dropZone = screen.getByRole('button', { name: /Upload a campaign document/i })
    fireEvent.drop(dropZone, { dataTransfer: { files: [makeFile('campaign.png', 'image/png')] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported file type/i)
    expect(screen.getByText(/Drop a campaign document here/i)).toBeInTheDocument()
  })
})

describe('CampaignImportPage — save path reuses the real creation flow', () => {
  it('a campaign still requires a character to be selected — Create Campaign is blocked without one, same as manual creation', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('campaign.pdf', 'application/pdf'))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }))

    expect(await screen.findByText(/resolve the issues listed above/i)).toBeInTheDocument()
    expect(createCampaignMock).not.toHaveBeenCalled()
  })

  it('calling Create Campaign from the imported review step invokes the real createCampaign service once title and character are both set', async () => {
    createCampaignMock.mockResolvedValue(MOCK_CAMPAIGN)
    listCharactersMock.mockResolvedValue([MOCK_CHARACTER])
    const user = userEvent.setup()
    renderPage()
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, makeFile('campaign.pdf', 'application/pdf'))

    // Arrives on Review with neither a title nor a character assigned —
    // the manual-entry provider extracts nothing, so both are real gaps a
    // player must fill in, exactly like starting the wizard from scratch.
    await waitFor(() => expect(screen.getByText(/Needs Attention/i)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^Title:/ }))
    await user.type(screen.getByLabelText('Campaign Title'), 'Imported Campaign')
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> premise
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> tone
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> difficulty
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> rules_style
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> character
    useCharacterStore.setState({ characters: [MOCK_CHARACTER], isLoading: false, error: null })
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    await user.click(screen.getByText('Aldric Sorn'))
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> director
    await user.click(screen.getByRole('button', { name: 'Next' })) // -> review

    await user.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledOnce())
  })
})
