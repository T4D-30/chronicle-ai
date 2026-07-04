/**
 * Chronicle AI — AI Narration Layer
 * Phase 2.4: Narrator, Director, and Prompt Builder implemented.
 *
 * Architecture:
 * - promptBuilder.ts  — builds NarrateRequest from game state
 * - narrator.ts       — calls /functions/v1/narrate (streaming + non-streaming)
 * - director.ts       — parses response, surfaces actions, defers combat/map signals
 *
 * The AI provider API is NEVER called from the client.
 * All AI calls go through the `narrate` Supabase Edge Function.
 */

export const AI_VERSION = '2.4.0'

export function getAIStatus() {
  return { version: AI_VERSION, phase: 2.4, ready: true }
}

export type { NarrateRequest, NarrateResponse } from './promptBuilder'
export { buildNarrateRequest, estimateRequestTokens } from './promptBuilder'

export type { DirectorResult } from './director'
export { parseDirectorResponse, buildFallbackNarration } from './director'

export { NarratorError, callNarrate, callNarrateStreaming } from './narrator'
export type { StreamCallbacks } from './narrator'
