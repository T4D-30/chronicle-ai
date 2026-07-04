/**
 * Chronicle AI — Combat Engine
 * Phase 5
 *
 * Pure deterministic functions for combat resolution.
 * No UI, no AI, no Supabase calls.
 * All randomness flows through the existing dice engine (rollDie / rollD20).
 *
 * Spec: CHRONICLE_GAME_LOOP.md — Combat Mode — Detailed
 * - Attack roll: d20 + proficiency (if proficient) + STR or DEX mod vs target AC
 * - Critical hit: natural 20 → double damage dice
 * - Critical miss: natural 1 → automatic miss
 * - Saving throws: d20 + relevant mod vs DC
 * - Death saves: 3 successes = stable, 3 failures = dead
 * - Conditions applied per D&D rules
 */

import { rollD20, rollDie } from './dice'
import type { RollResult, DieNotation } from './dice'
import { getAbilityModifier, getProficiencyBonus } from './character'
import type { CharacterSheet } from './character'

// ─── Combatant types ──────────────────────────────────────────────────────────

export interface CombatantId {
  id: string
  name: string
  isPlayer: boolean
}

/** A player combatant — backed by a full CharacterSheet. */
export interface PlayerCombatant extends CombatantId {
  isPlayer: true
  sheet: CharacterSheet
}

/** An enemy combatant — Director-assigned stat block. */
export interface EnemyCombatant extends CombatantId {
  isPlayer: false
  maxHp: number
  currentHp: number
  armorClass: number
  /** d20 attack bonus (proficiency + stat already factored in). */
  attackBonus: number
  /** Damage die notation, e.g. "d8" or "d6". */
  damageDie: DieNotation
  /** Flat damage bonus (e.g. STR mod). */
  damageBonus: number
  /** DEX modifier for initiative. */
  dexMod: number
  /** Optional condition immunities / resistances — not enforced yet (Phase 5 stretch). */
  conditionImmunities?: string[]
}

export type Combatant = PlayerCombatant | EnemyCombatant

// ─── Initiative ───────────────────────────────────────────────────────────────

export interface InitiativeEntry {
  combatantId: string
  name: string
  isPlayer: boolean
  roll: RollResult
  /** Final initiative value = roll.total (already includes dex mod). */
  initiative: number
}

/**
 * Roll initiative for a single combatant.
 * Formula: d20 + DEX modifier.
 */
export function rollInitiative(
  combatantId: string,
  name: string,
  isPlayer: boolean,
  dexMod: number,
): InitiativeEntry {
  const roll = rollD20(dexMod)
  return {
    combatantId,
    name,
    isPlayer,
    roll,
    initiative: roll.total,
  }
}

/**
 * Roll initiative for all combatants and return them in descending order.
 * Ties broken by: player first, then random (stable sort keeps insertion order for equals).
 */
export function buildInitiativeOrder(
  player: PlayerCombatant,
  enemies: EnemyCombatant[],
): InitiativeEntry[] {
  const playerDexMod = getAbilityModifier(player.sheet.scores.dexterity)
  const entries: InitiativeEntry[] = [
    rollInitiative(player.id, player.name, true, playerDexMod),
    ...enemies.map((e) => rollInitiative(e.id, e.name, false, e.dexMod)),
  ]

  return entries.sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    // Ties: player goes first
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1
    return 0
  })
}

// ─── Attack resolution ────────────────────────────────────────────────────────

export interface AttackResult {
  attackRoll: RollResult
  hit: boolean
  critical: boolean
  miss: boolean          // includes fumble
  naturalOne: boolean
  damageRoll: RollResult | null
  totalDamage: number
  /** Post-attack target HP (clamped to 0). */
  newTargetHp: number
}

/**
 * Resolve a player's attack against an enemy.
 * Attack formula: d20 + (proficiencyBonus if proficient) + STR or DEX mod
 */
