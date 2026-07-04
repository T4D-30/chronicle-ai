/**
 * ActionBar Tests — Phase 8.3
 *
 * Covers: typed action submit, quick action button submit,
 * combat menu root, attack weapon submenu, spell/item placeholders,
 * menu switching, keyboard accessibility, session-status gating.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ActionBar } from '@/components/adventure/ActionBar'
import type { EquipmentItem } from '@/lib/engine'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SWORD: EquipmentItem = {
  id: 'sword-1', name: 'Iron Sword', slot: 'weapon', equipped: true,
  attackBonus: 2,
}
const SHIELD: EquipmentItem = {
  id: 'shield-1', name: 'Wooden Shield', slot: 'shield', equipped: true,
  armorBonus: 2,
}

function renderBar(overrides: Partial<React.ComponentProps<typeof ActionBar>> = {}) {
  const defaults = {
    sessionStatus: 'active',
    isInCombat: false,
    isStreaming: false,
    isSubmitting: false,
    equippedWeapons: [],
    preparedSpells: [],
    inventoryItems: [],
    onSubmitAction: vi.fn(),
    onCancelStream: vi.fn(),
  }
  return render(<ActionBar {...defaults} {...overrides} />)
}

// ── Session gating ────────────────────────────────────────────────────────────

describe('ActionBar — session gating', () => {
  it('shows paused message when session is paused', () => {
    renderBar({ sessionStatus: 'paused' })
    expect(screen.getByText(/Resume the session/i)).toBeInTheDocument()
  })

  it('shows ended message when session has ended', () => {
    renderBar({ sessionStatus: 'ended' })
    expect(screen.getByText(/Session has ended/i)).toBeInTheDocument()
  })

  it('renders action bar when session is active', () => {
    renderBar()
    expect(screen.getByTestId('action-bar')).toBeInTheDocument()
  })
})

// ── Typed action submit ───────────────────────────────────────────────────────

describe('ActionBar — typed action submit', () => {
  it('renders a text input', () => {
    renderBar()
    expect(screen.getByRole('textbox', { name: /Player action input/i })).toBeInTheDocument()
  })

  it('submits on Enter key', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    const input = screen.getByRole('textbox', { name: /Player action input/i })
    await user.type(input, 'I look around{Enter}')
    expect(onSubmitAction).toHaveBeenCalledWith('I look around')
  })

  it('does not submit on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    const input = screen.getByRole('textbox', { name: /Player action input/i })
    await user.type(input, 'I look around{Shift>}{Enter}{/Shift}')
    expect(onSubmitAction).not.toHaveBeenCalled()
  })

  it('clears input after submit', async () => {
    const user = userEvent.setup()
    renderBar()
    const input = screen.getByRole('textbox', { name: /Player action input/i })
    await user.type(input, 'hello{Enter}')
    expect(input).toHaveValue('')
  })

  it('submits via the Send button', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    await user.type(screen.getByRole('textbox'), 'search the room')
    await user.click(screen.getByTestId('submit-action-btn'))
    expect(onSubmitAction).toHaveBeenCalledWith('search the room')
  })

  it('Send button is disabled when input is empty', () => {
    renderBar()
    expect(screen.getByTestId('submit-action-btn')).toBeDisabled()
  })

  it('shows Cancel button while streaming', () => {
    renderBar({ isStreaming: true })
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
  })

  it('calls onCancelStream when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancelStream = vi.fn()
    renderBar({ isStreaming: true, onCancelStream })
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancelStream).toHaveBeenCalledOnce()
  })
})

// ── Quick action buttons ──────────────────────────────────────────────────────

describe('ActionBar — quick action buttons', () => {
  it('renders the quick actions group', () => {
    renderBar()
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
  })

  it('renders all 8 quick action buttons', () => {
    renderBar()
    const group = screen.getByTestId('quick-actions')
    expect(within(group).getAllByRole('button')).toHaveLength(8)
  })

  it('submits action text when a quick action button is clicked', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    await user.click(screen.getByTestId('quick-action-look'))
    expect(onSubmitAction).toHaveBeenCalledWith('I look around carefully.')
  })

  it('Inventory quick action submits correct text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    await user.click(screen.getByTestId('quick-action-inventory'))
    expect(onSubmitAction).toHaveBeenCalledWith('I check my inventory.')
  })

  it('Character quick action submits correct text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    await user.click(screen.getByTestId('quick-action-character'))
    expect(onSubmitAction).toHaveBeenCalledWith('I review my character abilities and stats.')
  })

  it('each quick action button has an accessible aria-label', () => {
    renderBar()
    expect(screen.getByRole('button', { name: /Look around/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Check inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Roll dice/i })).toBeInTheDocument()
  })

  it('quick action buttons are disabled while streaming', () => {
    renderBar({ isStreaming: true })
    const buttons = within(screen.getByTestId('quick-actions')).getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })
})

// ── Combat menu — root ────────────────────────────────────────────────────────

describe('ActionBar — combat root menu', () => {
  it('shows combat menu instead of explore input when isInCombat=true', () => {
    renderBar({ isInCombat: true })
    expect(screen.getByTestId('combat-menu')).toBeInTheDocument()
    expect(screen.queryByTestId('quick-actions')).not.toBeInTheDocument()
  })

  it('renders all 6 root combat actions', () => {
    renderBar({ isInCombat: true })
    const menu = screen.getByTestId('combat-root-menu')
    expect(within(menu).getAllByRole('button')).toHaveLength(6)
  })

  it('Defend submits action text directly', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, onSubmitAction })
    await user.click(screen.getByTestId('combat-action-defend'))
    expect(onSubmitAction).toHaveBeenCalledWith(expect.stringContaining('defensive stance'))
  })

  it('Move submits action text directly', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, onSubmitAction })
    await user.click(screen.getByTestId('combat-action-move'))
    expect(onSubmitAction).toHaveBeenCalledWith(expect.stringContaining('reposition'))
  })

  it('Flee submits action text directly', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, onSubmitAction })
    await user.click(screen.getByTestId('combat-action-flee'))
    expect(onSubmitAction).toHaveBeenCalledWith(expect.stringContaining('flee'))
  })

  it('all combat root buttons have aria-label', () => {
    renderBar({ isInCombat: true })
    const btns = ['Attack', 'Spell', 'Item', 'Defend', 'Move', 'Flee']
    btns.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
  })
})

// ── Menu switching ────────────────────────────────────────────────────────────

describe('ActionBar — menu switching', () => {
  it('Attack button opens the attack submenu', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true })
    await user.click(screen.getByTestId('combat-action-attack'))
    expect(screen.getByTestId('attack-submenu')).toBeInTheDocument()
    expect(screen.queryByTestId('combat-root-menu')).not.toBeInTheDocument()
  })

  it('Spell button opens the spell submenu', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true })
    await user.click(screen.getByTestId('combat-action-spell'))
    expect(screen.getByTestId('spell-submenu')).toBeInTheDocument()
  })

  it('Item button opens the item submenu', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true })
    await user.click(screen.getByTestId('combat-action-item'))
    expect(screen.getByTestId('item-submenu')).toBeInTheDocument()
  })

  it('Back button returns to root combat menu from attack', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true })
    await user.click(screen.getByTestId('combat-action-attack'))
    await user.click(screen.getByTestId('combat-back-btn'))
    expect(screen.getByTestId('combat-root-menu')).toBeInTheDocument()
  })

  it('Back button has accessible aria-label', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true })
    await user.click(screen.getByTestId('combat-action-attack'))
    expect(screen.getByRole('button', { name: /Back to combat menu/i })).toBeInTheDocument()
  })

  it('combat menu resets to root when exiting combat', () => {
    const { rerender } = renderBar({ isInCombat: true })
    // After exiting combat, explore input should show
    rerender(
      <ActionBar
        sessionStatus="active"
        isInCombat={false}
        isStreaming={false}
        isSubmitting={false}
        equippedWeapons={[]}
        preparedSpells={[]}
        inventoryItems={[]}
        onSubmitAction={vi.fn()}
        onCancelStream={vi.fn()}
      />
    )
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
    expect(screen.queryByTestId('combat-menu')).not.toBeInTheDocument()
  })
})

// ── Attack weapon submenu ─────────────────────────────────────────────────────

describe('ActionBar — attack weapon submenu', () => {
  it('shows unarmed strike when no weapons are equipped', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, equippedWeapons: [] })
    await user.click(screen.getByTestId('combat-action-attack'))
    expect(screen.getByTestId('weapon-unarmed')).toBeInTheDocument()
  })

  it('shows equipped weapon button', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, equippedWeapons: [SWORD] })
    await user.click(screen.getByTestId('combat-action-attack'))
    expect(screen.getByTestId('weapon-sword-1')).toBeInTheDocument()
    expect(screen.getByText('Iron Sword')).toBeInTheDocument()
  })

  it('does not show unequipped weapon', async () => {
    const user = userEvent.setup()
    const unequipped = { ...SWORD, equipped: false }
    renderBar({ isInCombat: true, equippedWeapons: [unequipped] })
    await user.click(screen.getByTestId('combat-action-attack'))
    expect(screen.queryByText('Iron Sword')).not.toBeInTheDocument()
    expect(screen.getByTestId('weapon-unarmed')).toBeInTheDocument()
  })

  it('does not show non-weapon equipment in attack submenu', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, equippedWeapons: [SWORD, SHIELD] })
    await user.click(screen.getByTestId('combat-action-attack'))
    // Shield is slot=shield so filtered out; only sword appears
    expect(screen.getByText('Iron Sword')).toBeInTheDocument()
    expect(screen.queryByText('Wooden Shield')).not.toBeInTheDocument()
  })

  it('clicking a weapon submits correct action text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, equippedWeapons: [SWORD], onSubmitAction })
    await user.click(screen.getByTestId('combat-action-attack'))
    await user.click(screen.getByTestId('weapon-sword-1'))
    expect(onSubmitAction).toHaveBeenCalledWith('I attack with my Iron Sword.')
  })

  it('weapon button has aria-label', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, equippedWeapons: [SWORD] })
    await user.click(screen.getByTestId('combat-action-attack'))
    expect(screen.getByRole('button', { name: /Attack with Iron Sword/i })).toBeInTheDocument()
  })

  it('unarmed strike submits correct text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, equippedWeapons: [], onSubmitAction })
    await user.click(screen.getByTestId('combat-action-attack'))
    await user.click(screen.getByTestId('weapon-unarmed'))
    expect(onSubmitAction).toHaveBeenCalledWith('I attack with an unarmed strike.')
  })
})

// ── Spell submenu placeholder ─────────────────────────────────────────────────

describe('ActionBar — spell submenu', () => {
  it('shows empty-state placeholder when no spells are prepared', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, preparedSpells: [] })
    await user.click(screen.getByTestId('combat-action-spell'))
    expect(screen.getByTestId('spell-empty')).toBeInTheDocument()
    expect(screen.getByText(/No spells prepared/i)).toBeInTheDocument()
  })

  it('shows cantrip fallback button in empty state', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, preparedSpells: [], onSubmitAction })
    await user.click(screen.getByTestId('combat-action-spell'))
    await user.click(screen.getByRole('button', { name: /cantrip/i }))
    expect(onSubmitAction).toHaveBeenCalledWith(expect.stringContaining('cantrip'))
  })

  it('shows prepared spell buttons', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, preparedSpells: ['Fireball', 'Shield'] })
    await user.click(screen.getByTestId('combat-action-spell'))
    expect(screen.getByText('Fireball')).toBeInTheDocument()
    expect(screen.getByText('Shield')).toBeInTheDocument()
  })

  it('clicking a spell submits correct text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ isInCombat: true, preparedSpells: ['Fireball'], onSubmitAction })
    await user.click(screen.getByTestId('combat-action-spell'))
    await user.click(screen.getByTestId('spell-fireball'))
    expect(onSubmitAction).toHaveBeenCalledWith('I cast Fireball.')
  })
})

// ── Item submenu placeholder ──────────────────────────────────────────────────

describe('ActionBar — item submenu', () => {
  it('shows empty-state placeholder when no inventory items', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true, inventoryItems: [] })
    await user.click(screen.getByTestId('combat-action-item'))
    expect(screen.getByTestId('item-empty')).toBeInTheDocument()
    expect(screen.getByText(/No items in inventory/i)).toBeInTheDocument()
  })

  it('shows inventory item buttons', async () => {
    const user = userEvent.setup()
    renderBar({
      isInCombat: true,
      inventoryItems: [{ id: 'potion-1', name: 'Health Potion' }],
    })
    await user.click(screen.getByTestId('combat-action-item'))
    expect(screen.getByText('Health Potion')).toBeInTheDocument()
  })

  it('clicking an item submits correct text', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({
      isInCombat: true,
      inventoryItems: [{ id: 'potion-1', name: 'Health Potion' }],
      onSubmitAction,
    })
    await user.click(screen.getByTestId('combat-action-item'))
    await user.click(screen.getByTestId('item-potion-1'))
    expect(onSubmitAction).toHaveBeenCalledWith('I use my Health Potion.')
  })
})

// ── Keyboard accessibility ────────────────────────────────────────────────────

describe('ActionBar — keyboard accessibility', () => {
  it('quick action buttons are keyboard focusable', () => {
    renderBar()
    const btn = screen.getByTestId('quick-action-look')
    btn.focus()
    expect(document.activeElement).toBe(btn)
  })

  it('action input can be submitted via Enter', async () => {
    const user = userEvent.setup()
    const onSubmitAction = vi.fn()
    renderBar({ onSubmitAction })
    const input = screen.getByRole('textbox')
    await user.type(input, 'open the chest{Enter}')
    expect(onSubmitAction).toHaveBeenCalledWith('open the chest')
  })

  it('combat back button has aria-label for screen readers', async () => {
    const user = userEvent.setup()
    renderBar({ isInCombat: true })
    await user.click(screen.getByTestId('combat-action-attack'))
    const backBtn = screen.getByRole('button', { name: /Back to combat menu/i })
    expect(backBtn).toBeInTheDocument()
    backBtn.focus()
    expect(document.activeElement).toBe(backBtn)
  })

  it('combat action buttons have aria-labels', () => {
    renderBar({ isInCombat: true })
    expect(screen.getByRole('button', { name: 'Defend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flee' })).toBeInTheDocument()
  })

  it('combat menu has accessible group label', () => {
    renderBar({ isInCombat: true })
    expect(screen.getByRole('group', { name: /Combat actions/i })).toBeInTheDocument()
  })

  it('quick actions group has accessible label', () => {
    renderBar()
    expect(screen.getByRole('group', { name: /Quick actions/i })).toBeInTheDocument()
  })
})
