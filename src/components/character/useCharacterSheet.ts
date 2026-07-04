import { useCallback, useEffect, useRef, useState } from 'react'
import { getCharacter, updateCharacter, ServiceError } from '@/lib/supabase'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 800

/**
 * Load a character and provide a single `patch()` entry point for all edits.
 * Patches are applied optimistically to local state immediately (so the UI
 * never feels laggy) and persisted through the existing updateCharacter()
 * service call after a short debounce — multiple rapid edits (e.g. typing
 * in the bio field, or several ability-score clicks) collapse into one
 * write instead of one per keystroke.
 *
 * No validation logic lives here — updateCharacter() already runs every
 * patch through the same engine validators buildCharacter() uses, and
 * throws ServiceError('VALIDATION') on a bad patch, which this hook
 * surfaces as saveStatus === 'error' + saveError.
 */
export function useCharacterSheet(characterId: string) {
  const [character, setCharacter] = useState<CharacterRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const pendingPatchRef = useRef<UpdateCharacterInput>({})
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const record = await getCharacter(characterId)
      setCharacter(record)
    } catch (err) {
      setLoadError(
        err instanceof ServiceError ? err.message : 'Failed to load this character.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [characterId])

  useEffect(() => {
    void load()
    // Clear any pending debounce on unmount/character change so a stale
    // save can't fire against the wrong character id.
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [load])

  const flushSave = useCallback(async () => {
    const patch = pendingPatchRef.current
    if (Object.keys(patch).length === 0) return

    pendingPatchRef.current = {}
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const updated = await updateCharacter(characterId, patch)
      setCharacter(updated)
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('error')
      setSaveError(
        err instanceof ServiceError ? err.message : 'Failed to save your changes.',
      )
      // Re-load from the server so local state doesn't drift from what's
      // actually persisted after a failed save.
      void load()
    }
  }, [characterId, load])

  /**
   * Apply a patch optimistically and queue it for autosave. `localPreview`
   * is merged into local state immediately for instant feedback; the same
   * patch (in service-layer shape) is what eventually gets persisted.
   */
  const patch = useCallback(
    (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => {
      setCharacter((prev) => (prev && localPreview ? { ...prev, ...localPreview } : prev))

      pendingPatchRef.current = { ...pendingPatchRef.current, ...servicePatch }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        void flushSave()
      }, AUTOSAVE_DELAY_MS)
    },
    [flushSave],
  )

  /** Force an immediate save, bypassing the debounce — used on tab/page exit. */
  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    await flushSave()
  }, [flushSave])

  return {
    character,
    isLoading,
    loadError,
    saveStatus,
    saveError,
    patch,
    saveNow,
    reload: load,
  }
}
