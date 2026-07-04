/**
 * useAdventureSession
 * Phase 2.4 — adds submitAction() which wires the full turn loop:
 *   playerInput → callNarrateStreaming → appendTurn (via Edge Function) → turns updated
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCampaign,
  getCharacter,
  updateCharacter,
  updateWorldState,
  updateDirectorConfig,
  appendTurn,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  getResumableSession,
  getRecentTurns,
  ServiceError,
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
  buildFallbackNarration,
} from '@/lib/ai'
import type { DirectorResult, NarrateRequest } from '@/lib/ai'
import type { CombatState, EnemyCombatant, CombatResult } from '@/lib/engine'
import { getActiveDocumentRetriever } from '@/lib/directorDocuments/fullTextRetriever'
import {
  initCombat,
  summariseCombatResult,
  parseEnemiesFromDirector,
  isReadyToLevel,
  parseAction,
  resolveCharacterAction,
  summariseCharacterAction,
} from '@/lib/engine'

export type AdventureLoadStatus =
  | 'loading'
  | 'ready'
  | 'no_character'
  | 'error'

export type NarrationStatus =
  | 'idle'
  | 'streaming'
  | 'done'
  | 'error'

export interface AdventureState {
  status: AdventureLoadStatus
  campaign: Campaign | null
  character: CharacterRecord | null
  session: GameSession | null
  turns: NarrativeTurn[]
  error: string | null
  isActionInFlight: boolean
  // Narration streaming state
  narrationStatus: NarrationStatus
  streamingText: string
  suggestedActions: string[]
  lastDirectorResult: DirectorResult | null
  // Combat state — null when not in combat
  combatState: CombatState | null
  // Set after combat commits
  lastCombatResult: CombatResult | null
  /** True when character just crossed an XP level threshold. */
  readyToLevel: boolean
  /**
   * The most recently resolved exploration skill check, if the last
   * submitted action classified into a real category. Cleared on the next
   * submission. Drives the dice-result popup in StoryPanel — this is real
   * Phase 9.3 data (previously computed and sent to the Director, but never
   * surfaced to the player) rather than a new roll. Phase 10.1.
   */
  lastCheckResult: ReturnType<typeof summariseCharacterAction> | null
  /**
   * XP gained by the most recent combat resolution, for the XP-gain
   * animation. 0 when no XP was awarded (e.g. a fled encounter). Cleared
   * when the animation consumes it. Phase 10.1.
   */
  lastXpGain: number
}

export interface AdventureActions {
  pause: () => Promise<void>
  resume: () => Promise<void>
  end: () => Promise<void>
  reload: () => Promise<void>
  submitAction: (input: string) => void
  cancelStream: () => void
  startCombat: (enemies: EnemyCombatant[]) => void
  endCombat: () => void
  commitCombatResult: (result: CombatResult) => Promise<void>
  /** Persists a level-up: new level + recalculated HP. Clears readyToLevel. Phase 9.2. */
  levelUpCharacter: (patch: { level: number; currentHp: number }) => Promise<void>
  /** Dismisses the current dice-check popup (lastCheckResult). Phase 10.1. */
  clearCheckResult: () => void
  /** Dismisses the current XP-gain popup (lastXpGain). Phase 10.1. */
  clearXpGain: () => void
}

const INITIAL_STATE: AdventureState = {
  status: 'loading',
  campaign: null,
  character: null,
  session: null,
  turns: [],
  error: null,
  isActionInFlight: false,
  narrationStatus: 'idle',
  streamingText: '',
  suggestedActions: [],
  lastDirectorResult: null,
  combatState: null,
  lastCombatResult: null,
  readyToLevel: false,
  lastCheckResult: null,
  lastXpGain: 0,
}

