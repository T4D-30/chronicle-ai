/**
 * Chronicle AI — Resolution Engine
 * Phase 1.6: Gameplay Engine Completion
 *
 * Public API — import from here, not from submodules directly.
 *
 * Modules:
 *   dice.ts             — dice rolling, notation parsing, seeded RNG, advantage/disadvantage
 *   outcome.ts          — 5-tier Outcome enum, roll evaluator
 *   intent.ts           — action text → ActionIntent, stat utilities
 *   resolveAction.ts    — pipeline orchestrator + automatic character resolution
 *   character.ts        — CharacterSheet type, HP formula, factory, serialisation
 *   conditions.ts       — condition definitions, apply/remove/toggle, modifiers, serialisation
 *   skills.ts           — 18-skill table, skill → ability mapping
 *   equipment.ts        — equipment bonus contract (flat bonuses only)
 *   pipeline.ts         — 8-stage deterministic modifier pipeline (individually testable)
 *   actionValidation.ts — canPerformAction() pure gate before any roll
 */

export const ENGINE_VERSION = '1.6.0'

export function getEngineStatus() {
  return { version: ENGINE_VERSION, phase: 1, ready: true }
}

// ── Dice ──────────────────────────────────────────────────────────────────────
export type {
  DieSize,
  DieNotation,
  RollMode,
  SingleRoll,
  RollResult,
  ParsedNotation,
  DCTier,
} from './dice'

export {
  DIE_SIZES,
  ALL_DICE,
  DC,
  createSeededRng,
  setRng,
  resetRng,
  parseNotation,
  formatNotation,
  rollDie,
  rollNotation,
  rollD20,
  rollPool,
} from './dice'

// ── Outcome ───────────────────────────────────────────────────────────────────
export { Outcome, OUTCOME_META } from './outcome'
export type { OutcomeMeta, CheckResult } from './outcome'
export { evaluateRoll, evaluateTotal } from './outcome'

// ── Intent ────────────────────────────────────────────────────────────────────
export type {
  StatName,
  ActionCategory,
  ActionIntent,
  SituationalModifier,
} from './intent'

export {
  ALL_STATS,
  classifyAction,
  parseAction,
  statModifier,
  isValidStat,
} from './intent'

// ── Resolver ──────────────────────────────────────────────────────────────────
export type {
  CheckConfig,
  ResolutionResult,
  ResolutionSummary,
  ModifierComponent,
  CharacterActionInput,
  CharacterActionResult,
  BreakdownLine,
} from './resolveAction'

export {
  resolveAction,
  resolveCheck,
  summariseResolution,
  summariseCharacterAction,
  resolveCharacterAction,
  formatBreakdown,
} from './resolveAction'

// ── Character ─────────────────────────────────────────────────────────────────
export type {
  HitDie,
  AbilityScores,
  CharacterSheet,
  CharacterInput,
  CharacterSummary,
  HpConfig,
} from './character'

export {
  getAbilityModifier,
  ABILITY_SCORE_MIN,
  ABILITY_SCORE_MAX,
  LEVEL_MIN,
  LEVEL_MAX,
  BASE_UNARMORED_AC,
  HIT_DIE_AVERAGE,
  ARCHETYPE_HIT_DIE,
  DEFAULT_HIT_DIE,
  DEFAULT_ABILITY_SCORES,
  isValidAbilityScore,
  isValidLevel,
  validateAbilityScores,
  computeModifiers,
  getProficiencyBonus,
  resolveHitDie,
  calculateMaxHp,
  buildCharacter,
  summarizeCharacter,
} from './character'

// ── Skills ────────────────────────────────────────────────────────────────────
export type { SkillId } from './skills'
export {
  SKILL_IDS,
  SKILL_ABILITY,
  SKILL_DISPLAY_NAME,
  isValidSkillId,
  getSkillAbility,
} from './skills'

// ── Equipment ─────────────────────────────────────────────────────────────────
export type { EquipmentSlot, EquipmentItem, EquipmentLoadout } from './equipment'
export {
  validateEquipmentItem,
  getEquipmentAttackBonus,
  getEquipmentArmorBonus,
  getEquipmentSkillBonus,
  getEquipmentSaveBonus,
  getEquipmentPassiveBonus,
} from './equipment'

// ── Conditions ────────────────────────────────────────────────────────────────
export type {
  ConditionId,
  ConditionDefinition,
  ConditionModifier,
  RollContext,
  ActiveCondition,
  ActiveConditionSet,
  ConcentrationState,
} from './conditions'

export {
  CONDITION_IDS,
  CONDITIONS,
  getConditionDefinition,
  isValidConditionId,
  createActiveCondition,
  applyCondition,
  removeCondition,
  toggleCondition,
  hasCondition,
  getActiveCondition,
  isIncapacitated,
  isImmobilized,
  resolveConditionModifiers,
  expireConditions,
  breakConcentration,
  parseConditionsFromDb,
  serializeConditionsForDb,
} from './conditions'

// ── Pipeline ──────────────────────────────────────────────────────────────────
export type {
  PipelineStep,
  PipelineStageName,
  CheckKind,
  PipelineInput,
  PipelineResult,
} from './pipeline'

export {
  stageBaseAbility,
  stageSkillProficiency,
  stageSavingThrowProficiency,
  stageEquipment,
  stageConditions,
  stageTemporaryEffects,
  resolveAdvantageDisadvantage,
  calculateFinalModifier,
  isCharacterIncapacitated,
  checkKindToRollContext,
  runPipeline,
  formatSigned,
} from './pipeline'

// ── Action Validation ─────────────────────────────────────────────────────────
export type {
  ActionKind,
  ActionDescriptor,
  BlockingReason,
  ActionValidationResult,
} from './actionValidation'

export { canPerformAction } from './actionValidation'

// ── Combat ────────────────────────────────────────────────────────────────────
export type {
  CombatantId,
  PlayerCombatant,
  EnemyCombatant,
  Combatant,
  InitiativeEntry,
  AttackResult,
  DeathSaveResult,
  DeathSaveOutcome,
  CombatPhase,
  CombatLogEntry,
  CombatState,
  LootItem,
  CombatOutcome,
  CombatResult,
} from './combat'

export {
  rollInitiative,
  buildInitiativeOrder,
  resolvePlayerAttack,
  resolveEnemyAttack,
  rollDeathSave,
  rollConcentrationSave,
  initCombat,
  advanceTurn,
  allEnemiesDefeated,
  calculateXp,
  makeCombatLogEntry,
  XP_THRESHOLDS,
  getXpForNextLevel,
  isReadyToLevel,
  parseLootFromDirector,
  parseEnemiesFromDirector,
  buildCombatResult,
  summariseCombatResult,
} from './combat'
