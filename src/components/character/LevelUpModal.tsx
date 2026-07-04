/**
 * LevelUpModal — Phase 9.2
 *
 * Closes the level-up gap flagged in the Phase 9.0 UX audit: `readyToLevel`
 * was detected and a banner shown, but there was no way to actually advance
 * a level. This modal shows a real before/after stat comparison — computed
 * from the same pure engine functions the rest of the app already trusts
 * (getProficiencyBonus, calculateMaxHp) — and on confirm calls
 * updateCharacter({ level, currentHp }) which now correctly recalculates
 * derived stats (see the Phase 9.2 fix in src/lib/supabase/characters.ts).
 *
 * currentHp is increased by the same delta as maxHp on level-up (standard
 * "you feel tougher" convention), never decreased, and never exceeds the
 * new maxHp. This is a presentation-layer choice, not new engine math —
 * the actual maxHp/proficiency numbers come entirely from the engine.
 *
 * Accessibility follows the same pattern as ConfirmDialog: role=alertdialog,
 * focus trap, Escape to cancel, auto-focus, body scroll lock.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { PixelPanel, PixelBar } from '@/components/pixel'
import { getProficiencyBonus, calculateMaxHp, getXpForNextLevel } from '@/lib/engine'
import type { CharacterRecord } from '@/lib/supabase'

interface LevelUpModalProps {
  open: boolean
  character: CharacterRecord
  /** Called with the new level and computed currentHp/maxHp on confirm. */
  onConfirm: (patch: { level: number; currentHp: number }) => void | Promise<void>
  onCancel: () => void
  isSaving?: boolean
}

export function LevelUpModal({ open, character, onConfirm, onCancel, isSaving = false }: LevelUpModalProps) {
  const { sheet } = character
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  const newLevel = Math.min(sheet.level + 1, 20)
  const newMaxHp = calculateMaxHp({ level: newLevel, constitution: sheet.scores.constitution, hitDie: sheet.hitDie })
  const hpGain = Math.max(0, newMaxHp - sheet.maxHp)
  const newCurrentHp = Math.min(sheet.currentHp + hpGain, newMaxHp)
  const newProficiency = getProficiencyBonus(newLevel)
  const proficiencyChanged = newProficiency !== sheet.proficiencyBonus
  const xpForFollowingLevel = getXpForNextLevel(newLevel)
  const isMaxLevel = newLevel >= 20

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  async function handleConfirm() {
    setConfirmed(true)
    await onConfirm({ level: newLevel, currentHp: newCurrentHp })
    // Brief celebration beat (Phase 10.1) before the modal closes — the
    // level-up has already been persisted at this point (onConfirm awaited
    // above); this is purely a moment of visual acknowledgement, not a
    // gate on any data operation. Respects prefers-reduced-motion via the
    // same suppression block every other pixel animation in this app uses
    // (see pixel.css) — reduced-motion users see the same content with the
    // animation itself suppressed, not skipped entirely.
    setCelebrating(true)
    window.setTimeout(onCancel, 1400)
  }

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
        aria-labelledby="level-up-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm"
      >
        <PixelPanel variant="arcane" glow className="p-6 menu-enter relative overflow-hidden">
          {celebrating ? (
            <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="level-up-celebration">
              <div className="relative flex items-center justify-center w-24 h-24 mb-4">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <span
                    key={angle}
                    className="level-up-ray"
                    style={{ ['--ray-angle' as string]: `${angle}deg` }}
                    aria-hidden="true"
                  />
                ))}
                <span className="level-up-burst font-pixel-display text-3xl text-heal-400 relative z-10" aria-hidden="true">
                  ⬆
                </span>
              </div>
              <p className="level-up-burst font-pixel-display text-sm text-heal-400 uppercase" role="status">
                Level {newLevel}!
              </p>
              <p className="text-void-400 text-sm mt-1">{sheet.name} grows stronger.</p>
            </div>
          ) : (
            <>
              <p className="font-pixel-display text-[9px] text-arcane-400 uppercase mb-1">Level Up</p>
              <h2 id="level-up-title" className="font-display text-2xl text-white mb-4">
                {sheet.name} reaches Level {newLevel}
              </h2>

              <div className="flex flex-col gap-3 mb-5">
                <StatRow label="Max HP" from={sheet.maxHp} to={newMaxHp} />
                {proficiencyChanged && (
                  <StatRow label="Proficiency" from={`+${sheet.proficiencyBonus}`} to={`+${newProficiency}`} />
                )}
                <div>
                  <p className="font-pixel-display text-[7px] text-void-500 mb-1 uppercase">HP After Level Up</p>
                  <PixelBar value={newCurrentHp} max={newMaxHp} kind="hp" />
                </div>
                {!isMaxLevel && (
                  <p className="text-void-600 text-xs">
                    {character.experience} / {xpForFollowingLevel} XP toward Level {newLevel + 1}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving || confirmed}>
                  Not Yet
                </Button>
                <Button
                  ref={confirmRef}
                  type="button"
                  variant="arcane"
                  onClick={handleConfirm}
                  loading={isSaving || confirmed}
                  data-testid="confirm-level-up"
                >
                  Level Up
                </Button>
              </div>
            </>
          )}
        </PixelPanel>
      </div>
    </div>
  )
}

function StatRow({ label, from, to }: { label: string; from: string | number; to: string | number }) {
  return (
    <div className="flex items-center justify-between font-pixel-body text-base">
      <span className="text-void-500">{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-void-600">{from}</span>
        <span className="text-arcane-400" aria-hidden="true">→</span>
        <span className="text-heal-400 font-semibold">{to}</span>
      </span>
    </div>
  )
}
