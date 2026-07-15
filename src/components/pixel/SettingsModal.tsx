/**
 * SettingsModal — UI 3.0 (Pixel RPG Experience)
 *
 * The first mounted home for the long-built-but-unmounted
 * AudioSettingsPanel (audio framework has existed since Phase 9; the
 * panel simply had no surface). Opened from the Main Menu's Settings
 * item; in play, audio settings surface through the pause overlay's
 * Settings tab instead.
 *
 * Accessibility mechanics mirror ConfirmDialog (the proven pattern in
 * this codebase): role=dialog + aria-modal, focus trap, Escape to
 * close, auto-focus, backdrop click closes, body scroll lock. No new
 * settings logic — AudioSettingsPanel and its persistence already
 * exist and are tested (AudioSystem.test.tsx).
 */

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { AudioSettingsPanel } from './AudioSettings'
import { Icon } from './Icon'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-sm px-4"
      onClick={onClose}
      data-testid="settings-modal-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="chr-panel w-full max-w-sm p-5 menu-enter"
        data-testid="settings-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="settings-modal-title"
            className="font-pixel-display text-[10px] text-bronze-400 uppercase flex items-center gap-1.5"
          >
            <Icon name="settings" className="text-sm leading-none" />
            Settings
          </h2>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </Button>
        </div>

        <AudioSettingsPanel />
      </div>
    </div>
  )
}
