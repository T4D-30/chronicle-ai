/**
 * CombatPanel — Phase 5
 *
 * Battle Screen layout per CHRONICLE_GAME_LOOP.md spec:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  Initiative Tracker (turn order)         │
 *   ├──────────────────┬──────────────────────┤
 *   │  Enemy Area      │  Player Area          │
 *   │  (tokens + HP)   │  (HP/AC/conditions)  │
 *   ├──────────────────┴──────────────────────┤
 *   │  Narration (last Director line)          │
 *   ├─────────────────────────────────────────┤
 *   │  Action Menu: Attack | Defend | Flee     │
 *   ├─────────────────────────────────────────┤
 *   │  Combat Log ▾ (expandable)               │
 *   └─────────────────────────────────────────┘
 *
 * D&D mechanics are executed by the combat engine; this component drives
 * the state machine and renders results. No math lives here.
 */

import { useState, useRef, useEffect } from 'react'
import { Badge, Button } from '@/components/ui'
import { PixelPanel, DamageNumber } from '@/components/pixel'
import {
  initCombat,
  advanceTurn,
  resolvePlayerAttack,
  resolveEnemyAttack,
  rollDeathSave,
  allEnemiesDefeated,
  calculateXp,
  makeCombatLogEntry,
  buildCombatResult,
  parseLootFromDirector,
} from '@/lib/engine'
import type {
  CombatState,
  EnemyCombatant,
  PlayerCombatant,
  AttackResult,
  CombatLogEntry,
  CombatResult,
  LootItem,
} from '@/lib/engine'
import type { CharacterSheet } from '@/lib/engine'
import type { DieNotation } from '@/lib/engine'

// ─── Default weapon for unarmed / no weapon selected ─────────────────────────
const UNARMED: { die: DieNotation; bonus: number; name: string } = {
  die: 'd4', bonus: 0, name: 'Unarmed Strike',
}

/** Visual-only floating damage number. target='player' or an enemy id. */
interface DamagePopup {
  id: number
  target: 'player' | string
  kind: 'damage' | 'heal' | 'crit' | 'miss'
  amount: number
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CombatPanelProps {
  playerSheet: CharacterSheet
  enemies: EnemyCombatant[]
  /** Called when the player clicks Continue on the summary screen. Persists results. */
  onCombatEnd: (result: CombatResult) => void
  lastNarration?: string
  /** Director worldStateUpdates used to extract loot. */
  worldStateUpdates?: Record<string, unknown>
}

export function CombatPanel({
  playerSheet,
  enemies,
  onCombatEnd,
  lastNarration,
  worldStateUpdates = {},
}: CombatPanelProps) {
  const player: PlayerCombatant = {
    id: 'player',
    name: playerSheet.name,
    isPlayer: true,
    sheet: playerSheet,
  }

  const [combat, setCombat] = useState<CombatState>(() => initCombat(player, enemies))
  const [logOpen, setLogOpen] = useState(false)
  const [loot] = useState<LootItem[]>(() => parseLootFromDirector(worldStateUpdates))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pendingNarration = lastNarration ?? ''
  const logEndRef = useRef<HTMLDivElement>(null)

  // ── Visual-only combat feedback (Phase 9.1) ──────────────────────────────
  // Popups and crit-flash are pure presentation, driven by the same
  // AttackResult the engine already returns. They read combat outcomes;
  // they never write to combat state or influence resolution.
  const [popups, setPopups] = useState<DamagePopup[]>([])
  const [critFlash, setCritFlash] = useState(false)
  const popupIdRef = useRef(0)

  function spawnPopup(target: 'player' | string, kind: 'damage' | 'heal' | 'crit' | 'miss', amount: number) {
    const id = ++popupIdRef.current
    setPopups((p) => [...p, { id, target, kind, amount }])
    // Popups are decorative and self-clear; 1.3s covers the damage-float animation.
    window.setTimeout(() => {
      setPopups((p) => p.filter((entry) => entry.id !== id))
    }, 1300)
  }

  function flashCrit() {
    setCritFlash(true)
    window.setTimeout(() => setCritFlash(false), 220)
  }

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [combat.log])

