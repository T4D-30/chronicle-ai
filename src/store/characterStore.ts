import { create } from 'zustand'
import {
  listCharacters,
  deleteCharacter as deleteCharacterService,
  duplicateCharacter as duplicateCharacterService,
  ServiceError,
} from '@/lib/supabase'
import type { CharacterRecord } from '@/lib/supabase'

interface CharacterStore {
  characters: CharacterRecord[]
  isLoading: boolean
  error: string | null

  /** Fetch the full character library for a user. Replaces the list. */
  fetchCharacters: (userId: string) => Promise<void>
  /** Remove a character from both the DB and the local list. */
  removeCharacter: (id: string) => Promise<void>
  /** Duplicate a character; the new copy is appended to the local list. */
  duplicateCharacter: (id: string, userId: string) => Promise<CharacterRecord>
  /** Insert or replace a single character in the local list without a full refetch. */
  upsertCharacter: (character: CharacterRecord) => void
  /** Clear any error state (e.g. after the user dismisses a toast). */
  clearError: () => void
}

/**
 * Character library state. This is intentionally thin — it owns the list
 * view's data, not individual character-sheet editing state, which lives
 * locally in the sheet/wizard components since it doesn't need to be shared
 * across routes.
 */
export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  isLoading: false,
  error: null,

  fetchCharacters: async (userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const characters = await listCharacters(userId)
      set({ characters, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof ServiceError ? err.message : 'Failed to load characters.',
      })
    }
  },

  removeCharacter: async (id: string) => {
    const previous = get().characters
    // Optimistic removal — character libraries feel sluggish if delete waits
    // on a round trip before the row disappears.
    set({ characters: previous.filter((c) => c.id !== id) })
    try {
      await deleteCharacterService(id)
    } catch (err) {
      // Roll back on failure
      set({
        characters: previous,
        error: err instanceof ServiceError ? err.message : 'Failed to delete character.',
      })
    }
  },

  duplicateCharacter: async (id: string, userId: string) => {
    set({ error: null })
    try {
      const duplicate = await duplicateCharacterService(id, userId)
      set({ characters: [duplicate, ...get().characters] })
      return duplicate
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to duplicate character.'
      set({ error: message })
      throw err
    }
  },

  upsertCharacter: (character: CharacterRecord) => {
    const existing = get().characters
    const index = existing.findIndex((c) => c.id === character.id)
    if (index === -1) {
      set({ characters: [character, ...existing] })
    } else {
      const next = [...existing]
      next[index] = character
      set({ characters: next })
    }
  },

  clearError: () => set({ error: null }),
}))
