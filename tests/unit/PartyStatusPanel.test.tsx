/**
 * PartyStatusPanel Tests — Phase 11.5 (Adventure Hub redesign)
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PartyStatusPanel } from '@/components/adventure/PartyStatusPanel'
import type { CharacterRecord, NarrativeTurn } from '@/lib/supabase'

const MOCK_CHARACTER: CharacterRecord = {
  id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '', experience: 350,
  tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
  conditions: [], features: [], inventory: [], spells: {},
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  sheet: {
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
    background: 'soldier',
    scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    modifiers: { strength: 3, dexterity: 2, constitution: 2, intelligence: 0, wisdom: 1, charisma: -1 },
    hitDie: 'd10', maxHp: 30, currentHp: 22, armorClass: 16, proficiencyBonus: 2,
    skillProficiencies: ['perception'], savingThrowProficiencies: [], equipment: [],
    conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
  },
}

function makeTurn(overrides: Partial<NarrativeTurn> = {}): NarrativeTurn {
  return {
    id: 't1', sessionId: 'sess-1', turnNumber: 1, playerInput: 'I look around.',
    aiNarration: 'You see a quiet clearing.', diceRolls: [],
    mode: 'exploration', createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPanel(props: Partial<React.ComponentProps<typeof PartyStatusPanel>> = {}) {
  return render(
    <PartyStatusPanel
      character={MOCK_CHARACTER}
      turns={[]}
      onViewJournal={vi.fn()}
      {...props}
    />,
  )
}

describe('PartyStatusPanel — rendering', () => {
  it('renders the panel container', () => {
    renderPanel()
    expect(screen.getByTestId('party-status-panel')).toBeInTheDocument()
  })

  it('renders the character name', () => {
    renderPanel()
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
  })

  it('renders the character level, ancestry, and archetype', () => {
    renderPanel()
    expect(screen.getByText(/Lv 3 human fighter/i)).toBeInTheDocument()
  })

  it('renders a portrait placeholder when no portraitUrl is set', () => {
    renderPanel()
    const portrait = screen.getByTestId('party-portrait')
    expect(portrait).toHaveTextContent('A')
  })

  it('renders the real portrait image when portraitUrl is set', () => {
    renderPanel({ character: { ...MOCK_CHARACTER, portraitUrl: 'https://example.com/portrait.png' } })
    const img = screen.getByAltText('Portrait of Aldric Sorn')
    expect(img).toHaveAttribute('src', 'https://example.com/portrait.png')
  })
})

describe('PartyStatusPanel — HP bar (real data)', () => {
  it('shows the real current/max HP values', () => {
    renderPanel()
    expect(screen.getByText('22 / 30')).toBeInTheDocument()
  })

  it('renders an accessible HP progressbar with the real values', () => {
    renderPanel()
    const bars = screen.getAllByRole('progressbar')
    const hpBar = bars.find((b) => b.getAttribute('aria-label') === 'Hit points')
    expect(hpBar).toHaveAttribute('aria-valuenow', '22')
    expect(hpBar).toHaveAttribute('aria-valuemax', '30')
  })
})

describe('PartyStatusPanel — XP bar (real experience + real engine thresholds)', () => {
  it('renders a real, non-crashing XP progressbar', () => {
    renderPanel()
    const bars = screen.getAllByRole('progressbar')
    const xpBar = bars.find((b) => b.getAttribute('aria-label') === 'Experience progress')
    expect(xpBar).toBeInTheDocument()
    expect(Number(xpBar?.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0)
  })

  it('shows "Max Level" instead of a fraction when the character is level 20', () => {
    renderPanel({
      character: { ...MOCK_CHARACTER, sheet: { ...MOCK_CHARACTER.sheet, level: 20 }, experience: 400000 },
    })
    expect(screen.getByText('Max Level')).toBeInTheDocument()
  })

  it('shows a real fraction (not "Max Level") for a non-max-level character', () => {
    renderPanel()
    expect(screen.queryByText('Max Level')).not.toBeInTheDocument()
  })
})

describe('PartyStatusPanel — recent events (real turns, not a fabricated feed)', () => {
  it('shows the honest empty state when there are no turns yet', () => {
    renderPanel({ turns: [] })
    expect(screen.getByTestId('recent-events-empty')).toBeInTheDocument()
  })

  it('shows real turn content when turns exist', () => {
    renderPanel({ turns: [makeTurn({ playerInput: 'I check the door.' })] })
    expect(screen.getByText(/I check the door\./)).toBeInTheDocument()
  })

  it('shows the most recent turns first', () => {
    renderPanel({
      turns: [
        makeTurn({ id: 't1', turnNumber: 1, playerInput: 'First action' }),
        makeTurn({ id: 't2', turnNumber: 2, playerInput: 'Second action' }),
      ],
    })
    const list = screen.getByTestId('recent-events-list')
    const items = list.querySelectorAll('li')
    expect(items[0]).toHaveTextContent('Second action')
  })

  it('caps the recent events list rather than showing every turn', () => {
    const manyTurns = Array.from({ length: 10 }, (_, i) =>
      makeTurn({ id: `t${i}`, turnNumber: i, playerInput: `Action ${i}` }))
    renderPanel({ turns: manyTurns })
    const list = screen.getByTestId('recent-events-list')
    expect(list.querySelectorAll('li').length).toBeLessThan(10)
  })
})

describe('PartyStatusPanel — View Full Journal', () => {
  it('renders the View Full Journal button', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /View Full Journal/i })).toBeInTheDocument()
  })

  it('calls onViewJournal when clicked', async () => {
    const user = userEvent.setup()
    const onViewJournal = vi.fn()
    renderPanel({ onViewJournal })
    await user.click(screen.getByRole('button', { name: /View Full Journal/i }))
    expect(onViewJournal).toHaveBeenCalledOnce()
  })
})
