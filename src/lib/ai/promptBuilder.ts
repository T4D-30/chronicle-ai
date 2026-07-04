/**
 * Chronicle AI — Prompt Builder
 * Phase 2.4
 *
 * Constructs the structured context payload sent to the `narrate` Edge Function.
 * Lives client-side; the actual AI provider API call happens server-side in the
 * Edge Function.
 *
 * Design rule: never include raw character sheet fields — always use
 * summarizeCharacter() so the payload is a fixed, compact shape regardless
 * of how CharacterSheet evolves.
 */

import { summarizeCharacter } from '@/lib/engine'
import type { CharacterSheet } from '@/lib/engine'
import type { Campaign, NarrativeTurn } from '@/lib/supabase'
import type { GameSession } from '@/lib/supabase'

// ─── Payload types ────────────────────────────────────────────────────────────

/** The payload POSTed to the narrate Edge Function. */
export interface NarrateRequest {
  sessionId: string
  mode: 'exploration' | 'combat' | 'map'
  playerInput: string
  character: ReturnType<typeof summarizeCharacter>
  /**
   * The resolved skill check for this action, if the player's input matched
   * a real action category (FORCE/FINESSE/ENDURE/REASON/PERCEIVE/INFLUENCE).
   * Pure narration/dialogue/movement (category UNKNOWN) has no check and
   * this is omitted — see classifyAction() in intent.ts. When present, the
   * Director MUST narrate this exact, already-resolved result — full dice
   * transparency (locked Director rule) — never re-roll or override it.
   */
  checkResult?: {
    category: string
    stat: string
    dc: number
    total: number
    outcome: string
    outcomeLabel: string
    isSuccess: boolean
  }
  /**
   * Relevant excerpts from the campaign's indexed reference documents
   * (DM guides, campaign bibles, homebrew rules, world lore — see
   * src/lib/directorDocuments/) retrieved for this turn's player input.
   * Omitted when no campaign documents exist or none are relevant — same
   * "omit rather than send an empty array" convention as every other
   * optional context field here. Populated by whichever DocumentRetriever
   * is currently active (getActiveDocumentRetriever()); the Director
   * never knows or cares which retrieval strategy produced these excerpts.
   */
  documentContext?: Array<{
    fileName: string
    category: string
    excerpt: string
  }>
  directorConfig: {
    tone: string
    difficulty: string
    rulesStyle: string
    hiddenArc: string
  }
  worldContext: {
    campaignTitle: string
    campaignDescription: string | null
    worldTime: string | null
    /** IDs + names of active NPCs at the current location (populated by Director). */
    activeNpcs: Array<{ id: string; name: string }>
    currentLocation: string | null
    /** Recent turn summaries for Director context. */
    recentTurns: Array<{
      turnNumber: number
      playerInput: string
      aiNarration: string
      mode: string
    }>
    /**
     * Compact digest of active plot threads (Quest Log) — Phase 9.2.
     * Unlike recentTurns, this persists across the whole campaign regardless
     * of the 4-8 turn recency window, giving the Director durable memory of
     * open goals in long-running sessions without re-sending full history.
     */
    activeQuestDigest: Array<{ id: string; title: string }>
    /**
     * Compact digest of known NPCs the player has met — Phase 9.2. Same
     * durability rationale as activeQuestDigest: disposition and key facts
     * survive far longer than the recent-turns window.
     */
    knownNpcDigest: Array<{ name: string; disposition: string; facts: string[] }>
  }
}

/** Response received from the narrate Edge Function (non-streaming). */
export interface NarrateResponse {
  narration: string
  worldStateUpdates: Record<string, unknown>
  /** Plot thread (Quest Log) and NPC memory (Codex) updates. Phase 9.2. */
  directorConfigUpdates: Record<string, unknown>
  suggestedActions: string[]
  combatTriggered: boolean
  mapUpdate: null | Record<string, unknown>
  turnId: string
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export interface BuildNarrateRequestOptions {
  session: GameSession
  campaign: Campaign
  character: CharacterSheet
  playerInput: string
  recentTurns: NarrativeTurn[]
  /** Pre-resolved skill check for this turn, if the action warranted one. Phase 9.3. */
  checkResult?: NarrateRequest['checkResult']
  /** Retrieved reference-document excerpts for this turn. Phase 10.3. */
  documentContext?: NarrateRequest['documentContext']
}

/**
 * Build a NarrateRequest from the current game state.
 * Called immediately before sending to the Edge Function.
 */
export function buildNarrateRequest(opts: BuildNarrateRequestOptions): NarrateRequest {
  const { session, campaign, character, playerInput, recentTurns, checkResult, documentContext } = opts

  return {
    sessionId: session.id,
    mode: session.currentMode,
    playerInput: playerInput.trim(),
    character: summarizeCharacter(character),
    ...(checkResult ? { checkResult } : {}),
    ...(documentContext && documentContext.length > 0 ? { documentContext } : {}),
    directorConfig: {
      tone:       campaign.directorConfig.tone,
      difficulty: campaign.directorConfig.difficulty,
      rulesStyle: campaign.directorConfig.rulesStyle,
      // hiddenArc is intentionally included — the Edge Function is server-side only.
      // The player never receives this directly; the Director reads it to shape narration.
      hiddenArc:  campaign.directorConfig.hiddenArc,
    },
    worldContext: {
      campaignTitle:       campaign.title,
      campaignDescription: campaign.description,
      worldTime:           campaign.worldState.worldTime,
      activeNpcs: campaign.worldState.npcs
        .filter((npc) => npc.isAlive)
        .map((npc) => ({ id: npc.id, name: npc.name })),
      // Resolved honestly against WorldState.locations — Phase 9.2 added a
      // real currentLocationId; this was previously hardcoded null with a
      // "populated in future phases" comment.
      currentLocation: campaign.worldState.currentLocationId
        ? (campaign.worldState.locations.find((l) => l.id === campaign.worldState.currentLocationId)?.name ?? null)
        : null,
      recentTurns: recentTurns.slice(-8).map((t) => ({
        turnNumber:   t.turnNumber,
        playerInput:  t.playerInput,
        aiNarration:  t.aiNarration,
        mode:         t.mode,
      })),
      // Durable context beyond the recent-turns window (Phase 9.2) — see
      // type-level doc comments above for the rationale. Hidden threads are
      // excluded; the Director already knows its own hidden arc via
      // directorConfig.hiddenArc and doesn't need it duplicated here.
      activeQuestDigest: campaign.directorConfig.activeThreads
        .filter((t) => t.status === 'active' && !t.isHidden)
        .slice(0, 6)
        .map((t) => ({ id: t.id, title: t.title })),
      knownNpcDigest: campaign.directorConfig.npcMemory
        .filter((n) => n.metPlayer)
        .slice(0, 8)
        .map((n) => ({ name: n.name, disposition: n.disposition, facts: n.knownFacts.slice(0, 3) })),
    },
  }
}

/** Estimate token cost of a request (rough, for logging/debugging only). */
export function estimateRequestTokens(req: NarrateRequest): number {
  return Math.ceil(JSON.stringify(req).length / 4)
}
