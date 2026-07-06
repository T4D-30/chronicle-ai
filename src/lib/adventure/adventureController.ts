/**
 * Adventure Controller
 *
 * Orchestrates a single player turn: resolves mechanics through the Rules
 * Engine, calls the AI Director for narration, and applies the resulting
 * persistence updates. Framework-agnostic — holds no React state and is
 * called by useAdventureSession.ts, which maps its callbacks onto state.
 *
 * Extracted from useAdventureSession.ts's submitAction(). Behavior is
 * unchanged — this is a relocation, not a rewrite.
 */

import {
  updateWorldState,
  updateDirectorConfig,
} from '@/lib/supabase'
import type { Campaign, CharacterRecord, GameSession, NarrativeTurn } from '@/lib/supabase'
import {
  applyWorldStateUpdate,
  hasWorldStateChanges,
  applyDirectorConfigUpdate,
  hasDirectorConfigChanges,
} from '@/lib/engine/worldDispatcher'
import {
  buildNarrateRequest,
  callNarrateStreaming,
  parseDirectorResponse,
} from '@/lib/ai'
import type { DirectorResult, NarrateRequest } from '@/lib/ai'
import {
  initCombat,
  parseEnemiesFromDirector,
  parseAction,
  resolveCharacterAction,
  summariseCharacterAction,
} from '@/lib/engine'
import type { CombatState } from '@/lib/engine'
import { getActiveDocumentRetriever } from '@/lib/directorDocuments/fullTextRetriever'

export type CheckSummary = ReturnType<typeof summariseCharacterAction>

export interface TurnContext {
  campaign: Campaign
  character: CharacterRecord
  session: GameSession
  recentTurns: NarrativeTurn[]
  playerInput: string
}

export interface TurnResult {
  turn: NarrativeTurn
  directorResult: DirectorResult
  updatedCampaign: Campaign
  checkSummary: CheckSummary | null
  /** Non-null only when the Director signaled combat should begin. */
  combatState: CombatState | null
}

export interface RunPlayerTurnCallbacks {
  onToken: (token: string) => void
  /**
   * Fired the moment the underlying narrate stream actually starts, with
   * the AbortController that cancels it. Mirrors the exact point at which
   * the original submitAction() assigned streamControllerRef.current, so
   * cancelStream() semantics are unchanged.
   */
  onStreamStart: (controller: AbortController) => void
  onResult: (result: TurnResult) => void
  onError: (error: unknown) => void
}

/**
 * Resolve a player's action through the Rules Engine, narrate it via the AI
 * Director, and persist the resulting world/director-config updates.
 */
export function runPlayerTurn(ctx: TurnContext, callbacks: RunPlayerTurnCallbacks): void {
  const { campaign, character, session, recentTurns, playerInput } = ctx
  const trimmedInput = playerInput.trim()

  // ── Full dice transparency (Phase 9.3, locked Director rule) ────────────
  // Only actions that classify into a real skill category roll a check.
  // parseAction() is pure and supplies the intent's own suggestedDc;
  // resolveCharacterAction() is then called exactly once with that DC so a
  // single player action never consumes two dice rolls from the RNG stream.
  const parsedIntent = parseAction(trimmedInput)
  let checkSummary: CheckSummary | null = null
  if (parsedIntent.category !== 'UNKNOWN') {
    const actionResult = resolveCharacterAction({
      character: character.sheet,
      intent: trimmedInput,
      dc: parsedIntent.suggestedDc,
    })
    if (actionResult.resolution) {
      checkSummary = summariseCharacterAction(actionResult.resolution)
    }
  }

  void (async () => {
    // ── Director document retrieval (Phase 10.3) ───────────────────────────
    // Fail open — an unavailable retriever degrades to "no document context
    // this turn," never a blocked turn submission.
    let documentContext: NonNullable<NarrateRequest['documentContext']> = []
    try {
      const retriever = getActiveDocumentRetriever()
      const results = await retriever.retrieve(campaign.id, trimmedInput, 5)
      documentContext = results.map((r) => ({
        fileName: r.fileName,
        category: r.category,
        excerpt: r.excerpt,
      }))
    } catch {
      documentContext = []
    }

    const request = buildNarrateRequest({
      session,
      campaign,
      character: character.sheet,
      playerInput: trimmedInput,
      recentTurns,
      checkResult: checkSummary
        ? {
            category: checkSummary.category,
            stat: checkSummary.stat,
            dc: checkSummary.dc,
            total: checkSummary.roll.total,
            outcome: checkSummary.outcome,
            outcomeLabel: checkSummary.outcomeLabel,
            isSuccess: checkSummary.isSuccess,
          }
        : undefined,
      documentContext,
    })

    const streamController = callNarrateStreaming(request, {
      onToken: callbacks.onToken,
      onDone: (response) => {
        void (async () => {
          try {
            const result = parseDirectorResponse(response)

            const turn: NarrativeTurn = {
              id: result.turnId,
              sessionId: request.sessionId,
              turnNumber: session.turnNumber + 1,
              playerInput: trimmedInput,
              aiNarration: result.narration,
              diceRolls: checkSummary ? [checkSummary] : [],
              mode: request.mode,
              createdAt: new Date().toISOString(),
            }

            // Persist world state updates (current location, new locations,
            // NPC alive status).
            let updatedCampaign: Campaign = campaign
            if (hasWorldStateChanges(result.worldStateUpdates)) {
              const newWorldState = applyWorldStateUpdate(updatedCampaign.worldState, result.worldStateUpdates)
              updatedCampaign = await updateWorldState(updatedCampaign.id, newWorldState)
            }

            // Persist Director config updates (plot threads / NPC memory —
            // Quest Log and Codex). Applied on top of whatever
            // updatedCampaign is at this point so both writes aren't lost
            // to a stale read.
            if (hasDirectorConfigChanges(result.directorConfigUpdates)) {
              const newDirectorConfig = applyDirectorConfigUpdate(
                updatedCampaign.directorConfig,
                result.directorConfigUpdates,
              )
              updatedCampaign = await updateDirectorConfig(updatedCampaign.id, newDirectorConfig)
            }

            // Combat entry when the Director signals it. Whether to apply
            // this (e.g. not clobbering an already-active combat) is a
            // React-state concern decided by the caller.
            let combatState: CombatState | null = null
            if (result.combatTriggered) {
              const enemies = parseEnemiesFromDirector(result.worldStateUpdates)
              const player = {
                id: 'player',
                name: character.sheet.name,
                isPlayer: true as const,
                sheet: { ...character.sheet },
              }
              combatState = initCombat(player, enemies)
            }

            callbacks.onResult({
              turn,
              directorResult: result,
              updatedCampaign,
              checkSummary,
              combatState,
            })
          } catch (err) {
            callbacks.onError(err)
          }
        })()
      },
      onError: (err) => {
        callbacks.onError(err)
      },
    })

    callbacks.onStreamStart(streamController)
  })()
}
