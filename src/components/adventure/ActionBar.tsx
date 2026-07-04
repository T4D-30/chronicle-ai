/**
 * ActionBar — Phase 8.3
 *
 * Handles all player input in the Adventure Hub.
 * Two modes:
 *   explore — typed text input + quick-access shortcut buttons
 *   combat  — JRPG-style action menu (Attack/Spell/Item/Defend/Move/Flee)
 *             with submenus for weapon selection, spell/item placeholders
 *
 * All buttons resolve to `onSubmitAction(text)` — the engine still resolves
 * mechanics and the AI only narrates outcomes. No game state lives here.
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { EquipmentItem } from '@/lib/engine'

// ─── Types ────────────────────────────────────────────────────────────────────

type CombatSubMenu = 'root' | 'attack' | 'spell' | 'item'

interface QuickAction {
  label: string
  icon: string
  text: string           // submitted to onSubmitAction
  'aria-label': string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Look',      icon: '👁',  text: 'I look around carefully.',                  'aria-label': 'Look around' },
  { label: 'Inventory', icon: '🎒',  text: 'I check my inventory.',                     'aria-label': 'Check inventory' },
  { label: 'Character', icon: '⚔️',  text: 'I review my character abilities and stats.','aria-label': 'Review character' },
  { label: 'Atlas',     icon: '🗺',  text: 'I consult my map and review known locations.','aria-label': 'Consult map' },
  { label: 'Journal',   icon: '📜',  text: 'I read my journal and recent notes.',        'aria-label': 'Read journal' },
  { label: 'Quests',    icon: '⚡',  text: 'I review my active quests and objectives.',  'aria-label': 'Review quests' },
  { label: 'Rest',      icon: '🌙',  text: 'I attempt to rest and recover.',             'aria-label': 'Rest' },
  { label: 'Dice',      icon: '🎲',  text: 'I roll the dice.',                           'aria-label': 'Roll dice' },
]

const MAX_INPUT = 500

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActionBarProps {
  sessionStatus: string
  isInCombat: boolean
  isStreaming: boolean
  isSubmitting: boolean
  /** Equipped weapons — drives the attack submenu. */
  equippedWeapons: EquipmentItem[]
  /** Prepared spells from character sheet. */
  preparedSpells: string[]
  /** Inventory items for item submenu. */
  inventoryItems: Array<{ id: string; name: string }>
  onSubmitAction: (text: string) => void
  onCancelStream: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionBar({
  sessionStatus,
  isInCombat,
  isStreaming,
  isSubmitting,
  equippedWeapons,
  preparedSpells,
  inventoryItems,
  onSubmitAction,
  onCancelStream,
}: ActionBarProps) {
  const [input, setInput]             = useState('')
  const [combatMenu, setCombatMenu]   = useState<CombatSubMenu>('root')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const firstMenuBtnRef = useRef<HTMLButtonElement>(null)

  const isActive     = sessionStatus === 'active'
  const isDisabled   = isStreaming || isSubmitting || !isActive
  const canSubmit    = isActive && !isStreaming && input.trim().length > 0

  // Reset combat submenu when exiting combat
  useEffect(() => {
    if (!isInCombat) setCombatMenu('root')
  }, [isInCombat])

  // Focus first menu button when submenu opens
  useEffect(() => {
    if (isInCombat) firstMenuBtnRef.current?.focus()
  }, [combatMenu, isInCombat])

  function submit(text: string) {
    if (!isActive || isStreaming || !text.trim()) return
    onSubmitAction(text.trim())
    setInput('')
    if (isInCombat) setCombatMenu('root')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) submit(input)
    }
  }

  if (!isActive) {
    return (
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-void-700/50">
        <p className="text-void-600 text-xs italic text-center py-2">
          {sessionStatus === 'paused' ? 'Resume the session to continue.' : 'Session has ended.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex-shrink-0 border-t border-void-700/50"
      data-testid="action-bar"
    >
      {isInCombat ? (
        <CombatMenu
          subMenu={combatMenu}
          onSelectMenu={setCombatMenu}
          onSubmit={submit}
          isDisabled={isDisabled}
          equippedWeapons={equippedWeapons}
          preparedSpells={preparedSpells}
          inventoryItems={inventoryItems}
          firstBtnRef={firstMenuBtnRef}
        />
      ) : (
        <ExploreInput
          input={input}
          setInput={setInput}
          inputRef={inputRef}
          firstBtnRef={firstMenuBtnRef}
          canSubmit={canSubmit}
          isDisabled={isDisabled}
          isStreaming={isStreaming}
          isSubmitting={isSubmitting}
          onSubmit={() => submit(input)}
          onQuickAction={submit}
          onCancelStream={onCancelStream}
          handleKeyDown={handleKeyDown}
        />
      )}
    </div>
  )
}

// ─── Explore input ────────────────────────────────────────────────────────────

function ExploreInput({
  input, setInput, inputRef, firstBtnRef,
  canSubmit, isDisabled, isStreaming, isSubmitting,
  onSubmit, onQuickAction, onCancelStream, handleKeyDown,
}: {
  input: string
  setInput: (v: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
  firstBtnRef: React.RefObject<HTMLButtonElement>
  canSubmit: boolean
  isDisabled: boolean
  isStreaming: boolean
  isSubmitting: boolean
  onSubmit: () => void
  onQuickAction: (text: string) => void
  onCancelStream: () => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <div className="flex flex-col gap-0">
      {/* Quick-access shortcut buttons */}
      <div
        className="px-3 py-2 flex gap-1.5 flex-wrap"
        role="group"
        aria-label="Quick actions"
        data-testid="quick-actions"
      >
        {QUICK_ACTIONS.map((qa, i) => (
          <button
            key={qa.label}
            ref={i === 0 ? firstBtnRef : undefined}
            type="button"
            disabled={isDisabled}
            onClick={() => onQuickAction(qa.text)}
            aria-label={qa['aria-label']}
            data-testid={`quick-action-${qa.label.toLowerCase()}`}
            className={cn(
              'pixel-btn flex items-center gap-1 px-2 py-1 text-sm font-pixel-body transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'bg-void-900 border-void-700 text-void-400 hover:text-void-200',
            )}
          >
            <span aria-hidden="true">{qa.icon}</span>
            <span>{qa.label}</span>
          </button>
        ))}
      </div>

      {/* Typed input */}
      <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
            onKeyDown={handleKeyDown}
            placeholder="What do you do?"
            disabled={isDisabled}
            rows={2}
            aria-label="Player action input"
            data-testid="action-input"
            className={cn(
              'w-full px-3 py-2.5 pr-16 rounded-lg resize-none text-sm font-body',
              'bg-void-900 border text-white placeholder:text-void-600',
              'focus:outline-none focus:ring-2 focus:ring-arcane-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDisabled ? 'border-void-700/50' : 'border-void-700 hover:border-void-600',
            )}
          />
          <span className="absolute right-2 bottom-2 text-void-700 text-xs font-mono pointer-events-none">
            {input.length}/{MAX_INPUT}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-void-700 text-xs">Enter to submit · Shift+Enter for new line</p>
          {isStreaming ? (
            <Button type="button" variant="danger" size="sm" onClick={onCancelStream}>
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="arcane"
              size="sm"
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
              data-testid="submit-action-btn"
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Combat menu ──────────────────────────────────────────────────────────────

function CombatMenu({
  subMenu, onSelectMenu, onSubmit, isDisabled,
  equippedWeapons, preparedSpells, inventoryItems, firstBtnRef,
}: {
  subMenu: CombatSubMenu
  onSelectMenu: (m: CombatSubMenu) => void
  onSubmit: (text: string) => void
  isDisabled: boolean
  equippedWeapons: EquipmentItem[]
  preparedSpells: string[]
  inventoryItems: Array<{ id: string; name: string }>
  firstBtnRef: React.RefObject<HTMLButtonElement>
}) {
  return (
    <div
      className="px-4 py-3"
      role="group"
      aria-label="Combat actions"
      data-testid="combat-menu"
    >
      {subMenu === 'root' && (
        <RootCombatMenu
          onSelectMenu={onSelectMenu}
          onSubmit={onSubmit}
          isDisabled={isDisabled}
          firstBtnRef={firstBtnRef}
        />
      )}
      {subMenu === 'attack' && (
        <AttackSubMenu
          weapons={equippedWeapons}
          onSubmit={onSubmit}
          onBack={() => onSelectMenu('root')}
          isDisabled={isDisabled}
          firstBtnRef={firstBtnRef}
        />
      )}
      {subMenu === 'spell' && (
        <SpellSubMenu
          spells={preparedSpells}
          onSubmit={onSubmit}
          onBack={() => onSelectMenu('root')}
          isDisabled={isDisabled}
          firstBtnRef={firstBtnRef}
        />
      )}
      {subMenu === 'item' && (
        <ItemSubMenu
          items={inventoryItems}
          onSubmit={onSubmit}
          onBack={() => onSelectMenu('root')}
          isDisabled={isDisabled}
          firstBtnRef={firstBtnRef}
        />
      )}
    </div>
  )
}

// ─── Root combat menu ─────────────────────────────────────────────────────────

const COMBAT_ROOTS = [
  { id: 'attack',  label: 'Attack',  icon: '⚔️',  sub: 'attack' as CombatSubMenu,  action: null },
  { id: 'spell',   label: 'Spell',   icon: '✨',  sub: 'spell' as CombatSubMenu,   action: null },
  { id: 'item',    label: 'Item',    icon: '🎒',  sub: 'item' as CombatSubMenu,    action: null },
  { id: 'defend',  label: 'Defend',  icon: '🛡',  sub: null,  action: 'I take a defensive stance, focusing on protecting myself.' },
  { id: 'move',    label: 'Move',    icon: '👣',  sub: null,  action: 'I reposition myself on the battlefield, moving to a better location.' },
  { id: 'flee',    label: 'Flee',    icon: '🏃',  sub: null,  action: 'I attempt to flee the battle and escape from my enemies.' },
]

function RootCombatMenu({
  onSelectMenu, onSubmit, isDisabled, firstBtnRef,
}: {
  onSelectMenu: (m: CombatSubMenu) => void
  onSubmit: (text: string) => void
  isDisabled: boolean
  firstBtnRef: React.RefObject<HTMLButtonElement>
}) {
  const variantFor = (id: string) => {
    if (id === 'attack') return 'harm'
    if (id === 'spell')  return 'arcane'
    if (id === 'flee')   return 'ghost'
    return 'neutral'
  }

  return (
    <div className="grid grid-cols-3 gap-2" data-testid="combat-root-menu">
      {COMBAT_ROOTS.map((item, i) => (
        <CombatActionBtn
          key={item.id}
          ref={i === 0 ? firstBtnRef : undefined}
          icon={item.icon}
          label={item.label}
          variant={variantFor(item.id)}
          disabled={isDisabled}
          data-testid={`combat-action-${item.id}`}
          aria-label={item.label}
          onClick={() => item.sub ? onSelectMenu(item.sub) : onSubmit(item.action!)}
        />
      ))}
    </div>
  )
}

// ─── Attack submenu ───────────────────────────────────────────────────────────

function AttackSubMenu({
  weapons, onSubmit, onBack, isDisabled, firstBtnRef,
}: {
  weapons: EquipmentItem[]
  onSubmit: (text: string) => void
  onBack: () => void
  isDisabled: boolean
  firstBtnRef: React.RefObject<HTMLButtonElement>
}) {
  const attackWeapons = weapons.filter((w) => w.slot === 'weapon' && w.equipped)
  const hasWeapons = attackWeapons.length > 0

  return (
    <div className="flex flex-col gap-2" data-testid="attack-submenu">
      <SubMenuHeader label="Attack with…" onBack={onBack} />
      {hasWeapons ? (
        <div className="grid grid-cols-2 gap-2">
          {attackWeapons.map((w, i) => (
            <CombatActionBtn
              key={w.id}
              ref={i === 0 ? firstBtnRef : undefined}
              icon="⚔️"
              label={w.name}
              variant="harm"
              disabled={isDisabled}
              data-testid={`weapon-${w.id}`}
              aria-label={`Attack with ${w.name}`}
              onClick={() => onSubmit(`I attack with my ${w.name}.`)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <CombatActionBtn
            ref={firstBtnRef}
            icon="👊"
            label="Unarmed Strike"
            variant="harm"
            disabled={isDisabled}
            data-testid="weapon-unarmed"
            aria-label="Attack with Unarmed Strike"
            onClick={() => onSubmit('I attack with an unarmed strike.')}
          />
        </div>
      )}
    </div>
  )
}

// ─── Spell submenu ────────────────────────────────────────────────────────────

function SpellSubMenu({
  spells, onSubmit, onBack, isDisabled, firstBtnRef,
}: {
  spells: string[]
  onSubmit: (text: string) => void
  onBack: () => void
  isDisabled: boolean
  firstBtnRef: React.RefObject<HTMLButtonElement>
}) {
  const hasSpells = spells.length > 0

  return (
    <div className="flex flex-col gap-2" data-testid="spell-submenu">
      <SubMenuHeader label="Cast a Spell" onBack={onBack} />
      {hasSpells ? (
        <div className="grid grid-cols-2 gap-2">
          {spells.slice(0, 6).map((spell, i) => (
            <CombatActionBtn
              key={spell}
              ref={i === 0 ? firstBtnRef : undefined}
              icon="✨"
              label={spell}
              variant="arcane"
              disabled={isDisabled}
              data-testid={`spell-${spell.toLowerCase().replace(/\s+/g, '-')}`}
              aria-label={`Cast ${spell}`}
              onClick={() => onSubmit(`I cast ${spell}.`)}
            />
          ))}
        </div>
      ) : (
        <div
          className="chr-panel p-3 rounded-lg text-center"
          role="status"
          data-testid="spell-empty"
        >
          <p className="text-void-500 text-xs">
            No spells prepared. Add spells on your Character Sheet.
          </p>
          <button
            ref={firstBtnRef}
            type="button"
            onClick={() => onSubmit('I attempt to use a cantrip or innate ability.')}
            disabled={isDisabled}
            className="mt-2 text-xs text-arcane-400 hover:text-arcane-300 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded disabled:opacity-40"
          >
            Use cantrip / innate ability
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Item submenu ─────────────────────────────────────────────────────────────

function ItemSubMenu({
  items, onSubmit, onBack, isDisabled, firstBtnRef,
}: {
  items: Array<{ id: string; name: string }>
  onSubmit: (text: string) => void
  onBack: () => void
  isDisabled: boolean
  firstBtnRef: React.RefObject<HTMLButtonElement>
}) {
  const usableItems = items.slice(0, 6)
  const hasItems = usableItems.length > 0

  return (
    <div className="flex flex-col gap-2" data-testid="item-submenu">
      <SubMenuHeader label="Use an Item" onBack={onBack} />
      {hasItems ? (
        <div className="grid grid-cols-2 gap-2">
          {usableItems.map((item, i) => (
            <CombatActionBtn
              key={item.id}
              ref={i === 0 ? firstBtnRef : undefined}
              icon="🎒"
              label={item.name}
              variant="neutral"
              disabled={isDisabled}
              data-testid={`item-${item.id}`}
              aria-label={`Use ${item.name}`}
              onClick={() => onSubmit(`I use my ${item.name}.`)}
            />
          ))}
        </div>
      ) : (
        <div
          className="chr-panel p-3 rounded-lg text-center"
          role="status"
          data-testid="item-empty"
        >
          <p className="text-void-500 text-xs">
            No items in inventory.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SubMenuHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <p className="stat-label text-arcane-400">{label.toUpperCase()}</p>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to combat menu"
        data-testid="combat-back-btn"
        className="text-void-500 hover:text-void-300 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded"
      >
        ← Back
      </button>
    </div>
  )
}

import { forwardRef } from 'react'

const COMBAT_BTN_VARIANTS = {
  harm:    'bg-harm-900/20 border-harm-700/50 text-harm-300 hover:bg-harm-900/40 hover:border-harm-600',
  arcane:  'bg-arcane-900/20 border-arcane-700/50 text-arcane-300 hover:bg-arcane-900/40 hover:border-arcane-600',
  ghost:   'bg-void-900 border-void-700/50 text-void-300 hover:border-void-500',
  neutral: 'bg-void-900 border-void-700/50 text-void-200 hover:border-arcane-700/40',
}

interface CombatActionBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string
  label: string
  variant: keyof typeof COMBAT_BTN_VARIANTS
}

const CombatActionBtn = forwardRef<HTMLButtonElement, CombatActionBtnProps>(
  ({ icon, label, variant, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'pixel-btn flex flex-col items-center gap-1 px-2 py-2.5 min-h-[56px] transition-colors',
        'font-pixel-body',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        COMBAT_BTN_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      <span className="font-body text-xs font-semibold leading-tight text-center">{label}</span>
    </button>
  ),
)
CombatActionBtn.displayName = 'CombatActionBtn'