export function useAdventureSession(campaignId: string): [AdventureState, AdventureActions] {
  const [state, setState] = useState<AdventureState>(INITIAL_STATE)
  const streamControllerRef = useRef<AbortController | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const campaign = await getCampaign(campaignId)
      if (!campaign.characterId) {
        setState((s) => ({ ...s, status: 'no_character', campaign }))
        return
      }
      const [character, existingSession] = await Promise.all([
        getCharacter(campaign.characterId),
        getResumableSession(campaignId),
      ])
      const session = existingSession ?? (await startSession(campaignId))
      const turns = await getRecentTurns(session.id, 20)
      setState({
        ...INITIAL_STATE,
        status: 'ready',
        campaign,
        character,
        session,
        turns,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: err instanceof ServiceError ? err.message : 'Failed to load adventure.',
        isActionInFlight: false,
      }))
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  // ── Session controls ───────────────────────────────────────────────────────

  const withFlight = useCallback(async (action: () => Promise<GameSession>) => {
    setState((s) => ({ ...s, isActionInFlight: true, error: null }))
    try {
      const updated = await action()
      setState((s) => ({ ...s, session: updated, isActionInFlight: false }))
    } catch (err) {
      setState((s) => ({
        ...s,
        isActionInFlight: false,
        error: err instanceof ServiceError ? err.message : 'Action failed.',
      }))
    }
  }, [])

  // ── Action submission (full turn loop) ────────────────────────────────────

  const submitAction = useCallback(async (input: string) => {
    const trimmedInput = input.trim()
    if (!trimmedInput) return

    // Snapshot current state synchronously before any awaits — same
    // established pattern as commitCombatResult() above. Needed here
    // because Phase 10.3 adds a real async step (document retrieval)
    // before the request can be built; the previous version of this
    // function ran entirely inside a synchronous setState updater, which
    // cannot await anything.
    const snap = await new Promise<{
      campaign: Campaign | null
      character: CharacterRecord | null
      session: GameSession | null
      turns: NarrativeTurn[]
      narrationStatus: NarrationStatus
    }>((res) => {
      setState((s) => {
        res({ campaign: s.campaign, character: s.character, session: s.session, turns: s.turns, narrationStatus: s.narrationStatus })
        return s
      })
    })
    const { campaign, character, session, turns, narrationStatus } = snap
    if (!campaign || !character || !session) return
    if (narrationStatus === 'streaming') return // already streaming

    // ── Full dice transparency (Phase 9.3, locked Director rule) ────────────
    // Only actions that classify into a real skill category (FORCE, FINESSE,
    // ENDURE, REASON, PERCEIVE, INFLUENCE) roll a check. Pure narration,
    // dialogue, or movement (category UNKNOWN) never rolls — per design
    // decision, mechanizing every single line of play would work against
    // the "Story-first, Player-first" half of the same rule set. See
    // classifyAction()/parseAction() in intent.ts and resolveCharacterAction()
    // in resolveAction.ts — both already existed; this is the first caller
    // to wire them into the exploration turn flow.
    //
    // parseAction() is called first because it's pure (no dice) and gives
    // us the intent's own suggestedDc — resolveCharacterAction() is then
    // called exactly ONCE with that real DC. Calling resolveCharacterAction
    // twice (once to discover a DC, once "for real") would silently
    // consume two dice rolls from the RNG stream for one player action.
    const parsedIntent = parseAction(trimmedInput)
    let checkSummary: ReturnType<typeof summariseCharacterAction> | null = null
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

    // ── Director document retrieval (Phase 10.3) ─────────────────────────────
    // Retrieves relevant excerpts from this campaign's indexed reference
    // documents (DM guides, campaign bibles, homebrew rules, world lore)
    // for the player's current input. Uses whichever DocumentRetriever is
    // currently active (getActiveDocumentRetriever()) — this call site
    // never knows or cares whether that's the shipped FullTextRetriever or
    // a future embeddings-based one. Failure here must never block the
    // turn: an unavailable retriever degrades to "no document context this
    // turn," not a broken action submission — same fail-open posture as
    // every other best-effort context source in this hook.
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
      // Fail open — see comment above. No error surfaced to the player;
      // this is a context-enrichment step, not a blocking dependency.
      documentContext = []
    }

    const request = buildNarrateRequest({
      session,
      campaign,
      character: character.sheet,
      playerInput: trimmedInput,
      recentTurns: turns,
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

    setState((s) => ({
      ...s,
      narrationStatus: 'streaming' as NarrationStatus,
      streamingText: '',
      error: null,
      suggestedActions: [],
    }))

    streamControllerRef.current?.abort()
    streamControllerRef.current = callNarrateStreaming(request, {
      onToken: (token) => {
        setState((prev) => ({
          ...prev,
          streamingText: prev.streamingText + token,
        }))
      },
      onDone: (response) => {
        void (async () => {
          try {
            const result = parseDirectorResponse(response)
            // Build the new turn from the response
            const newTurn: NarrativeTurn = {
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
            // NPC alive status) — same pattern as the combat-result path.
            let updatedCampaign: Campaign | null = campaign
            if (updatedCampaign && hasWorldStateChanges(result.worldStateUpdates)) {
              const newWorldState = applyWorldStateUpdate(updatedCampaign.worldState, result.worldStateUpdates)
              updatedCampaign = await updateWorldState(updatedCampaign.id, newWorldState)
            }

            // Persist Director config updates (plot threads / NPC memory —
            // Quest Log and Codex, Phase 9.2). Applied on top of whatever
            // updatedCampaign is at this point so both writes aren't lost
            // to a stale read.
            if (updatedCampaign && hasDirectorConfigChanges(result.directorConfigUpdates)) {
              const newDirectorConfig = applyDirectorConfigUpdate(
                updatedCampaign.directorConfig,
                result.directorConfigUpdates,
              )
              updatedCampaign = await updateDirectorConfig(updatedCampaign.id, newDirectorConfig)
            }

            setState((prev) => {
              const next = {
                ...prev,
                isActionInFlight: false,
                narrationStatus: 'done' as NarrationStatus,
                streamingText: '',
                suggestedActions: result.suggestedActions,
                lastDirectorResult: result,
                campaign: updatedCampaign ?? prev.campaign,
                turns: [...prev.turns, newTurn].slice(-20),
                session: prev.session
                  ? { ...prev.session, turnNumber: prev.session.turnNumber + 1 }
                  : prev.session,
                lastCheckResult: checkSummary,
              }
              // Auto-enter combat when Director signals it
              if (result.combatTriggered && !next.combatState && next.character) {
                const enemies = parseEnemiesFromDirector(result.worldStateUpdates)
                const player = {
                  id: 'player',
                  name: next.character.sheet.name,
                  isPlayer: true as const,
                  sheet: { ...next.character.sheet },
                }
                next.combatState = initCombat(player, enemies)
              }
              return next
            })
          } catch (err) {
            setState((prev) => ({
              ...prev,
              isActionInFlight: false,
              narrationStatus: 'error',
              streamingText: '',
              error: buildFallbackNarration(err),
            }))
          }
        })()
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          isActionInFlight: false,
          narrationStatus: 'error',
          streamingText: '',
          error: buildFallbackNarration(err),
        }))
      },
    })
  }, [])

  const cancelStream = useCallback(() => {
    streamControllerRef.current?.abort()
    streamControllerRef.current = null
    setState((s) => ({
      ...s,
      narrationStatus: 'idle',
      streamingText: '',
    }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { streamControllerRef.current?.abort() }
  }, [])

  // ── Combat result persistence ───────────────────────────────────────────────

  const commitCombatResult = useCallback(async (result: CombatResult) => {
    setState((s) => ({ ...s, isActionInFlight: true, error: null }))
    try {
      // Snapshot current state synchronously before any awaits
      const snap = await new Promise<{
        character: CharacterRecord | null
        session: GameSession | null
        campaign: Campaign | null
        turns: NarrativeTurn[]
      }>((res) => {
        setState((s) => {
          res({ character: s.character, session: s.session, campaign: s.campaign, turns: s.turns })
          return s
        })
      })
      const { character, session, campaign, turns } = snap
      if (!character || !session || !campaign) return

      // 1. Persist XP + post-combat HP to character
      const newXp = character.experience + result.xpAwarded
      const newLevel = character.sheet.level
      const levelUp = isReadyToLevel(newXp, newLevel)

      // Add loot to existing inventory
      const lootInventory = result.loot.map((l) => ({
        id: l.id,
        name: l.name,
        quantity: l.quantity,
        weight: 0,
        equipped: false,
        description: l.description,
      }))
      const updatedInventory = [...character.inventory, ...lootInventory]

      const updatedCharacter = await updateCharacter(character.id, {
        experience: newXp,
        currentHp: result.finalPlayerHp,
        inventory: updatedInventory,
      })

      // 2. Persist combat summary as a narrative turn (mode: 'combat')
      const summaryText = summariseCombatResult(result)
      const outcomeLabel =
        result.outcome === 'victory' ? '[VICTORY]' :
        result.outcome === 'defeat'  ? '[DEFEAT]'  : '[FLED]'

      const newTurn = await appendTurn(session.id, {
        playerInput: `${outcomeLabel} ${result.enemiesDefeated.map((e) => e.name).join(', ') || 'Combat ended.'}`,
        aiNarration: summaryText,
        diceRolls: [],
        mode: 'combat',
      })

      // 3. Apply world state updates from the Director (enemies dead, etc.)
      const worldUpdates: Record<string, unknown> = {
        ...result.log.length > 0
          ? { npcUpdates: result.enemiesDefeated.map((e) => ({ id: e.id, isAlive: false })) }
          : {},
      }
      let updatedCampaign = campaign
      if (hasWorldStateChanges(worldUpdates)) {
        const newWorldState = applyWorldStateUpdate(campaign.worldState, worldUpdates)
        updatedCampaign = await updateWorldState(campaign.id, newWorldState)
      }

      setState((s) => ({
        ...s,
        isActionInFlight: false,
        character: updatedCharacter,
        campaign: updatedCampaign,
        combatState: null,
        lastCombatResult: result,
        readyToLevel: levelUp,
        lastXpGain: result.xpAwarded,
        turns: [...turns, newTurn].slice(-20),
        session: {
          ...session,
          turnNumber: session.turnNumber + 1,
        },
        error: null,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        isActionInFlight: false,
        error: err instanceof ServiceError ? err.message : 'Failed to save combat result.',
      }))
    }
  }, []) // deps via snapshot pattern

  const startCombat = useCallback((enemies: EnemyCombatant[]) => {
    setState((s) => {
      if (!s.character) return s
      const player = {
        id: 'player',
        name: s.character.sheet.name,
        isPlayer: true as const,
        sheet: { ...s.character.sheet, currentHp: s.character.sheet.currentHp },
      }
      return { ...s, combatState: initCombat(player, enemies) }
    })
  }, [])

  const endCombat = useCallback(() => {
    setState((s) => ({ ...s, combatState: null }))
  }, [])

  /** Dismisses the current dice-check popup. Called by StoryPanel once its display timer elapses. */
  const clearCheckResult = useCallback(() => {
    setState((s) => ({ ...s, lastCheckResult: null }))
  }, [])

  /** Dismisses the current XP-gain popup. Called by the consuming component once its display timer elapses. */
  const clearXpGain = useCallback(() => {
    setState((s) => ({ ...s, lastXpGain: 0 }))
  }, [])

  const levelUpCharacter = useCallback(async (patch: { level: number; currentHp: number }) => {
    setState((s) => ({ ...s, isActionInFlight: true, error: null }))
    try {
      // Snapshot the character id synchronously before the await, matching
      // the pattern used by commitCombatResult above.
      const characterId = await new Promise<string | null>((res) => {
        setState((s) => {
          res(s.character?.id ?? null)
          return s
        })
      })
      if (!characterId) {
        setState((s) => ({ ...s, isActionInFlight: false }))
        return
      }
      const updated = await updateCharacter(characterId, patch)
      setState((s) => ({
        ...s,
        character: updated,
        readyToLevel: false,
        isActionInFlight: false,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        isActionInFlight: false,
        error: err instanceof ServiceError ? err.message : 'Level up failed.',
      }))
    }
  }, [])

  const actions: AdventureActions = {
    pause:        () => { if (!state.session) return Promise.resolve(); return withFlight(() => pauseSession(state.session!.id)) },
    resume:       () => { if (!state.session) return Promise.resolve(); return withFlight(() => resumeSession(state.session!.id)) },
    end:          () => { if (!state.session) return Promise.resolve(); return withFlight(() => endSession(state.session!.id)) },
    reload:       load,
    submitAction,
    cancelStream,
    startCombat,
    endCombat,
    commitCombatResult,
    levelUpCharacter,
    clearCheckResult,
    clearXpGain,
  }

  return [state, actions]
}