  // ── Derived state ─────────────────────────────────────────────────────────

  const activeEntry = combat.initiativeOrder[combat.activeIndex]
  const isPlayerTurn = combat.phase === 'player_turn'
  const isEnemyTurn = combat.phase === 'enemy_turn'
  const isSummary = combat.phase === 'summary'
  const isPlayerDead = combat.playerCurrentHp <= 0
  const isPlayerDown = isPlayerDead

  // Weapon: first equipped weapon, else unarmed
  const equippedWeapon = playerSheet.equipment.find((e) => e.equipped && e.slot === 'weapon')
  const weapon = equippedWeapon
    ? { die: 'd6' as DieNotation, bonus: equippedWeapon.attackBonus ?? 0, name: equippedWeapon.name }
    : UNARMED

  // ── Actions ───────────────────────────────────────────────────────────────

  function appendLog(entry: CombatLogEntry) {
    setCombat((s) => ({ ...s, log: [...s.log, entry] }))
  }

  function playerAttack(targetId: string) {
    const target = combat.enemies.find((e) => e.id === targetId)
    if (!target || target.currentHp <= 0) return

    // Create a temporary sheet with current combat HP
    const currentSheet: CharacterSheet = {
      ...playerSheet,
      currentHp: combat.playerCurrentHp,
    }

    const result: AttackResult = resolvePlayerAttack(currentSheet, target, {
      weaponDamageDie: weapon.die,
      weaponDamageBonus: weapon.bonus,
      proficient: true, // simplified — full weapon proficiency tracking is Phase 5 stretch
      usesDex: false,
    })

    const desc = result.critical
      ? `${playerSheet.name} CRITICAL HIT ${target.name} for ${result.totalDamage} damage! (${weapon.name})`
      : result.naturalOne
        ? `${playerSheet.name} fumbles! (${weapon.name})`
        : result.hit
          ? `${playerSheet.name} hits ${target.name} for ${result.totalDamage} damage. (${weapon.name})`
          : `${playerSheet.name} misses ${target.name}. (roll: ${result.attackRoll.total} vs AC ${target.armorClass})`

    const logEntry = makeCombatLogEntry(
      combat.round, playerSheet.name, true, desc,
      { attackRoll: result.attackRoll.total, damageDealt: result.totalDamage, critical: result.critical, miss: !result.hit },
    )

    // Visual-only feedback — reads the AttackResult the engine already computed
    if (result.critical) {
      spawnPopup(targetId, 'crit', result.totalDamage)
      flashCrit()
    } else if (!result.hit) {
      spawnPopup(targetId, 'miss', 0)
    } else {
      spawnPopup(targetId, 'damage', result.totalDamage)
    }

    // Update enemy HP
    const updatedEnemies = combat.enemies.map((e) =>
      e.id === targetId ? { ...e, currentHp: result.newTargetHp } : e,
    )
    const newCombat: CombatState = { ...combat, enemies: updatedEnemies, log: [...combat.log, logEntry] }

    // Check win condition
    if (allEnemiesDefeated(newCombat)) {
      const xp = calculateXp(enemies)
      const summary = makeCombatLogEntry(combat.round, 'System', false, `All enemies defeated! ${xp} XP earned.`)
      setCombat({ ...newCombat, phase: 'summary', xpAwarded: xp, log: [...newCombat.log, summary] })
      return
    }

    setCombat(advanceTurn(newCombat))
  }

  function playerDefend() {
    const logEntry = makeCombatLogEntry(combat.round, playerSheet.name, true, `${playerSheet.name} takes a defensive stance (+2 AC until next turn).`)
    // Defending is tracked narratively for now; mechanical AC bonus tracked in Phase 5 stretch
    appendLog(logEntry)
    setCombat((s) => advanceTurn({ ...s, log: [...s.log, logEntry] }))
  }