export function resolvePlayerAttack(
  attacker: CharacterSheet,
  target: EnemyCombatant,
  opts: {
    weaponDamageDie: DieNotation
    weaponDamageBonus: number
    /** Whether the character is proficient with this weapon. */
    proficient: boolean
    /** Use DEX instead of STR (finesse / ranged). */
    usesDex: boolean
  },
): AttackResult {
  const { weaponDamageDie, weaponDamageBonus, proficient, usesDex } = opts
  const prof = getProficiencyBonus(attacker.level)
  const statMod = usesDex
    ? getAbilityModifier(attacker.scores.dexterity)
    : getAbilityModifier(attacker.scores.strength)
  const attackMod = statMod + (proficient ? prof : 0)

  const attackRoll = rollD20(attackMod)
  const isCrit = attackRoll.isNatural20
  const isFumble = attackRoll.isNatural1

  if (isFumble || (!isCrit && attackRoll.total < target.armorClass)) {
    return {
      attackRoll,
      hit: false,
      critical: false,
      miss: true,
      naturalOne: isFumble,
      damageRoll: null,
      totalDamage: 0,
      newTargetHp: target.currentHp,
    }
  }

  // Hit — roll damage (double dice on crit)
  const diceCount = isCrit ? 2 : 1
  const damageRolls = Array.from({ length: diceCount }, () =>
    rollDie(weaponDamageDie, weaponDamageBonus),
  )
  // For crits, combine the two rolls manually
  const baseDamage = damageRolls.reduce((sum, r) => sum + r.rolls.filter((v) => v.kept).reduce((s, v) => s + v.face, 0), 0)
  const totalDamage = Math.max(1, baseDamage + weaponDamageBonus)
  const newTargetHp = Math.max(0, target.currentHp - totalDamage)

  return {
    attackRoll,
    hit: true,
    critical: isCrit,
    miss: false,
    naturalOne: false,
    damageRoll: damageRolls[0],
    totalDamage,
    newTargetHp,
  }
}

/**
 * Resolve an enemy's attack against the player.
 */
export function resolveEnemyAttack(
  attacker: EnemyCombatant,
  target: CharacterSheet,
): AttackResult {
  const attackRoll = rollD20(attacker.attackBonus)
  const isCrit = attackRoll.isNatural20
  const isFumble = attackRoll.isNatural1

  if (isFumble || (!isCrit && attackRoll.total < target.armorClass)) {
    return {
      attackRoll,
      hit: false,
      critical: false,
      miss: true,
      naturalOne: isFumble,
      damageRoll: null,
      totalDamage: 0,
      newTargetHp: target.currentHp,
    }
  }

  const diceCount = isCrit ? 2 : 1
  const damageRolls = Array.from({ length: diceCount }, () =>
    rollDie(attacker.damageDie, attacker.damageBonus),
  )
  const baseDamage = damageRolls.reduce((sum, r) => sum + r.rolls.filter((v) => v.kept).reduce((s, v) => s + v.face, 0), 0)
  const totalDamage = Math.max(1, baseDamage + attacker.damageBonus)
  const newTargetHp = Math.max(0, target.currentHp - totalDamage)

  return {
    attackRoll,
    hit: true,
    critical: isCrit,
    miss: false,
    naturalOne: false,
    damageRoll: damageRolls[0],
    totalDamage,
    newTargetHp,
  }
}

// ─── Death saves ──────────────────────────────────────────────────────────────

export type DeathSaveOutcome = 'success' | 'failure' | 'stable' | 'dead' | 'revived'

export interface DeathSaveResult {
  roll: RollResult
  outcome: DeathSaveOutcome
  successesTotal: number
  failuresTotal: number
}

/**
 * Roll a death saving throw.
 * DC 10. Nat 20 = stabilize with 1 HP. Nat 1 = 2 failures.
 * 3 successes = stable. 3 failures = dead.
 */
