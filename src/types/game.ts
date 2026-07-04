/**
 * Chronicle AI — Core Game Types
 * Phase 1.3 update: stub types replaced by canonical definitions.
 *
 * - Character     → CharacterSheet in src/lib/engine/character.ts
 * - Campaign      → Campaign in src/types/campaign.ts
 * - GameMode      → GameMode in src/types/campaign.ts
 * - DiceRoll      → RollResult in src/lib/engine/dice.ts
 *
 * This file retains only types with no other canonical home.
 */

import type { GameMode } from './campaign'

export type GameStatus = 'idle' | 'active' | 'paused' | 'completed'

// Re-export so consumers can import GameMode from either location
export type { GameMode }

export interface Session {
  id: string
  campaignId: string
  turnNumber: number
  status: GameStatus
  currentMode: GameMode
  startedAt: string
  endedAt: string | null
}

export interface NarrativeTurn {
  id: string
  sessionId: string
  turnNumber: number
  playerInput: string
  aiNarration: string
  diceRolls: unknown[]   // typed as ResolutionSummary[] at call sites
  mode: GameMode
  createdAt: string
}
