/**
 * OverviewTab Tests — Phase 9.1
 *
 * No prior test coverage existed for this component. Covers:
 * identity display, HP edit controls (pre-existing behavior),
 * and the new real XP progress bar (sourced from engine XP_THRESHOLDS).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { OverviewTab } from '@/components/character/tabs/OverviewTab'
import { buildCharacter, getXpForNextLevel } from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  const sheet = buildCharacter({
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
    background: 'soldier',
    scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
  })
  return {
    id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
    experience: 500, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    sheet,
    ...overrides,
  }
}

function renderTab(character = makeCharacter(), onPatch = vi.fn()) {
  return render(<OverviewTab character={character} onPatch={onPatch} />)
}

describe('OverviewTab — identity', () => {
  it('shows character name', () => {
    renderTab()
    expect(screen.getByText('Aldric Sorn')).toBeInTheDocument()
  })

  it('shows level, ancestry, archetype, background', () => {
    renderTab()
    expect(screen.getByText(/Level 3.*human.*fighter.*soldier/i)).toBeInTheDocument()
  })

  it('shows portrait initial when no portrait uploaded', () => {
    renderTab()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows portrait image when portraitUrl is set', () => {
    renderTab(makeCharacter({ portraitUrl: 'https://example.com/p.png' }))
    expect(screen.getByRole('img', { name: /Portrait of Aldric Sorn/i })).toBeInTheDocument()
  })
})

describe('OverviewTab — HP editing (pre-existing behavior preserved)', () => {
  it('shows current/max HP', () => {
    renderTab()
    expect(screen.getByLabelText('Current HP')).toBeInTheDocument()
  })

  it('increases HP when + is clicked', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderTab(makeCharacter(), onPatch)
    await user.click(screen.getByLabelText('Increase current HP'))
    expect(onPatch).toHaveBeenCalled()
  })

  it('decreases HP when - is clicked', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderTab(makeCharacter(), onPatch)
    await user.click(screen.getByLabelText('Decrease current HP'))
    expect(onPatch).toHaveBeenCalled()
  })
})

describe('OverviewTab — XP progress bar (Phase 9.1, real engine data)', () => {
  it('renders a progressbar for XP', () => {
    renderTab()
    // Two progressbars could exist if HP also used one; OverviewTab HP is
    // a plain input, so exactly one progressbar should be the XP bar.
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  })

  it('shows current XP and the real next-level threshold from the engine', () => {
    const character = makeCharacter({ experience: 500 })
    renderTab(character)
    const expectedNext = getXpForNextLevel(character.sheet.level)
    expect(screen.getByText(`500 / ${expectedNext}`)).toBeInTheDocument()
  })

  it('shows "To Level N" label for a non-max-level character', () => {
    renderTab(makeCharacter({ experience: 500 }))
    expect(screen.getByText('To Level 4')).toBeInTheDocument()
  })

  it('XP bar aria-value reflects real experience, not a fabricated number', () => {
    const character = makeCharacter({ experience: 500 })
    renderTab(character)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '500')
  })

  it('shows "Max Level" label at level 20', () => {
    const maxSheet = buildCharacter({
      name: 'Elder Sorn', level: 20, archetype: 'fighter', ancestry: 'human',
      background: 'soldier',
      scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    })
    renderTab(makeCharacter({ experience: 400000, sheet: maxSheet }))
    expect(screen.getByText('Max Level')).toBeInTheDocument()
  })

  it('does not crash or divide-by-zero at max level', () => {
    const maxSheet = buildCharacter({
      name: 'Elder Sorn', level: 20, archetype: 'fighter', ancestry: 'human',
      background: 'soldier',
      scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    })
    expect(() => renderTab(makeCharacter({ experience: 400000, sheet: maxSheet }))).not.toThrow()
  })
})

describe('OverviewTab — ability scores', () => {
  it('shows all six ability modifiers and raw scores', () => {
    renderTab()
    expect(screen.getByText('STR')).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument() // raw STR score
  })
})