export function rollDeathSave(
  currentSuccesses: number,
  currentFailures: number,
): DeathSaveResult {
  const roll = rollD20()

  if (roll.isNatural20) {
    return {
      roll, outcome: 'revived',
      successesTotal: currentSuccesses,
      failuresTotal: currentFailures,
    }
  }

  const isSuccess = roll.total >= 10
  // Nat 1 counts as 2 failures
  const failDelta = roll.isNatural1 ? 2 : 1

  const newSuccesses = currentSuccesses + (isSuccess ? 1 : 0)
  const newFailures = currentFailures + (isSuccess ? 0 : failDelta)

  let outcome: DeathSaveOutcome
  if (newFailures >= 3) outcome = 'dead'
  else if (newSuccesses >= 3) outcome = 'stable'
  else outcome = isSuccess ? 'success' : 'failure'

  return {
    roll, outcome,
    successesTotal: newSuccesses,
    failuresTotal: Math.min(newFailures, 3),
  }
}

// ─── Concentration save ───────────────────────────────────────────────────────

/**
 * CON save after taking damage: DC = max(10, half damage taken).
 * Returns the roll result and whether concentration was maintained.
 */
export function rollConcentrationSave(
  sheet: CharacterSheet,
  damageTaken: number,
): { roll: RollResult; maintained: boolean; dc: number } {
  const dc = Math.max(10, Math.floor(damageTaken / 2))
  const conMod = getAbilityModifier(sheet.scores.constitution)
  const roll = rollD20(conMod)
  return { roll, maintained: roll.total >= dc, dc }
}

// ─── Combat state ─────────────────────────────────────────────────────────────

export type CombatPhase = 'initiative' | 'player_turn' | 'enemy_turn' | 'summary' | 'ended'

export interface CombatLogEntry {
  id: string
  turn: number
  actorName: string
  isPlayer: boolean
  description: string
  attackRoll?: number
  damageDealt?: number
  critical?: boolean
  miss?: boolean
}

export interface CombatState {
  phase: CombatPhase
  round: number
  initiativeOrder: InitiativeEntry[]
  /** Index into initiativeOrder — whose turn it is. */
  activeIndex: number
  enemies: EnemyCombatant[]
  /** Player HP during combat (may differ from sheet if not synced yet). */
  playerCurrentHp: number
  playerDeathSuccesses: number
  playerDeathFailures: number
  log: CombatLogEntry[]
  /** XP awarded on combat end. */
  xpAwarded: number
}

let _logId = 0
export function makeCombatLogEntry(
  turn: number,
  actorName: string,
  isPlayer: boolean,
  description: string,
  extras: Partial<Pick<CombatLogEntry, 'attackRoll' | 'damageDealt' | 'critical' | 'miss'>> = {},
): CombatLogEntry {
  return { id: `clog-${++_logId}`, turn, actorName, isPlayer, description, ...extras }
}

/**
 * Initialise a new combat state.
 * Phase: 'initiative' — call buildInitiativeOrder() to advance to player_turn / enemy_turn.
 */
export function initCombat(
  player: PlayerCombatant,
  enemies: EnemyCombatant[],
): CombatState {
  const initiativeOrder = buildInitiativeOrder(player, enemies)
  const firstIsPlayer = initiativeOrder[0]?.isPlayer ?? true

  return {
    phase: firstIsPlayer ? 'player_turn' : 'enemy_turn',
    round: 1,
    initiativeOrder,
    activeIndex: 0,
    enemies: enemies.map((e) => ({ ...e })), // defensive copy
    playerCurrentHp: player.sheet.currentHp,
    playerDeathSuccesses: player.sheet.deathSaveSuccesses,
    playerDeathFailures: player.sheet.deathSaveFailures,
    log: [
      makeCombatLogEntry(0, 'System', false, `Combat begins! Initiative: ${initiativeOrder.map((e) => `${e.name} (${e.initiative})`).join(', ')}`),
    ],
    xpAwarded: 0,
  }
}

