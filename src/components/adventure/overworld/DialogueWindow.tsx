/**
 * DialogueWindow — Presentation 3 (Playable Overworld)
 *
 * The RPG dialogue box for overworld interactions: speaker label,
 * the Director's REAL response text (streaming or completed — never
 * invented dialogue), a typewriter reveal for completed text, the
 * session's real suggested actions as choices, and the same free-form
 * input contract as ActionBar (everything routes through
 * onChoose/onSubmitFree, which the mode grounds via submitAction).
 *
 * Typewriter rules: streaming text renders as-is (it is already
 * progressive); completed text reveals at ~18ms/char; clicking the
 * text or pressing the reveal skips to full; prefers-reduced-motion
 * renders full text instantly.
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

interface DialogueWindowProps {
  speaker: string
  text: string
  streaming: boolean
  suggestedActions: string[]
  busy: boolean
  onChoose: (text: string) => void
  onSubmitFree: (text: string) => void
  onClose: () => void
}

export function DialogueWindow({
  speaker,
  text,
  streaming,
  suggestedActions,
  busy,
  onChoose,
  onSubmitFree,
  onClose,
}: DialogueWindowProps) {
  const [visibleChars, setVisibleChars] = useState(0)
  const [freeText, setFreeText] = useState('')
  const timerRef = useRef<number | null>(null)

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
      data-testid="dialogue-window"
      role="dialog"
      aria-label={`Dialogue with ${speaker}`}
    >
      <div className="chr-panel rounded-lg max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-pixel-display text-[10px] text-bronze-400 uppercase"
            data-testid="dialogue-speaker"
          >
            {speaker}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialogue"
            className="text-void-500 hover:text-arcane-300 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded"
            data-testid="dialogue-close"
          >
            ✕ Close
          </button>
        </div>

        <button
          type="button"
          onClick={() => setVisibleChars(text.length)}
          className="block w-full text-left lore-text text-sm text-void-100 min-h-[3.5rem] focus-visible:outline-none"
          data-testid="dialogue-text"
          aria-label={revealed ? undefined : 'Reveal full text'}
        >
          {shown}
          {streaming && <span className="animate-pulse text-arcane-400" aria-hidden="true">▋</span>}
        </button>

        {suggestedActions.length > 0 && !streaming && (
          <div className="flex gap-2 flex-wrap mt-3" role="group" aria-label="Suggested responses">
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
          className="flex gap-2 mt-3"
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
            placeholder="Say or do something…"
            aria-label="Free-form response"
            disabled={busy}
            className="flex-1 px-3 py-1.5 rounded bg-void-900 border border-bronze-800/50 text-void-100 font-body text-sm focus:outline-none focus:ring-2 focus:ring-arcane-400 placeholder:text-void-600 disabled:opacity-50"
            data-testid="dialogue-free-input"
          />
          <Button type="submit" variant="arcane" size="sm" disabled={busy || !freeText.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