  function playerFlee() {
    // Flee: contested DEX check; simplified for Phase 5 — always succeeds but costs an action
    // Full contested check is a Phase 5 stretch goal
    const logEntry = makeCombatLogEntry(combat.round, playerSheet.name, true, `${playerSheet.name} escapes the battle!`)
    setCombat((s) => ({ ...s, phase: 'summary', log: [...s.log, logEntry] }))
  }

  function doEnemyTurn() {
    const enemyEntry = combat.initiativeOrder[combat.activeIndex]
    const enemy = combat.enemies.find((e) => e.id === enemyEntry.combatantId)
    if (!enemy || enemy.currentHp <= 0) {
      setCombat((s) => advanceTurn(s))
      return
    }

    const currentSheet: CharacterSheet = { ...playerSheet, currentHp: combat.playerCurrentHp }
    const result = resolveEnemyAttack(enemy, currentSheet)

    const desc = result.critical
      ? `${enemy.name} CRITICAL HIT ${playerSheet.name} for ${result.totalDamage} damage!`
      : result.naturalOne
        ? `${enemy.name} fumbles!`
        : result.hit
          ? `${enemy.name} hits ${playerSheet.name} for ${result.totalDamage} damage.`
          : `${enemy.name} misses ${playerSheet.name}. (roll: ${result.attackRoll.total} vs AC ${currentSheet.armorClass})`

    const logEntry = makeCombatLogEntry(
      combat.round, enemy.name, false, desc,
      { attackRoll: result.attackRoll.total, damageDealt: result.totalDamage, critical: result.critical, miss: !result.hit },
    )

    // Visual-only feedback — reads the AttackResult the engine already computed
    if (result.critical) {
      spawnPopup('player', 'crit', result.totalDamage)
      flashCrit()
    } else if (!result.hit) {
      spawnPopup('player', 'miss', 0)
    } else {
      spawnPopup('player', 'damage', result.totalDamage)
    }

    const newPlayerHp = result.newTargetHp
    let newCombat: CombatState = { ...combat, playerCurrentHp: newPlayerHp, log: [...combat.log, logEntry] }

    if (newPlayerHp <= 0) {
      const downEntry = makeCombatLogEntry(combat.round, 'System', false, `${playerSheet.name} is down! Rolling death saves…`)
      newCombat = { ...newCombat, phase: 'player_turn', log: [...newCombat.log, downEntry] }
      setCombat(newCombat)
      return
    }

    setCombat(advanceTurn(newCombat))
  }

  function doDeathSave() {
    const result = rollDeathSave(combat.playerDeathSuccesses, combat.playerDeathFailures)

    const desc =
      result.outcome === 'revived' ? `${playerSheet.name} rolls a 20 — stabilized!` :
      result.outcome === 'dead'    ? `${playerSheet.name} has died.` :
      result.outcome === 'stable'  ? `${playerSheet.name} stabilizes with 3 successes.` :
      result.outcome === 'success' ? `Death save success (${result.successesTotal}/3). Roll: ${result.roll.total}` :
                                     `Death save failure (${result.failuresTotal}/3). Roll: ${result.roll.total}`

    const logEntry = makeCombatLogEntry(combat.round, playerSheet.name, true, desc)
    const newCombat: CombatState = {
      ...combat,
      playerDeathSuccesses: result.successesTotal,
      playerDeathFailures: result.failuresTotal,
      log: [...combat.log, logEntry],
    }

    if (result.outcome === 'dead') {
      const deadEntry = makeCombatLogEntry(combat.round, 'System', false, 'The adventure ends here.')
      setCombat({ ...newCombat, phase: 'summary', log: [...newCombat.log, deadEntry] })
      return
    }
    if (result.outcome === 'revived') {
      const aliveEntry = makeCombatLogEntry(combat.round, 'System', false, `${playerSheet.name} is revived with 1 HP.`)
      setCombat({ ...newCombat, playerCurrentHp: 1, phase: 'player_turn', log: [...newCombat.log, aliveEntry] })
      return
    }
    if (result.outcome === 'stable') {
      setCombat({ ...newCombat, phase: 'summary' })
      return
    }
    // Advance turn after a save result (success or failure)
    setCombat(advanceTurn(newCombat))
  }

