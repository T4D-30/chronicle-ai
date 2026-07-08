/**
 * useAdventureSession
 * Phase 2.4 — adds submitAction() which wires the full turn loop:
 *   playerInput → callNarrateStreaming → appendTurn (via Edge Function) → turns updated
 *
 * submitAction()'s turn orchestration (Rules Engine → AI Director →
 * persistence) lives in runPlayerTurn() (@/lib/adventure/adventureController).
 * This hook snapshots React state, calls the controller, and maps its
 * callbacks onto setState — it holds no orchestration logic of its own.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ServiceError } from '@/lib/supabase'
import type { Campaign, CharacterRecord, GameSession, NarrativeTurn } from '@/lib/supabase'
import { buildFallbackNarration } from '@/lib/ai'
import type { DirectorResult } from '@/lib/ai'
import type { CombatState, EnemyCombatant, CombatResult } from '@/lib/engine'
import { summariseCharacterAction } from '@/lib/engine'
import {
  runPlayerTurn,
  commitCombatResult as commitCombatResultToController,
  levelUpCharacter as levelUpCharacterToController,
  loadAdventure as loadAdventureFromController,
  buildCombatState,
  pauseAdventureSession,
  resumeAdventureSession,
  endAdventureSession,
} from '@/lib/adventure/adventureController'

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
  /**
   * Bumped on every submitAction()/cancelStream()/unmount. A stream's
   * callbacks capture the id in effect at the time they were started and
   * compare against this ref before touching state — this is how a
   * superseded/cancelled/unmounted stream's late-arriving onToken/onResult/
   * onError is recognized as stale and ignored, rather than being able to
   * clobber a newer (or already-finished) turn's state. Without this, an
   * older duplicate submission (e.g. a double-click) that finishes after a
   * newer one already succeeded could overwrite a successful turn with a
   * stale error banner.
   */
  const requestIdRef = useRef(0)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const { campaign, character, session, turns } = await loadAdventureFromController(campaignId)
      if (!character || !session) {
        setState((s) => ({ ...s, status: 'no_character', campaign }))
        return
      }
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
    // because the controller's document-retrieval step is a real async
    // step before the request can be built.
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

    // Claim a new generation before starting the stream — any callback
    // from a previous, now-superseded generation will no-op against this.
    const requestId = ++requestIdRef.current
    streamControllerRef.current?.abort()

    setState((s) => ({
      ...s,
      narrationStatus: 'streaming' as NarrationStatus,
      isActionInFlight: true,
      streamingText: '',
      error: null,
      suggestedActions: [],
    }))

    runPlayerTurn(
      { campaign, character, session, recentTurns: turns, playerInput: trimmedInput },
      {
        onToken: (token) => {
          if (requestIdRef.current !== requestId) return
          setState((prev) => ({
            ...prev,
            streamingText: prev.streamingText + token,
          }))
        },
        onStreamStart: (controller) => {
          if (requestIdRef.current !== requestId) {
            controller.abort()
            return
          }
          streamControllerRef.current = controller
        },
        onResult: (result) => {
          if (requestIdRef.current !== requestId) return
          setState((prev) => {
            const next = {
              ...prev,
              isActionInFlight: false,
              narrationStatus: 'done' as NarrationStatus,
              streamingText: '',
              suggestedActions: result.directorResult.suggestedActions,
              lastDirectorResult: result.directorResult,
              campaign: result.updatedCampaign ?? prev.campaign,
              turns: [...prev.turns, result.turn].slice(-20),
              session: prev.session
                ? { ...prev.session, turnNumber: prev.session.turnNumber + 1 }
                : prev.session,
              lastCheckResult: result.checkSummary,
            }
            // Auto-enter combat when the Director signaled it, unless
            // already in combat.
            if (result.combatState && !next.combatState) {
              next.combatState = result.combatState
            }
            return next
          })
        },
        onError: (err) => {
          if (requestIdRef.current !== requestId) return
          setState((prev) => ({
            ...prev,
            isActionInFlight: false,
            narrationStatus: 'error',
            streamingText: '',
            error: buildFallbackNarration(err),
          }))
        },
      },
    )
  }, [])

  const cancelStream = useCallback(() => {
    // Invalidate the in-flight generation so its callbacks can no longer
    // apply a late result/error after the user has explicitly cancelled.
    requestIdRef.current++
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
    return () => {
      requestIdRef.current++
      streamControllerRef.current?.abort()
    }
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

      const {
        updatedCharacter,
        updatedCampaign,
        newTurn,
        readyToLevel,
        xpAwarded,
      } = await commitCombatResultToController({ character, session, campaign, result })

      setState((s) => ({
        ...s,
        isActionInFlight: false,
        character: updatedCharacter,
        campaign: updatedCampaign,
        combatState: null,
        lastCombatResult: result,
        readyToLevel,
        lastXpGain: xpAwarded,
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
      return { ...s, combatState: buildCombatState(s.character, enemies) }
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
      const updated = await levelUpCharacterToController(characterId, patch)
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
    pause:        () => { if (!state.session) return Promise.resolve(); return withFlight(() => pauseAdventureSession(state.session!.id)) },
    resume:       () => { if (!state.session) return Promise.resolve(); return withFlight(() => resumeAdventureSession(state.session!.id)) },
    end:          () => { if (!state.session) return Promise.resolve(); return withFlight(() => endAdventureSession(state.session!.id)) },
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
