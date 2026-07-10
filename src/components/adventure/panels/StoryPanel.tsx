/**
 * StoryPanel — Phase 2.4 / Phase 8.3 / Phase 10.1
 *
 * Pure narrative display. Renders the campaign header, turn history,
 * live streaming text, and (Phase 10.1) the resolved dice check for the
 * most recent action — real data from resolveCharacterAction(), computed
 * in Phase 9.3 and sent to the Director, but never surfaced to the player
 * until now.
 */

import { useEffect, useRef } from 'react'
import type { Campaign, NarrativeTurn } from '@/lib/supabase'
import type { NarrationStatus } from '../useAdventureSession'
import type { summariseCharacterAction } from '@/lib/engine'
import { PixelPanel, StoryText } from '@/components/pixel'

interface StoryPanelProps {
  campaign: Campaign
  turns: NarrativeTurn[]
  narrationStatus: NarrationStatus
  streamingText: string
  onCancelStream: () => void
  /** Most recently resolved skill check, if any. Phase 10.1. */
  lastCheckResult?: ReturnType<typeof summariseCharacterAction> | null
  /** Dismisses lastCheckResult once its display window elapses. Phase 10.1. */
  onClearCheckResult?: () => void
}

export function StoryPanel({
  campaign,
  turns,
  narrationStatus,
  streamingText,
  onCancelStream,
  lastCheckResult = null,
  onClearCheckResult,
}: StoryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const isStreaming = narrationStatus === 'streaming'

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [turns, streamingText])

  // Auto-dismiss the dice-check popup after its display window. The
  // component owns this timing (not the hook) — same division of
  // responsibility as DamageNumber in CombatPanel (Phase 9.1): the hook
  // supplies real data, the UI owns the transient display lifecycle.
  useEffect(() => {
    if (!lastCheckResult || !onClearCheckResult) return
    const timer = window.setTimeout(onClearCheckResult, 4200)
    return () => window.clearTimeout(timer)
  }, [lastCheckResult, onClearCheckResult])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Campaign header — bronze frame, gold title (UI 2.0's "Story Box"
          language), replacing the old cold-teal chr-panel-spirit framing. */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="chr-panel p-3 rounded-lg max-w-3xl mx-auto w-full">
          <p className="stat-label text-bronze-400 mb-0.5">{campaign.title.toUpperCase()}</p>
          {campaign.description && (
            <p className="text-void-400 text-xs line-clamp-1">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Turn history + streaming — capped to a comfortable reading width
          (max-w-3xl) even though the story column itself is wider now
          (Phase 14.1); unconstrained line length on a wide desktop column
          hurts readability, so the extra width becomes breathing room
          around a centered reading column instead of longer lines. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 px-4 py-2"
        data-testid="story-scroll"
      >
        {turns.length === 0 && !streamingText && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="chr-panel p-6 rounded-lg max-w-sm w-full">
              <p className="stat-label text-bronze-400 mb-3">YOUR STORY BEGINS</p>
              <p className="lore-text text-void-300 text-sm mb-4">
                "Every hero's story begins with a single choice."
              </p>
              <div className="chr-divider mb-4" />
              <p className="text-void-500 text-xs">
                Type an action below, or use the quick-action buttons.
                The Director will narrate the outcome.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 max-w-3xl mx-auto w-full">
            {turns.map((turn) => <TurnBlock key={turn.id} turn={turn} />)}

            {/* Resolved dice check for the most recent action — Phase 10.1 */}
            {lastCheckResult && <CheckResultPopup result={lastCheckResult} />}

            {/* Live streaming text */}
            {isStreaming && streamingText && (
              <div className="chr-panel p-3 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="stat-label text-bronze-400">Director speaking…</span>
                  <button
                    type="button"
                    onClick={onCancelStream}
                    className="text-void-600 hover:text-void-400 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded"
                  >
                    Cancel
                  </button>
                </div>
                <StoryText className="text-sm">
                  {streamingText}
                  <span className="animate-pulse text-arcane-400" aria-hidden="true">▋</span>
                </StoryText>
              </div>
            )}

            {/* Loading indicator — streaming started but no tokens yet */}
            {isStreaming && !streamingText && (
              <div className="chr-panel p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1" aria-hidden="true">
                    <span className="pixel-type-dot" style={{ animationDelay: '0ms' }} />
                    <span className="pixel-type-dot" style={{ animationDelay: '150ms' }} />
                    <span className="pixel-type-dot" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="stat-label text-bronze-400" role="status">The Director is narrating…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Dialogue-box treatment (Phase 15.2, repainted UI 2.0): player input and
 * AI narration each get their own bordered box instead of bare paragraph
 * text, closer to how RPG dialogue boxes separate speakers. Player input
 * keeps its distinct fire-toned chr-panel-arcane framing ("you acted");
 * AI narration moved from the old cold-teal chr-panel-spirit to the base
 * bronze chr-panel — the "Story Box" bronze-frame/gold-title language now
 * used consistently across StoryPanel. dialogue-reveal (pixel.css) gives
 * each turn a brief fade/rise on mount, reduced-motion safe.
 */
function TurnBlock({ turn }: { turn: NarrativeTurn }) {
  return (
    <div className="flex flex-col gap-2 dialogue-reveal">
      {turn.playerInput && (
        <div className="flex items-start gap-2">
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full bg-arcane-900/50 border border-arcane-800/50 flex items-center justify-center mt-0.5"
            aria-hidden="true"
          >
            <span className="text-arcane-400 text-xs">⚔</span>
          </span>
          <p className="chr-panel-arcane px-3 py-2 rounded-lg text-arcane-200 text-sm font-body leading-relaxed">
            {turn.playerInput}
          </p>
        </div>
      )}
      {turn.aiNarration && (
        <div className="pl-8">
          <StoryText className="chr-panel block px-3 py-2.5 rounded-lg text-sm text-void-200">
            {turn.aiNarration}
          </StoryText>
        </div>
      )}
      <div className="pl-8">
        <span className="stat-label text-void-700">Turn {turn.turnNumber}</span>
      </div>
    </div>
  )
}

/**
 * Full dice transparency for exploration checks (Phase 10.1). Renders the
 * exact ResolutionSummary the Director was instructed to narrate faithfully
 * — face, modifier, DC, total, outcome. No number here is generated by this
 * component; everything comes from resolveCharacterAction() via
 * useAdventureSession's submitAction, the same data that has been flowing
 * to the Edge Function since Phase 9.3 but was never shown to the player.
 */
function CheckResultPopup({ result }: { result: ReturnType<typeof summariseCharacterAction> }) {
  const { roll, dc, stat, outcomeLabel, isSuccess } = result
  const face = roll.faces[0] ?? 0
  const isCrit = roll.isNatural20
  const isFumble = roll.isNatural1

  const variant = isCrit ? 'spirit' : isSuccess ? 'default' : 'harm'
  const resultColor = isCrit ? 'text-heal-400' : isSuccess ? 'text-arcane-300' : 'text-harm-400'

  return (
    <PixelPanel
      variant={variant}
      glow={isCrit}
      className="menu-enter p-3 self-start max-w-xs"
      role="status"
      aria-label={`${stat} check: rolled ${face}, plus ${roll.modifier} modifier, total ${roll.total} against DC ${dc}. ${outcomeLabel}.`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-pixel-display text-[8px] text-void-400 uppercase">{stat} Check</span>
        <span className="font-pixel-display text-[8px] text-void-500">DC {dc}</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-white text-lg leading-none" aria-hidden="true">🎲{face}</span>
        <span className="text-void-500" aria-hidden="true">+{roll.modifier}</span>
        <span className="text-void-600" aria-hidden="true">=</span>
        <span className={`text-lg font-bold ${resultColor}`} aria-hidden="true">{roll.total}</span>
      </div>
      <p className={`font-pixel-body text-sm mt-1 ${resultColor}`}>
        {isCrit ? '✦ Critical! ' : isFumble ? '✕ Fumble. ' : ''}{outcomeLabel}
      </p>
    </PixelPanel>
  )
}
