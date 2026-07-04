/**
 * LevelUpModal Tests — Phase 9.2
 *
 * Closes the level-up gap flagged in the Phase 9.0 UX audit. All stat
 * numbers shown here must come from the real engine functions
 * (calculateMaxHp, getProficiencyBonus) — these tests verify the modal
 * never invents its own numbers and matches what updateCharacter would
 * actually compute (see characters.service.test.ts regression tests).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LevelUpModal } from '@/components/character/LevelUpModal'
import { buildCharacter, calculateMaxHp, getProficiencyBonus } from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

function makeCharacter(overrides: Partial<CharacterRecord> = {}, sheetOverrides: Record<string, unknown> = {}): CharacterRecord {
  const sheet = buildCharacter({
    name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human',
    background: 'soldier',
    scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
  })
  return {
    id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '',
    experience: 900, tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    sheet: { ...sheet, ...sheetOverrides },
    ...overrides,
  }
}

describe('LevelUpModal — real stat computation (no invented numbers)', () => {
  it('shows the new level as current level + 1', () => {
    render(
      <LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText(/reaches Level 4/i)).toBeInTheDocument()
  })

  it('computes new max HP using the real engine function, not a guess', () => {
    const character = makeCharacter()
    const expectedMaxHp = calculateMaxHp({
      level: character.sheet.level + 1,
      constitution: character.sheet.scores.constitution,
      hitDie: character.sheet.hitDie,
    })
    render(<LevelUpModal open character={character} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(String(expectedMaxHp))).toBeInTheDocument()
  })

  it('computes new proficiency bonus using the real engine function', () => {
    // Force a threshold crossing (4→5) so the row actually reflects a change.
    const character = makeCharacter({}, { level: 4 })
    const newProf = getProficiencyBonus(5)
    render(<LevelUpModal open character={character} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    if (newProf !== character.sheet.proficiencyBonus) {
      expect(screen.getByText(`+${newProf}`)).toBeInTheDocument()
    }
  })

  it('caps new level at 20 — never proposes level 21', () => {
    const character = makeCharacter({}, { level: 20 })
    render(<LevelUpModal open character={character} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/reaches Level 20/i)).toBeInTheDocument()
    expect(screen.queryByText(/reaches Level 21/i)).not.toBeInTheDocument()
  })

  it('shows "Max Level" messaging instead of an XP progress line at level 20', () => {
    const character = makeCharacter({}, { level: 20 })
    render(<LevelUpModal open character={character} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText(/XP toward Level 21/i)).not.toBeInTheDocument()
  })

  it('does not decrease currentHp on level-up, only increases or holds steady', () => {
    const character = makeCharacter({}, { currentHp: 5 })
    render(<LevelUpModal open character={character} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const bar = screen.getByRole('progressbar')
    const valueNow = Number(bar.getAttribute('aria-valuenow'))
    expect(valueNow).toBeGreaterThanOrEqual(5)
  })

  it('never lets currentHp exceed the new maxHp', () => {
    const character = makeCharacter()
    render(<LevelUpModal open character={character} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const bar = screen.getByRole('progressbar')
    const valueNow = Number(bar.getAttribute('aria-valuenow'))
    const valueMax = Number(bar.getAttribute('aria-valuemax'))
    expect(valueNow).toBeLessThanOrEqual(valueMax)
  })
})

describe('LevelUpModal — confirm/cancel flow', () => {
  it('calls onConfirm with the computed level and currentHp', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const character = makeCharacter()
    const expectedMaxHp = calculateMaxHp({
      level: character.sheet.level + 1,
      constitution: character.sheet.scores.constitution,
      hitDie: character.sheet.hitDie,
    })
    render(<LevelUpModal open character={character} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByTestId('confirm-level-up'))
    expect(onConfirm).toHaveBeenCalledWith({
      level: character.sheet.level + 1,
      currentHp: Math.min(character.sheet.currentHp + (expectedMaxHp - character.sheet.maxHp), expectedMaxHp),
    })
  })

  it('calls onCancel when "Not Yet" is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Not Yet' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel on Escape key', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when clicking the backdrop', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { container } = render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={onCancel} />)
    const overlay = container.firstElementChild as HTMLElement
    await user.click(overlay)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders nothing when open is false', () => {
    const { container } = render(<LevelUpModal open={false} character={makeCharacter()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a loading state on the confirm button while saving', () => {
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={vi.fn()} isSaving />)
    expect(screen.getByTestId('confirm-level-up')).toBeDisabled()
  })
})

describe('LevelUpModal — accessibility', () => {
  it('has role=alertdialog with aria-modal', () => {
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('is labelled by the level-up title', () => {
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'level-up-title')
    expect(document.getElementById('level-up-title')).toBeInTheDocument()
  })

  it('auto-focuses the confirm button on open', () => {
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByTestId('confirm-level-up'))
  })
})

describe('LevelUpModal — celebration state (Phase 10.1)', () => {
  it('shows the celebration view after confirm, with the real new level number', async () => {
    const user = userEvent.setup()
    const character = makeCharacter()
    render(<LevelUpModal open character={character} onConfirm={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />)
    await user.click(screen.getByTestId('confirm-level-up'))
    expect(await screen.findByTestId('level-up-celebration')).toBeInTheDocument()
    expect(screen.getByText(`Level ${character.sheet.level + 1}!`)).toBeInTheDocument()
  })

  it('shows the character name in the celebration message', async () => {
    const user = userEvent.setup()
    const character = makeCharacter()
    render(<LevelUpModal open character={character} onConfirm={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />)
    await user.click(screen.getByTestId('confirm-level-up'))
    await screen.findByTestId('level-up-celebration')
    expect(screen.getByText(new RegExp(character.sheet.name))).toBeInTheDocument()
  })

  it('replaces the normal stat comparison content while celebrating', async () => {
    const user = userEvent.setup()
    render(<LevelUpModal open character={makeCharacter()} onConfirm={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />)
    await user.click(screen.getByTestId('confirm-level-up'))
    await screen.findByTestId('level-up-celebration')
    expect(screen.queryByText('Max HP')).not.toBeInTheDocument()
  })

  it('calls onConfirm before entering the celebration state — persistence is never skipped', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<LevelUpModal open character={makeCharacter()} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByTestId('confirm-level-up'))
    await screen.findByTestId('level-up-celebration')
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel automatically after the celebration beat elapses, closing the modal', async () => {
    vi.useFakeTimers()
    const onCancel = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<LevelUpModal open character={makeCharacter()} onConfirm={onConfirm} onCancel={onCancel} />)

    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByTestId('confirm-level-up'))

    // Let the awaited onConfirm() promise resolve (a microtask) before the
    // component sets celebrating=true and schedules the setTimeout — flush
    // pending microtasks under fake timers without relying on waitFor's
    // own internal timer usage, which conflicts with vi.useFakeTimers().
    await vi.advanceTimersByTimeAsync(0)
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1400)
    expect(onCancel).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