/**
 * Advance to the next combatant's turn.
 * Skips dead enemies (currentHp === 0).
 * Increments round when wrapping around the initiative order.
 */
export function advanceTurn(state: CombatState): CombatState {
  const total = state.initiativeOrder.length
  let next = (state.activeIndex + 1) % total
  let round = state.round
  if (next === 0) round++

  // Skip dead enemies
  while (
    next !== state.activeIndex &&
    !state.initiativeOrder[next].isPlayer &&
    (state.enemies.find((e) => e.id === state.initiativeOrder[next].combatantId)?.currentHp ?? 0) === 0
  ) {
    next = (next + 1) % total
    if (next === 0) round++
  }

  const nextEntry = state.initiativeOrder[next]
  return {
    ...state,
    round,
    activeIndex: next,
    phase: nextEntry.isPlayer ? 'player_turn' : 'enemy_turn',
  }
}

/**
 * Check if all enemies are defeated.
 */
export function allEnemiesDefeated(state: CombatState): boolean {
  return state.enemies.every((e) => e.currentHp <= 0)
}

/**
 * Simple XP formula: sum of enemy max HP values.
 * A proper XP table belongs to Phase 3 Campaign Loop.
 */
export function calculateXp(enemies: EnemyCombatant[]): number {
  return enemies.reduce((sum, e) => sum + Math.floor(e.maxHp / 2), 0)
}

// ─── XP progression ───────────────────────────────────────────────────────────

/**
 * XP required to reach the given level.
 * Follows a D&D-adjacent exponential curve (simplified for solo play).
 */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
}

/** XP needed to reach the next level from currentLevel. */
export function getXpForNextLevel(currentLevel: number): number {
  const nextLevel = Math.min(currentLevel + 1, 20)
  return XP_THRESHOLDS[nextLevel] ?? XP_THRESHOLDS[20]
}

/** True if total XP crosses the threshold for level + 1. */
export function isReadyToLevel(totalXp: number, currentLevel: number): boolean {
  if (currentLevel >= 20) return false
  return totalXp >= getXpForNextLevel(currentLevel)
}

// ─── Loot ─────────────────────────────────────────────────────────────────────

/** A single loot item dropped after combat. */
export interface LootItem {
  id: string
  name: string
  quantity: number
  goldValue: number
  description: string
}

/** Parse loot from Director worldStateUpdates.loot array — safe fallback. */
export function parseLootFromDirector(
  worldStateUpdates: Record<string, unknown>,
): LootItem[] {
  const raw = worldStateUpdates['loot']
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && typeof (item as Record<string,unknown>)['name'] === 'string',
    )
    .slice(0, 10) // cap at 10 items
    .map((item, i) => ({
      id: `loot-${Date.now()}-${i}`,
      name: String(item['name']).slice(0, 100),
      quantity: typeof item['quantity'] === 'number' && item['quantity'] > 0 ? Math.floor(item['quantity']) : 1,
      goldValue: typeof item['goldValue'] === 'number' && item['goldValue'] >= 0 ? Math.floor(item['goldValue']) : 0,
      description: typeof item['description'] === 'string' ? String(item['description']).slice(0, 300) : '',
    }))
}

// ─── Enemy parsing from Director ──────────────────────────────────────────────

