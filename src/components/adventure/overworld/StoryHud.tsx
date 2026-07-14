/**
 * StoryHud — Unified Adventure Screen (Presentation 4, B2)
 *
 * The persistent JRPG story dock at the bottom of the world. It
 * generalizes DialogueWindow (which it supersedes as OverworldMode's
 * story surface) into two modes on one surface:
 *
 * - **Dialogue** (`speaker` set): an NPC conversation — speaker label,
 *   the Director's REAL response (streaming live, then the completed
 *   turn's narration), typewriter reveal, close button. The scene is
 *   locked while it's open (OverworldMode owns that rule).
 * - **Ambient** (no speaker): the current story beat — exit/rest/
 *   examine responses, discoveries, streaming narration — docked over
 *   the world WITHOUT locking movement (only streaming/in-flight
 *   actions lock, via OverworldMode's existing busy rule). With no
 *   fresh beat it collapses to a slim free-input strip.
 *
 * Both modes offer the session's real suggested actions as choices and
 * the same free-form input contract as ActionBar (onChoose/onSubmitFree
 * — grounded via actions.submitAction upstream). The HUD never shows
 * more than the current/latest beat — history lives in the Journal —
 * and never exceeds ~35% of the viewport (world stays primary).
 *
 * Typewriter rules (inherited): streaming text renders as-is;
 * completed text reveals at ~18ms/char; clicking the text skips to
 * full; prefers-reduced-motion renders instantly.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'

const CHAR_MS = 18

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface StoryHudProps {
  /** NPC dialogue mode when set; ambient story mode when null. */
  speaker?: string | null
  /** The current beat — streaming or completed. Empty = collapsed. */
  text: string
  streaming: boolean
  suggestedActions: string[]
  busy: boolean
  onChoose: (text: string) => void
  onSubmitFree: (text: string) => void
  /** Dialogue mode: close the conversation. Ambient mode: dismiss the
   *  current beat (collapse back to the input strip). */
  onClose: () => void
}

export function StoryHud({
  speaker = null,
  text,
  streaming,
  suggestedActions,
  busy,
  onChoose,
  onSubmitFree,
  onClose,
}: StoryHudProps) {
  const [visibleChars, setVisibleChars] = useState(0)
  const [freeText, setFreeText] = useState('')
  const timerRef = useRef<number | null>(null)

  const isDialogue = !!speaker
  const hasBeat = text.length > 0 || streaming

  // Typewriter over completed text only.
  useEffect(() => {
    if (streaming || prefersReducedMotion()) {
      setVisibleChars(text.length)
      return
    }
    setVisibleChars(0)
    timerRef.current = window.setInterval(() => {
      setVisibleChars((n) => {
        if (n >= text.length) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          return n
        }
        return n + 1
      })
    }, CHAR_MS)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [text, streaming])

  const shown = streaming ? text : text.slice(0, visibleChars)
  const revealed = streaming || visibleChars >= text.length

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 p-3 menu-enter"
      data-testid="story-hud"
      data-mode={isDialogue ? 'dialogue' : 'ambient'}
      role={isDialogue ? 'dialog' : 'region'}
      aria-label={isDialogue ? `Dialogue with ${speaker}` : 'Story'}
    >
      <div className="chr-panel rounded-lg max-w-3xl max-h-[35vh] mx-auto p-3 sm:p-4 overflow-y-auto">
        {(isDialogue || hasBeat) && (
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-pixel-display text-[10px] text-bronze-400 uppercase"
              data-testid="story-hud-speaker"
            >
              {isDialogue ? speaker : 'The Story'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={isDialogue ? 'Close dialogue' : 'Dismiss narration'}
              className="text-void-500 hover:text-arcane-300 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded"
              data-testid="story-hud-close"
            >
              ✕ {isDialogue ? 'Close' : 'Dismiss'}
            </button>
          </div>
        )}

        {hasBeat && (
          <button
            type="button"
            onClick={() => setVisibleChars(text.length)}
            className="block w-full text-left lore-text text-sm text-void-100 min-h-[3.5rem] focus-visible:outline-none"
            data-testid="story-hud-text"
            aria-label={revealed ? undefined : 'Reveal full text'}
          >
            {shown}
            {streaming && <span className="animate-pulse text-arcane-400" aria-hidden="true">▋</span>}
          </button>
        )}

        {hasBeat && suggestedActions.length > 0 && !streaming && (
          <div className="flex gap-2 flex-wrap mt-3" role="group" aria-label="Suggested actions">
            {suggestedActions.map((action, i) => (
              <Button
                key={i}
                type="button"
                variant="suggested"
                disabled={busy}
                onClick={() => onChoose(action)}
              >
                {action}
              </Button>
            ))}
          </div>
        )}

        <form
          className={['flex gap-2', isDialogue || hasBeat ? 'mt-3' : ''].join(' ')}
          onSubmit={(e) => {
            e.preventDefault()
            if (freeText.trim()) {
              onSubmitFree(freeText.trim())
              setFreeText('')
            }
          }}
        >
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={isDialogue ? 'Say or do something…' : 'What do you do?'}
            aria-label={isDialogue ? 'Free-form response' : 'Free-form action'}
            disabled={busy}
            className="flex-1 px-3 py-1.5 rounded bg-void-900 border border-bronze-800/50 text-void-100 font-body text-sm focus:outline-none focus:ring-2 focus:ring-arcane-400 placeholder:text-void-600 disabled:opacity-50"
            data-testid="story-hud-free-input"
          />
          <Button type="submit" variant="arcane" size="sm" disabled={busy || !freeText.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
