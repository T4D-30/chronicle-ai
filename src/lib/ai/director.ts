/**
 * Chronicle AI — Director
 * Phase 2.4 (header updated Phase 10.0 audit — see notes below)
 *
 * Parses the narrate Edge Function response and applies world-state updates.
 * No AI logic lives here — this is purely a response handler.
 *
 * The Director System (full spec in CHRONICLE_GAME_LOOP.md):
 * - Receives combatTriggered signal — ✅ implemented (Phase 8.3+): the caller
 *   (useAdventureSession.ts) auto-enters combat via initCombat() when this
 *   fires. This module only parses the signal; the transition itself lives
 *   in the hook, not here.
 * - Applies worldStateUpdates to campaign — ✅ implemented (Phase 9.2+): the
 *   caller applies these via applyWorldStateUpdate()/updateWorldState() in
 *   useAdventureSession.ts. This module only parses/passes through the raw
 *   update object; it does not apply it.
 * - Surfaces suggestedActions to the action bar — ✅ implemented here
 * - Logs mapUpdate signals — still 🔲 not implemented; Atlas (Phase 6) has
 *   no map canvas to update. This remains genuinely deferred, unlike the
 *   two items above which were stale claims left over from Phase 2.4 and
 *   corrected during the Phase 10.0 repository audit.
 */

import type { NarrateResponse } from './promptBuilder'

// ─── Director result after parsing the narrate response ──────────────────────

export interface DirectorResult {
  narration: string
  suggestedActions: string[]
  /** True if the Director signals combat should begin. Phase 5 handles transition. */
  combatTriggered: boolean
  /** Raw world state updates for Phase 3 to apply. */
  worldStateUpdates: Record<string, unknown>
  /** Raw plot thread / NPC memory updates for the Quest Log and Codex. Phase 9.2. */
  directorConfigUpdates: Record<string, unknown>
  /** Turn ID for local state sync. */
  turnId: string
}

// ─── Validation limits ────────────────────────────────────────────────────────

const MAX_NARRATION_LENGTH = 4000
const MAX_SUGGESTED_ACTIONS = 4
const MAX_ACTION_LENGTH = 120

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse and validate a NarrateResponse into a DirectorResult.
 * Sanitizes all string fields — never passes raw API output to the UI.
 */
export function parseDirectorResponse(response: NarrateResponse): DirectorResult {
  const narration = sanitizeString(response.narration, MAX_NARRATION_LENGTH)

  const suggestedActions = Array.isArray(response.suggestedActions)
    ? response.suggestedActions
        .slice(0, MAX_SUGGESTED_ACTIONS)
        .map((a) => sanitizeString(String(a), MAX_ACTION_LENGTH))
        .filter(Boolean)
    : []

  const combatTriggered = Boolean(response.combatTriggered)

  const worldStateUpdates =
    response.worldStateUpdates && typeof response.worldStateUpdates === 'object'
      ? response.worldStateUpdates
      : {}

  const directorConfigUpdates =
    response.directorConfigUpdates && typeof response.directorConfigUpdates === 'object'
      ? response.directorConfigUpdates
      : {}

  if (combatTriggered) {
    // Dev-visibility log only — useAdventureSession.ts is what actually
    // transitions into combat on this signal (initCombat()). This message
    // previously said "Phase 5 will handle transition," left over from
    // before that wiring existed; corrected during the Phase 10.0 audit.
    console.info('[Director] combatTriggered signal received.')
  }

  if (response.mapUpdate) {
    // Phase 6: Living Atlas will consume this.
    console.info('[Director] mapUpdate signal received — Phase 6 will handle atlas update.')
  }

  return {
    narration,
    suggestedActions,
    combatTriggered,
    worldStateUpdates,
    directorConfigUpdates,
    turnId: response.turnId,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeString(value: string, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

/**
 * Extract a fallback narration from an error, suitable for display in the
 * story surface (StoryHud) when the Edge Function fails.
 */
export function buildFallbackNarration(error: unknown): string {
  if (error instanceof Error) {
    // Surface benign messages; hide anything that looks like an internal error
    if (error.message.length < 200 && !error.message.includes('stack')) {
      return `[Director unavailable: ${error.message}]`
    }
  }
  return '[The Director is momentarily silent. Try your action again.]'
}