const VALID_DAMAGE_DICE: DieNotation[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']

/**
 * Parse enemies from Director worldStateUpdates.enemies array.
 * Returns an empty array (not an error) if the data is missing or malformed —
 * the combat system must always start, even with placeholder enemies.
 */
export function parseEnemiesFromDirector(
  worldStateUpdates: Record<string, unknown>,
): EnemyCombatant[] {
  const raw = worldStateUpdates['enemies']
  if (!Array.isArray(raw) || raw.length === 0) return []

  return raw
    .filter((e): e is Record<string, unknown> =>
      typeof e === 'object' && e !== null,
    )
    .slice(0, 8) // cap at 8 enemies
    .map((e, i) => {
      const name = typeof e['name'] === 'string' && e['name'].trim()
        ? e['name'].trim().slice(0, 80)
        : `Enemy ${i + 1}`

      const maxHp = typeof e['maxHp'] === 'number' && e['maxHp'] > 0
        ? Math.min(Math.floor(e['maxHp']), 999)
        : 10

      const armorClass = typeof e['armorClass'] === 'number' && e['armorClass'] > 0
        ? Math.min(Math.floor(e['armorClass']), 30)
        : 12

      const attackBonus = typeof e['attackBonus'] === 'number'
        ? Math.max(-5, Math.min(Math.floor(e['attackBonus']), 20))
        : 2

      const rawDie = typeof e['damageDie'] === 'string' ? e['damageDie'] as DieNotation : 'd6'
      const damageDie: DieNotation = VALID_DAMAGE_DICE.includes(rawDie) ? rawDie : 'd6'

      const damageBonus = typeof e['damageBonus'] === 'number'
        ? Math.max(-5, Math.min(Math.floor(e['damageBonus']), 20))
        : 0

      const dexMod = typeof e['dexMod'] === 'number'
        ? Math.max(-5, Math.min(Math.floor(e['dexMod']), 10))
        : 0

      const xpValue = typeof e['xpValue'] === 'number' && e['xpValue'] >= 0
        ? Math.floor(e['xpValue'])
        : Math.floor(maxHp / 2)

      return {
        id: `enemy-${i}-${Date.now()}`,
        name,
        isPlayer: false as const,
        maxHp,
        currentHp: maxHp,
        armorClass,
        attackBonus,
        damageDie,
        damageBonus,
        dexMod,
        xpValue,
      } satisfies EnemyCombatant & { xpValue: number }
    })
}

// ─── CombatResult ─────────────────────────────────────────────────────────────

export type CombatOutcome = 'victory' | 'defeat' | 'fled'

export interface CombatResult {
  outcome: CombatOutcome
  xpAwarded: number
  loot: LootItem[]
  enemiesDefeated: EnemyCombatant[]
  rounds: number
  finalPlayerHp: number
  log: CombatLogEntry[]
  /** ISO timestamp when combat ended. */
  endedAt: string
}

/**
 * Build a CombatResult from the completed CombatState.
 * Called once when the player clicks Continue on the summary screen.
 */
export function buildCombatResult(
  state: CombatState,
  loot: LootItem[],
): CombatResult {
  const outcome: CombatOutcome =
    state.playerCurrentHp <= 0 && state.playerDeathFailures >= 3 ? 'defeat' :
    allEnemiesDefeated(state) ? 'victory' : 'fled'

  return {
    outcome,
    xpAwarded: state.xpAwarded,
    loot,
    enemiesDefeated: state.enemies.filter((e) => e.currentHp <= 0),
    rounds: state.round,
    finalPlayerHp: Math.max(0, state.playerCurrentHp),
    log: state.log,
    endedAt: new Date().toISOString(),
  }
}

/**
 * Build a plain-text summary of a combat encounter.
 * Used as the `aiNarration` field when appending a combat turn to the session.
 */
export function summariseCombatResult(result: CombatResult): string {
  const { outcome, enemiesDefeated, xpAwarded, rounds, loot } = result

  const outcomeText =
    outcome === 'victory' ? 'Victory!' :
    outcome === 'defeat'  ? 'Defeat.' :
                            'You escaped.'

  const enemyText = enemiesDefeated.length > 0
    ? `Defeated: ${enemiesDefeated.map((e) => e.name).join(', ')}.`
    : ''

  const xpText = xpAwarded > 0 ? `${xpAwarded} XP earned.` : ''
  const lootText = loot.length > 0 ? `Loot: ${loot.map((l) => l.name).join(', ')}.` : ''

  return [outcomeText, `${rounds} rounds.`, enemyText, xpText, lootText]
    .filter(Boolean).join(' ')
}
