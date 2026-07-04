/**
 * Chronicle AI — CampaignWizard Tests
 * Phase 2.2
 *
 * Navigation through all 8 steps and final createCampaign() submission.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createCampaignMock = vi.fn()
const listCharactersMock = vi.fn().mockResolvedValue([])

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    createCampaign: (...args: unknown[]) => createCampaignMock(...args),
    listCharacters:  (...args: unknown[]) => listCharactersMock(...args),
  }
})

import { CampaignWizard } from '@/components/campaign/CampaignWizard'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import { useAuthStore } from '@/store/authStore'
import { useCharacterStore } from '@/store/characterStore'

const MOCK_CAMPAIGN = {
  id: 'camp-new', userId: 'user-1', title: 'The Shattered Throne', description: null,
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
    scores: { strength:16,dexterity:14,constitution:14,intelligence:10,wisdom:12,charisma:8 },
    modifiers: { strength:3,dexterity:2,constitution:2,intelligence:0,wisdom:1,charisma:-1 },
    hitDie: 'd10' as const, maxHp: 30, currentHp: 30, armorClass: 16, proficiencyBonus: 2,
    skillProficiencies: [], savingThrowProficiencies: [], equipment: [], conditions: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

function renderWizard(onCreated = vi.fn(), onCancel = vi.fn()) {
  return render(
    <MemoryRouter>
      <CampaignWizard userId="user-1" onCreated={onCreated} onCancel={onCancel} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  createCampaignMock.mockReset()
  listCharactersMock.mockReset()
  listCharactersMock.mockResolvedValue([])
  useAuthStore.setState({
    user: { id: 'user-1', email: 'test@chronicle.ai' } as never,
    isAuthenticated: true, isLoading: false, session: null,
  })
  useCharacterStore.setState({ characters: [], isLoading: false, error: null })
})

async function nextStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

describe('CampaignWizard — navigation', () => {
  it('starts on the Title step', () => {
    renderWizard()
    expect(screen.getByText('Name your campaign')).toBeInTheDocument()
  })

  it('Next is disabled when title is empty', () => {
    renderWizard()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('Next enables once a valid title is entered', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'The Shattered Throne')
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
  })

  it('advances through all steps in order reaching Review', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(screen.getByLabelText('Campaign Title'), 'The Shattered Throne')
    await nextStep(user) // -> premise
    expect(screen.getByText('Set the premise')).toBeInTheDocument()

    await nextStep(user) // -> tone
    expect(screen.getByText('Choose a tone')).toBeInTheDocument()

    await nextStep(user) // -> difficulty
    expect(screen.getByText('Choose a difficulty')).toBeInTheDocument()

    await nextStep(user) // -> rules style
    expect(screen.getByText('Choose a rules style')).toBeInTheDocument()

    await nextStep(user) // -> character
    expect(screen.getByText('Select your character')).toBeInTheDocument()
  })

  it('Back returns to the previous step', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    await nextStep(user)
    expect(screen.getByText('Set the premise')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Name your campaign')).toBeInTheDocument()
  })

  it('Back on the first step calls onCancel', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    renderWizard(vi.fn(), handleCancel)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(handleCancel).toHaveBeenCalledOnce()
  })

  it('completed step pills are navigable', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    await nextStep(user) // -> premise
    await nextStep(user) // -> tone
    // Click the '1 Title' step pill to jump back
    await user.click(screen.getByRole('button', { name: /1.*Title/ }))
    expect(screen.getByText('Name your campaign')).toBeInTheDocument()
  })
})

describe('CampaignWizard — tone selection', () => {
  it('displays all four tone options', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    await nextStep(user) // premise
    await nextStep(user) // tone
    expect(screen.getByText('Heroic')).toBeInTheDocument()
    expect(screen.getByText('Grim')).toBeInTheDocument()
    expect(screen.getByText('Mysterious')).toBeInTheDocument()
    expect(screen.getByText('Comedic')).toBeInTheDocument()
  })

  it('tone step is valid by default so Next is not blocked', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    await nextStep(user)
    await nextStep(user)
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
  })
})

describe('CampaignWizard — character step', () => {
  it('shows empty state when user has no characters', async () => {
    const user = userEvent.setup()
    listCharactersMock.mockResolvedValue([])
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    // Advance to character step (step 6: title→premise→tone→difficulty→rules_style→character)
    for (let i = 0; i < 4; i++) await nextStep(user)
    await nextStep(user) // character step
    await waitFor(() => expect(screen.getByText("You don't have any characters yet.")).toBeInTheDocument())
  })

  it('lists available characters', async () => {
    const user = userEvent.setup()
    listCharactersMock.mockResolvedValue([MOCK_CHARACTER])
    useCharacterStore.setState({ characters: [MOCK_CHARACTER], isLoading: false, error: null })
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    for (let i = 0; i < 4; i++) await nextStep(user)
    await nextStep(user)
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
  })

  it('selecting a character enables advancing past the character step', async () => {
    const user = userEvent.setup()
    // Seed both store and mock so fetchCharacters does not overwrite the state
    listCharactersMock.mockResolvedValue([MOCK_CHARACTER])
    useCharacterStore.setState({ characters: [MOCK_CHARACTER], isLoading: false, error: null })
    renderWizard()
    await user.type(screen.getByLabelText('Campaign Title'), 'Test')
    for (let i = 0; i < 4; i++) await nextStep(user)
    await nextStep(user) // now on character step, Next should be disabled
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    await user.click(screen.getByText('Aldric Sorn'))
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
  })
})

describe('CampaignWizard — submission', () => {
  async function advanceToReview(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Campaign Title'), 'The Shattered Throne')
    for (let i = 0; i < 4; i++) await nextStep(user)   // premise, tone, difficulty, rules_style
    // Character step: select then advance
    await nextStep(user) // character step
    useCharacterStore.setState({ characters: [MOCK_CHARACTER], isLoading: false, error: null })
    await waitFor(() => expect(screen.getByText('Aldric Sorn')).toBeInTheDocument())
    await user.click(screen.getByText('Aldric Sorn'))
    await nextStep(user) // director
    await nextStep(user) // review
  }

  it('calls createCampaign with userId and title on submit', async () => {
    createCampaignMock.mockResolvedValue(MOCK_CAMPAIGN)
    const user = userEvent.setup()
    renderWizard()
    await advanceToReview(user)
    expect(screen.getByText('Review your campaign')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledOnce())
    const arg = createCampaignMock.mock.calls[0][0]
    expect(arg.userId).toBe('user-1')
    expect(arg.title).toBe('The Shattered Throne')
  })

  it('calls onCreated with the new campaign on success', async () => {
    createCampaignMock.mockResolvedValue(MOCK_CAMPAIGN)
    const user = userEvent.setup()
    const handleCreated = vi.fn()
    renderWizard(handleCreated)
    await advanceToReview(user)
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(handleCreated).toHaveBeenCalledWith(MOCK_CAMPAIGN))
  })

  it('shows an error message when createCampaign fails', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    createCampaignMock.mockRejectedValue(new ServiceError('Title already in use.', 'VALIDATION'))
    const user = userEvent.setup()
    renderWizard()
    await advanceToReview(user)
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(screen.getByText('Title already in use.')).toBeInTheDocument())
  })
})

describe('CampaignWizard — initialDraft / initialStep (Phase 10.2 import handoff)', () => {
  it('seeds the draft from initialDraft', async () => {
    render(
      <MemoryRouter>
        <CampaignWizard userId="user-1" onCreated={vi.fn()} initialDraft={{ title: 'Imported Campaign' }} />
      </MemoryRouter>,
    )
    // Default initialStep is 'title' when not specified
    expect(screen.getByLabelText(/Campaign Title/i)).toHaveValue('Imported Campaign')
  })

  it('starts on the given initialStep rather than title', async () => {
    render(
      <MemoryRouter>
        <CampaignWizard
          userId="user-1"
          onCreated={vi.fn()}
          initialDraft={{ title: 'Imported Campaign' }}
          initialStep="review"
        />
      </MemoryRouter>,
    )
    // Review-step-only signal: the "Create Campaign" action button
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeInTheDocument())
    expect(screen.queryByLabelText(/Campaign Title/i)).not.toBeInTheDocument()
  })

  it('shows the imported title (read-only) on the Review step, not "Untitled Campaign"', async () => {
    render(
      <MemoryRouter>
        <CampaignWizard
          userId="user-1"
          onCreated={vi.fn()}
          initialDraft={{ title: 'Imported Campaign' }}
          initialStep="review"
        />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Imported Campaign')).toBeInTheDocument())
    expect(screen.queryByText('Untitled Campaign')).not.toBeInTheDocument()
  })

  it('defaults to the title step when initialStep is omitted', () => {
    render(
      <MemoryRouter>
        <CampaignWizard userId="user-1" onCreated={vi.fn()} initialDraft={{ title: 'Imported Campaign' }} />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText(/Campaign Title/i)).toBeInTheDocument()
  })

  it('saving from an imported draft calls createCampaign with the imported values', async () => {
    createCampaignMock.mockResolvedValue(MOCK_CAMPAIGN)
    const user = userEvent.setup()
    const handleCreated = vi.fn()
    render(
      <MemoryRouter>
        <CampaignWizard
          userId="user-1"
          onCreated={handleCreated}
          initialDraft={{
            title: 'Imported Campaign', premise: 'A kingdom in turmoil.',
            characterId: 'char-1', characterName: 'Aldric Sorn',
          }}
          initialStep="review"
        />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledOnce())
    const arg = createCampaignMock.mock.calls[0][0]
    expect(arg.title).toBe('Imported Campaign')
    expect(handleCreated).toHaveBeenCalledOnce()
  })
})