  function endCombat() {
    if (isSubmitting) return
    setIsSubmitting(true)
    const result = buildCombatResult(combat, loot)
    onCombatEnd(result)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-void-950 relative" data-testid="combat-panel">

      {/* Critical hit full-panel flash — pure visual, per STYLE_GUIDE battle screen rules */}
      {critFlash && (
        <div
          className="crit-flash absolute inset-0 bg-arcane-400/10 z-20 pointer-events-none"
          data-testid="crit-flash"
          aria-hidden="true"
        />
      )}

      {/* Initiative tracker */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-void-700/50 bg-void-900/60" data-testid="initiative-tracker">
        <p className="font-pixel-display text-[9px] text-harm-400 mb-1.5 uppercase">INITIATIVE — Round {combat.round}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {combat.initiativeOrder.map((entry, i) => {
            const isActive = i === combat.activeIndex && !isSummary
            const enemy = combat.enemies.find((e) => e.id === entry.combatantId)
            const isDead = !entry.isPlayer && (enemy?.currentHp ?? 0) <= 0
            return (
              <div
                key={entry.combatantId}
                className={[
                  'pixel-border flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 text-center min-w-[60px]',
                  isActive ? 'bg-harm-900/40 border-harm-500 text-white torch-flicker' :
                  isDead   ? 'bg-void-900 border-void-700/30 text-void-700 line-through' :
                  entry.isPlayer ? 'bg-arcane-900/30 border-arcane-800/50 text-arcane-300' :
                  'bg-void-900 border-void-700/50 text-void-400',
                ].join(' ')}
              >
                <span className="font-mono text-xs font-bold">{entry.initiative}</span>
                <span className="text-[10px] truncate max-w-[56px]">{entry.name.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Battlefield — scrollable main area */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">

        {/* Enemy area */}
        <div className="flex-shrink-0 p-3 border-b border-void-700/50">
          <p className="font-pixel-display text-[9px] text-harm-400 mb-2 uppercase">Enemies</p>
          <div className="flex flex-col gap-2">
            {combat.enemies.map((enemy) => (
              <EnemyCard
                key={enemy.id}
                enemy={enemy}
                isActive={activeEntry?.combatantId === enemy.id && !isSummary}
                isTargetable={isPlayerTurn && enemy.currentHp > 0 && !isSummary}
                onAttack={() => playerAttack(enemy.id)}
                popups={popups.filter((p) => p.target === enemy.id)}
              />
            ))}
          </div>
        </div>

        {/* Player status */}
        <div className="flex-shrink-0 p-3 border-b border-void-700/50 relative">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-pixel-display text-[9px] text-arcane-400 uppercase">
              {playerSheet.name}
              {isPlayerTurn && !isSummary ? ' — YOUR TURN' : ''}
            </p>
            <span className={`font-mono text-sm ${combat.playerCurrentHp <= 0 ? 'text-harm-400' : combat.playerCurrentHp < playerSheet.maxHp * 0.3 ? 'text-harm-400' : 'text-heal-400'}`}>
              {combat.playerCurrentHp}/{playerSheet.maxHp} HP
            </span>
          </div>
          <HpBar current={combat.playerCurrentHp} max={playerSheet.maxHp} />
          <div className="relative h-0" aria-hidden="true">
            {popups.filter((p) => p.target === 'player').map((p) => (
              <DamageNumber key={p.id} amount={p.amount} kind={p.kind} className="top-0" />
            ))}
          </div>
          {isPlayerDown && !isSummary && (
            <div className="mt-2 chr-panel-arcane p-2 rounded text-center">
              <p className="text-harm-400 text-xs mb-1 font-body font-semibold">UNCONSCIOUS — Death Saves</p>
              <DeathSaveTracker successes={combat.playerDeathSuccesses} failures={combat.playerDeathFailures} />
            </div>
          )}
        </div>

        {/* Narration */}
        {pendingNarration && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-void-700/50">
            <p className="lore-text text-sm text-void-300">{pendingNarration}</p>
          </div>
        )}

        {/* Summary view */}
        {isSummary && (
          <div className="flex-shrink-0 p-4 text-center menu-enter">
            <PixelPanel variant="arcane" glow className="p-5 max-w-sm mx-auto">
              <p className="font-pixel-display text-[11px] text-arcane-400 mb-2 uppercase">
                {allEnemiesDefeated(combat) ? 'VICTORY' : combat.playerCurrentHp > 0 ? 'ESCAPED' : 'FALLEN'}
              </p>
              {combat.xpAwarded > 0 && (
                <p className="xp-gain-popup text-heal-400 font-mono font-bold text-lg mb-2" data-testid="xp-gain-display">
                  +{combat.xpAwarded} XP
                </p>
              )}
              {loot.length > 0 && (
                <div className="mb-3">
                  <p className="font-pixel-display text-[8px] text-arcane-400 mb-1 uppercase">Loot</p>
                  {loot.map((item) => (
                    <p key={item.id} className="text-void-300 text-xs">
                      {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
                      {item.goldValue > 0 ? ` (${item.goldValue}gp)` : ''}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-void-400 text-sm mb-4">
                {allEnemiesDefeated(combat)
                  ? 'All enemies have been defeated.'
                  : combat.playerCurrentHp > 0
                    ? 'You escaped the encounter.'
                    : 'You have fallen in battle.'}
              </p>
              <Button variant="arcane" className="w-full" onClick={endCombat} disabled={isSubmitting} loading={isSubmitting}>
                Continue
              </Button>
            </PixelPanel>
          </div>
        )}
      </div>

      {/* Action menu — only when player turn and not downed */}
      {isPlayerTurn && !isSummary && (
        <div className="flex-shrink-0 p-3 border-t border-void-700/50 bg-void-900/60" data-testid="action-menu">
          {isPlayerDown ? (
            <div className="flex flex-col gap-2">
              <p className="text-harm-400 text-xs text-center font-body">You must roll a death saving throw.</p>
              <Button variant="arcane" className="w-full" onClick={doDeathSave}>
                Roll Death Save
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="stat-label text-void-500 mb-1">Actions — {playerSheet.name}</p>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton
                  label={`Attack (${weapon.name})`}
                  sub="Choose a target above"
                  variant="harm"
                  disabled={combat.enemies.every((e) => e.currentHp <= 0)}
                  onClick={() => {
                    const alive = combat.enemies.find((e) => e.currentHp > 0)
                    if (alive) playerAttack(alive.id)
                  }}
                />
                <ActionButton label="Defend" sub="+2 AC this round" variant="spirit" onClick={playerDefend} />
                <ActionButton label="Flee" sub="Escape the battle" variant="ghost" onClick={playerFlee} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enemy turn — auto-resolve button */}
      {isEnemyTurn && !isSummary && (
        <div className="flex-shrink-0 p-3 border-t border-void-700/50 bg-void-900/60">
          <Button variant="ghost" className="w-full" onClick={doEnemyTurn}>
            Resolve Enemy Turn — {activeEntry?.name}
          </Button>
        </div>
      )}

      {/* Combat log */}
      <div className="flex-shrink-0 border-t border-void-700/50">
        <button
          type="button"
          onClick={() => setLogOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-body text-void-500 hover:text-void-300 transition-colors"
        >
          <span className="stat-label">Combat Log ({combat.log.length})</span>
          <span>{logOpen ? '▲' : '▾'}</span>
        </button>
        {logOpen && (
          <div className="max-h-32 overflow-y-auto px-3 pb-2 flex flex-col gap-1">
            {combat.log.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <span className={`flex-shrink-0 font-mono ${entry.isPlayer ? 'text-arcane-500' : 'text-harm-500'}`}>
                  R{entry.turn}
                </span>
                <span className={`${entry.critical ? 'text-arcane-300 font-semibold' : entry.miss ? 'text-void-600' : 'text-void-300'}`}>
                  {entry.description}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const colour = pct > 50 ? 'bg-heal-400' : pct > 20 ? 'bg-arcane-400' : 'bg-harm-400'
  return (
    <div className="pixel-bar-track h-2.5">
      <div className={`pixel-bar-fill ${colour}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function EnemyCard({
  enemy, isActive, isTargetable, onAttack, popups = [],
}: {
  enemy: EnemyCombatant
  isActive: boolean
  isTargetable: boolean
  onAttack: () => void
  popups?: DamagePopup[]
}) {
  const isDead = enemy.currentHp <= 0
  return (
    <div
      className={[
        'pixel-border relative flex items-center gap-3 p-2.5 transition-colors',
        isActive ? 'border-harm-600 bg-harm-900/20' :
        isDead   ? 'border-void-700/30 opacity-50' :
        isTargetable ? 'border-void-700/50 hover:border-harm-700/50 cursor-pointer' :
        'border-void-700/50',
      ].join(' ')}
      onClick={isTargetable ? onAttack : undefined}
      role={isTargetable ? 'button' : undefined}
      aria-label={isTargetable ? `Attack ${enemy.name}` : undefined}
      tabIndex={isTargetable ? 0 : undefined}
      onKeyDown={isTargetable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onAttack() } : undefined}
    >
      {popups.map((p) => (
        <DamageNumber key={p.id} amount={p.amount} kind={p.kind} className="top-2" />
      ))}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-body font-semibold text-sm ${isDead ? 'text-void-600 line-through' : 'text-white'}`}>
            {enemy.name}
          </span>
          {isDead && <Badge variant="neutral">Defeated</Badge>}
          {isActive && <Badge variant="harm">Active</Badge>}
        </div>
        {!isDead && (
          <div className="mt-1">
            <HpBar current={enemy.currentHp} max={enemy.maxHp} />
            <p className="text-void-500 text-xs mt-0.5 font-mono">{enemy.currentHp}/{enemy.maxHp} HP · AC {enemy.armorClass}</p>
          </div>
        )}
      </div>
      {isTargetable && (
        <span className="flex-shrink-0 text-harm-400 text-xs font-body">Attack ›</span>
      )}
    </div>
  )
}

function DeathSaveTracker({ successes, failures }: { successes: number; failures: number }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="flex items-center gap-1">
        <span className="text-heal-400 text-xs">✓</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`w-3 h-3 rounded-full border ${i < successes ? 'bg-heal-400 border-heal-400' : 'border-void-600'}`} />
        ))}
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`w-3 h-3 rounded-full border ${i < failures ? 'bg-harm-400 border-harm-400' : 'border-void-600'}`} />
        ))}
        <span className="text-harm-400 text-xs">✗</span>
      </div>
    </div>
  )
}

function ActionButton({
  label, sub, variant, onClick, disabled,
}: {
  label: string
  sub: string
  variant: 'harm' | 'spirit' | 'ghost'
  onClick: () => void
  disabled?: boolean
}) {
  const base = 'flex flex-col items-start px-3 py-3 min-h-[44px] rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 disabled:opacity-40 disabled:cursor-not-allowed'
  const styles = {
    harm:   'bg-harm-900/20 border-harm-700/50 text-harm-300 hover:bg-harm-900/40 hover:border-harm-600',
    spirit: 'bg-spirit-900/20 border-spirit-700/50 text-spirit-300 hover:bg-spirit-900/40 hover:border-spirit-600',
    ghost:  'bg-void-900 border-void-700/50 text-void-300 hover:border-void-500',
  }
  return (
    <button type="button" className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>
      <span className="font-body font-semibold text-sm">{label}</span>
      <span className="text-[10px] opacity-60">{sub}</span>
    </button>
  )
}

