/**
 * DicePanel Tests — Phase 2.3
 *
 * Covers: die buttons, mode toggles, modifier input, DC quick-set,
 * roll history rendering, and clear history.
 * Uses the real dice engine — no mocking of rollDie/rollD20.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { DicePanel } from '@/components/adventure/DicePanel'
import { ALL_DICE } from '@/lib/engine'

function renderPanel() {
  return render(<DicePanel />)
}

describe('DicePanel — initial state', () => {
  it('renders a button for every die in ALL_DICE', () => {
    renderPanel()
    for (const die of ALL_DICE) {
      expect(screen.getByRole('button', { name: die })).toBeInTheDocument()
    }
  })

  it('starts in "normal" roll mode', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'normal' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'advantage' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'disadvantage' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows empty roll history message initially', () => {
    renderPanel()
    expect(screen.getByText(/No rolls yet/i)).toBeInTheDocument()
  })

  it('does not show Clear button when history is empty', () => {
    renderPanel()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('renders all 5 DC quick-set buttons', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /Trivial 5/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Easy 10/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Medium 15/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hard 20/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Legendary 25/i })).toBeInTheDocument()
  })
})

describe('DicePanel — mode switching', () => {
  it('switches to advantage mode', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'advantage' }))
    expect(screen.getByRole('button', { name: 'advantage' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'normal' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to disadvantage mode', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'disadvantage' }))
    expect(screen.getByRole('button', { name: 'disadvantage' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches back to normal from advantage', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'advantage' }))
    await user.click(screen.getByRole('button', { name: 'normal' }))
    expect(screen.getByRole('button', { name: 'normal' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('DicePanel — rolling dice', () => {
  it('adds a roll to history when a die button is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'd6' }))
    expect(screen.queryByText(/No rolls yet/i)).not.toBeInTheDocument()
    // Roll history section appears — stat-label shows "D6" (toUpperCase applied)
    // Use getAllByText since the button "d6" also matches case-insensitively
    expect(screen.getAllByText(/d6/i).length).toBeGreaterThanOrEqual(2)
  })

  it('shows the roll result with = total', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'd20' }))
    // Roll results contain "= N" pattern
    expect(screen.getByText(/=\s*\d+/)).toBeInTheDocument()
  })

  it('shows Clear button after at least one roll', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'd4' }))
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })

  it('clears roll history when Clear is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'd8' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText(/No rolls yet/i)).toBeInTheDocument()
  })

  it('rolls d20 with advantage when advantage mode is active', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'advantage' }))
    await user.click(screen.getByRole('button', { name: 'd20' }))
    // Roll history entry has label "D20 (ADVANTAGE)" — stat-label uppercases
    // The mode button text "advantage" is also in DOM, so use getAllByText
    expect(screen.getAllByText(/advantage/i).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps no more than 20 roll entries', async () => {
    const user = userEvent.setup()
    renderPanel()
    // Roll d4 25 times
    for (let i = 0; i < 25; i++) {
      await user.click(screen.getByRole('button', { name: 'd4' }))
    }
    // Roll history entries have stat-label with toUpperCase: "D4"
    // The die button itself is "d4" — filter to only the history entries
    // by excluding buttons from the count
    const allD4 = screen.getAllByText(/^D4$/i)
    const historyEntries = allD4.filter((el) => el.tagName !== 'BUTTON')
    expect(historyEntries.length).toBeLessThanOrEqual(20)
  })
})

describe('DicePanel — DC quick-set', () => {
  it('activates a DC button on click and marks it pressed', async () => {
    const user = userEvent.setup()
    renderPanel()
    const mediumBtn = screen.getByRole('button', { name: /Medium 15/i })
    await user.click(mediumBtn)
    expect(mediumBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggling the same DC button off clears it', async () => {
    const user = userEvent.setup()
    renderPanel()
    const easyBtn = screen.getByRole('button', { name: /Easy 10/i })
    await user.click(easyBtn) // set
    await user.click(easyBtn) // clear
    expect(easyBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows outcome tier label on roll when DC is set', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /Trivial 5/i }))
    await user.click(screen.getByRole('button', { name: 'd20' }))
    // Any outcome label: Critical Success, Success, etc.
    const outcomeLabels = ['Critical Success', 'Success', 'Success with Cost', 'Failure with Opportunity', 'Complication']
    const found = outcomeLabels.some((label) => screen.queryByText(label))
    expect(found).toBe(true)
  })
})

describe('DicePanel — modifier input', () => {
  it('reflects modifier change in input', async () => {
    const user = userEvent.setup()
    renderPanel()
    const input = screen.getByLabelText('Modifier')
    await user.clear(input)
    await user.type(input, '5')
    expect(input).toHaveValue(5)
  })
})
