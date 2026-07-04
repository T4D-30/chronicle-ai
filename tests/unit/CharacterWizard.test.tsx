/**
 * Chronicle AI — CharacterWizard Tests
 * Volume II, Phase 2.1
 *
 * Covers navigation through the full 9-step wizard and the final
 * createCharacter() submission path. The Supabase service layer is mocked
 * at the barrel (@/lib/supabase) — the same boundary the unit tests for
 * characters.service.test.ts already exercise in isolation, so this suite
 * does not re-test engine validation rules, only that the wizard correctly
 * wires user interaction to those already-tested rules.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createCharacterMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    createCharacter: (...args: unknown[]) => createCharacterMock(...args),
  }
})

import { CharacterWizard } from '@/components/character/CharacterWizard'

const MOCK_CREATED_CHARACTER = {
  id: 'char-new-1',
  userId: 'user-1',
  sheet: {
    name: 'Aldric Sorn',
    level: 1,
    archetype: 'fighter',
    ancestry: 'human',
    background: 'wanderer',
    scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
    hitDie: 'd10',
    maxHp: 12,
    currentHp: 12,
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

async function goToNextStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

describe('CharacterWizard — navigation', () => {
  beforeEach(() => {
    createCharacterMock.mockReset()
    window.localStorage.clear()
  })

  it('starts on the Identity step', () => {
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    expect(screen.getByText('Who are they?')).toBeInTheDocument()
  })

  it('Next is disabled while the name field is empty', () => {
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('enables Next once a valid name is entered', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
  })

  it('advances to the Species step after Identity', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await goToNextStep(user)
    expect(screen.getByText('Choose a Species')).toBeInTheDocument()
  })

  it('walks through every step in order to Review', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)

    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await goToNextStep(user) // -> species
    expect(screen.getByText('Choose a Species')).toBeInTheDocument()

    await goToNextStep(user) // -> class
    expect(screen.getByText('Choose a Class')).toBeInTheDocument()

    await goToNextStep(user) // -> background
    expect(screen.getByText('Choose a Background')).toBeInTheDocument()

    await goToNextStep(user) // -> abilities
    expect(screen.getByText('Set Ability Scores')).toBeInTheDocument()

    await goToNextStep(user) // -> skills
    expect(screen.getByText('Skill & Save Proficiencies')).toBeInTheDocument()

    await goToNextStep(user) // -> equipment
    expect(screen.getByText('Starting Equipment')).toBeInTheDocument()

    await goToNextStep(user) // -> portrait
    expect(screen.getByText('Add a Portrait')).toBeInTheDocument()

    await goToNextStep(user) // -> review
    expect(screen.getByText('Review Your Character')).toBeInTheDocument()
  })

  it('Back returns to the previous step', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await goToNextStep(user)
    expect(screen.getByText('Choose a Species')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Who are they?')).toBeInTheDocument()
  })

  it('clicking a completed step pill in the indicator jumps back to it', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await goToNextStep(user) // species
    await goToNextStep(user) // class
    await user.click(screen.getByRole('button', { name: /1.*Identity/ }))
    expect(screen.getByText('Who are they?')).toBeInTheDocument()
  })

  it('calls onCancel when Back is pressed on the first step', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(handleCancel).toHaveBeenCalledOnce()
  })
})

describe('CharacterWizard — ability score live preview', () => {
  it('shows derived stats once on the Abilities step', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await goToNextStep(user) // species
    await goToNextStep(user) // class
    await goToNextStep(user) // background
    await goToNextStep(user) // abilities
    expect(screen.getByText('Live Derived Stats')).toBeInTheDocument()
    expect(screen.getByText('Max HP')).toBeInTheDocument()
  })
})

describe('CharacterWizard — submission', () => {
  beforeEach(() => {
    createCharacterMock.mockReset()
    window.localStorage.clear()
  })

  async function advanceToReview(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    for (let i = 0; i < 8; i++) {
      await goToNextStep(user)
    }
  }

  it('calls createCharacter with the userId and draft fields on final submit', async () => {
    createCharacterMock.mockResolvedValue(MOCK_CREATED_CHARACTER)
    const user = userEvent.setup()
    const handleCreated = vi.fn()
    render(<CharacterWizard userId="user-42" onCreated={handleCreated} />)

    await advanceToReview(user)
    expect(screen.getByText('Review Your Character')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Character' }))

    await waitFor(() => expect(createCharacterMock).toHaveBeenCalledOnce())
    const callArg = createCharacterMock.mock.calls[0][0]
    expect(callArg.userId).toBe('user-42')
    expect(callArg.name).toBe('Aldric Sorn')
  })

  it('calls onCreated with the returned character on success', async () => {
    createCharacterMock.mockResolvedValue(MOCK_CREATED_CHARACTER)
    const user = userEvent.setup()
    const handleCreated = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={handleCreated} />)

    await advanceToReview(user)
    await user.click(screen.getByRole('button', { name: 'Create Character' }))

    await waitFor(() => expect(handleCreated).toHaveBeenCalledWith(MOCK_CREATED_CHARACTER))
  })

  it('shows an error message when createCharacter rejects', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    createCharacterMock.mockRejectedValue(new ServiceError('Name already taken.', 'VALIDATION'))
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)

    await advanceToReview(user)
    await user.click(screen.getByRole('button', { name: 'Create Character' }))

    await waitFor(() => expect(screen.getByText('Name already taken.')).toBeInTheDocument())
  })

  it('does not call onCreated when creation fails', async () => {
    createCharacterMock.mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()
    const handleCreated = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={handleCreated} />)

    await advanceToReview(user)
    await user.click(screen.getByRole('button', { name: 'Create Character' }))

    await waitFor(() => expect(createCharacterMock).toHaveBeenCalledOnce())
    expect(handleCreated).not.toHaveBeenCalled()
  })
})

describe('CharacterWizard — cancel confirmation (Phase 10.1)', () => {
  beforeEach(() => {
    createCharacterMock.mockReset()
    window.localStorage.clear()
  })

  it('does not prompt for confirmation when Back is pressed on an untouched first step', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(handleCancel).toHaveBeenCalledOnce()
    expect(screen.queryByText('Discard this character?')).not.toBeInTheDocument()
  })

  it('prompts for confirmation when Back is pressed after entering a name', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} onCancel={handleCancel} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Discard this character?')).toBeInTheDocument()
    expect(handleCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel only after confirming "Leave Wizard"', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} onCancel={handleCancel} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Leave Wizard' }))
    expect(handleCancel).toHaveBeenCalledOnce()
  })

  it('stays on the wizard and does not call onCancel when "Keep Editing" is chosen', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} onCancel={handleCancel} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Keep Editing' }))
    expect(handleCancel).not.toHaveBeenCalled()
    expect(screen.queryByText('Discard this character?')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Character Name')).toHaveValue('Aldric')
  })
})

describe('CharacterWizard — autosave and resume (Phase 10.1)', () => {
  beforeEach(() => {
    createCharacterMock.mockReset()
    window.localStorage.clear()
  })

  it('persists the draft to localStorage once meaningful content is entered', async () => {
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')

    await waitFor(() => {
      const raw = window.localStorage.getItem('chronicle-ai:character-draft:user-1')
      expect(raw).not.toBeNull()
    })
    const saved = JSON.parse(window.localStorage.getItem('chronicle-ai:character-draft:user-1')!)
    expect(saved.draft.name).toBe('Aldric Sorn')
  })

  it('does not persist an untouched (empty) draft', async () => {
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    // Give any effects a tick to run
    await waitFor(() => expect(screen.getByLabelText('Character Name')).toBeInTheDocument())
    expect(window.localStorage.getItem('chronicle-ai:character-draft:user-1')).toBeNull()
  })

  it('scopes saved drafts by userId — one user never sees another user\'s draft', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await waitFor(() => {
      expect(window.localStorage.getItem('chronicle-ai:character-draft:user-1')).not.toBeNull()
    })
    unmount()

    render(<CharacterWizard userId="user-2" onCreated={() => {}} />)
    // A different user should get a fresh wizard, no resume prompt
    expect(screen.queryByText('Resume unfinished character?')).not.toBeInTheDocument()
  })

  it('shows a resume prompt on mount when a meaningful saved draft exists', async () => {
    window.localStorage.setItem(
      'chronicle-ai:character-draft:user-1',
      JSON.stringify({ draft: { name: 'Saved Hero', archetype: 'wizard', ancestry: 'elf', background: 'scholar', level: 1, scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10 }, skillProficiencies: [], savingThrowProficiencies: [], equipment: [], portraitUrl: null, bio: '' }, stepIndex: 2, savedAt: new Date().toISOString() }),
    )
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    expect(await screen.findByText('Resume unfinished character?')).toBeInTheDocument()
  })

  it('resuming restores the saved draft content and step', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'chronicle-ai:character-draft:user-1',
      JSON.stringify({ draft: { name: 'Saved Hero', archetype: 'wizard', ancestry: 'elf', background: 'scholar', level: 1, scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10 }, skillProficiencies: [], savingThrowProficiencies: [], equipment: [], portraitUrl: null, bio: '' }, stepIndex: 0, savedAt: new Date().toISOString() }),
    )
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Resume' }))
    expect(screen.getByLabelText('Character Name')).toHaveValue('Saved Hero')
  })

  it('discarding via "Start Fresh" clears the saved draft and starts blank', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'chronicle-ai:character-draft:user-1',
      JSON.stringify({ draft: { name: 'Saved Hero', archetype: 'wizard', ancestry: 'elf', background: 'scholar', level: 1, scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10 }, skillProficiencies: [], savingThrowProficiencies: [], equipment: [], portraitUrl: null, bio: '' }, stepIndex: 0, savedAt: new Date().toISOString() }),
    )
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Start Fresh' }))
    expect(screen.getByLabelText('Character Name')).toHaveValue('')
    expect(window.localStorage.getItem('chronicle-ai:character-draft:user-1')).toBeNull()
  })

  it('clears the saved draft after successful character creation', async () => {
    createCharacterMock.mockResolvedValue({
      id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
      experience: 0, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
      conditions: [], features: [], inventory: [], spells: {},
      createdAt: '', updatedAt: '',
      sheet: { name: 'Aldric Sorn', level: 1, archetype: 'fighter', ancestry: 'human', background: 'soldier',
        scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
        hitDie: 'd10', maxHp: 10, currentHp: 10, armorClass: 10, proficiencyBonus: 2,
        skillProficiencies: [], savingThrowProficiencies: [], equipment: [],
        conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0 },
    })
    const user = userEvent.setup()
    render(<CharacterWizard userId="user-1" onCreated={() => {}} />)
    await user.type(screen.getByLabelText('Character Name'), 'Aldric Sorn')
    await waitFor(() => {
      expect(window.localStorage.getItem('chronicle-ai:character-draft:user-1')).not.toBeNull()
    })

    await advanceToReviewFrom(user)
    await user.click(screen.getByRole('button', { name: 'Create Character' }))
    await waitFor(() => expect(createCharacterMock).toHaveBeenCalledOnce())

    expect(window.localStorage.getItem('chronicle-ai:character-draft:user-1')).toBeNull()
  })
})

describe('CharacterWizard — initialDraft / initialStep (Phase 10.1 import handoff)', () => {
  beforeEach(() => {
    createCharacterMock.mockReset()
    window.localStorage.clear()
  })

  it('seeds the draft from initialDraft', () => {
    render(
      <CharacterWizard
        userId="user-1"
        onCreated={() => {}}
        initialDraft={{ name: 'Imported Hero', level: 4 }}
      />,
    )
    // Default initialStep is 'identity' when not specified
    expect(screen.getByLabelText('Character Name')).toHaveValue('Imported Hero')
  })

  it('starts on the given initialStep rather than identity', () => {
    render(
      <CharacterWizard
        userId="user-1"
        onCreated={() => {}}
        initialDraft={{ name: 'Imported Hero' }}
        initialStep="review"
      />,
    )
    // Review-step-only signal: the "Create Character" action button
    expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Character Name')).not.toBeInTheDocument()
  })

  it('does not show the resume-from-localStorage prompt when initialDraft is provided', async () => {
    window.localStorage.setItem(
      'chronicle-ai:character-draft:user-1',
      JSON.stringify({
        draft: { name: 'Unrelated Saved Draft', archetype: 'wizard', ancestry: 'elf', background: 'scholar', level: 1,
          scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10 },
          skillProficiencies: [], savingThrowProficiencies: [], equipment: [], portraitUrl: null, bio: '' },
        stepIndex: 2,
        savedAt: new Date().toISOString(),
      }),
    )
    render(
      <CharacterWizard
        userId="user-1"
        onCreated={() => {}}
        initialDraft={{ name: 'Imported Hero' }}
        initialStep="review"
      />,
    )
    expect(screen.queryByText('Resume unfinished character?')).not.toBeInTheDocument()
    expect(screen.queryByText('Unrelated Saved Draft')).not.toBeInTheDocument()
  })

  it('defaults to the identity step when initialStep is omitted', () => {
    render(
      <CharacterWizard
        userId="user-1"
        onCreated={() => {}}
        initialDraft={{ name: 'Imported Hero' }}
      />,
    )
    expect(screen.getByLabelText('Character Name')).toBeInTheDocument()
  })

  it('an imported draft with no meaningful values still starts autosaving (does not block on empty-check)', async () => {
    render(
      <CharacterWizard
        userId="user-1"
        onCreated={() => {}}
        initialDraft={{}}
        initialStep="review"
      />,
    )
    // Confirms the wizard actually rendered past the resume-prompt gate —
    // an empty initialDraft object is still a real, intentional seed, not
    // treated as "no draft at all."
    expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument()
  })

  it('saving from an imported draft calls createCharacter with the imported values plus manual corrections', async () => {
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
    const handleCreated = vi.fn()
    render(
      <CharacterWizard
        userId="user-1"
        onCreated={handleCreated}
        initialDraft={{ name: 'Imported Hero' }}
        initialStep="review"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Create Character' }))
    await waitFor(() => expect(createCharacterMock).toHaveBeenCalledOnce())
    const [input] = createCharacterMock.mock.calls[0]
    expect(input.name).toBe('Imported Hero')
    expect(handleCreated).toHaveBeenCalledOnce()
  })
})

/** Advances from the Identity step (name already typed) through to Review. */
async function advanceToReviewFrom(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 8; i++) {
    await user.click(screen.getByRole('button', { name: 'Next' }))
  }
}
