import { useEffect, useRef } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Accessible confirm dialog.
 * Implements:
 *   - role=alertdialog with aria-modal
 *   - Focus trap (Tab/Shift+Tab cycle within the dialog)
 *   - Escape to cancel
 *   - Auto-focus on open (confirm button)
 *   - Background scroll lock
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef  = useRef<HTMLButtonElement>(null)
  const dialogRef  = useRef<HTMLDivElement>(null)

  // Auto-focus confirm button on open
  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape to cancel + focus trap
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
        return
      }

      // Focus trap: Tab cycles between cancel and confirm only
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return

        const first = focusable[0]
        const last  = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-sm px-4"
      onClick={onCancel}
      aria-hidden={!open}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-description' : undefined}
        onClick={(e) => e.stopPropagation()}
        className="chr-panel-arcane w-full max-w-sm p-6 animate-slide-up"
      >
        <h2 id="confirm-dialog-title" className="font-display text-xl text-white mb-2">
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-description" className="text-void-400 text-sm mb-6">
            {description}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <Button ref={cancelRef} type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={isDestructive ? 'danger' : 'arcane'}
            onClick={onConfirm}
            loading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
